// Milestone M1 acceptance tests (spec 11.4), against the fixture-mode build.

import { expect, test } from "@playwright/test";
import { PORT, ROOT_URL, fixture, install, labelFor, siteUrl, storage } from "./helpers";

test.describe("labels", () => {
  test("a label opens the site at its address", async ({ page }) => {
    await install(page, "plain", "body[data-page=home]");
    expect(new URL(page.url()).hostname).toBe(`${labelFor("plain")}.localhost`);
    await page.goto(siteUrl("plain", "/_autonomi/"));
    await expect(page.locator("[data-view=info]")).toContainText(fixture("plain").address);
  });

  for (const [what, label] of [
    ["wrong length", labelFor("plain").slice(0, -1)],
    ["non-canonical trailing bits", labelFor("plain").slice(0, -1) + "7"],
    ["unknown kind", "x" + labelFor("plain").slice(1)],
  ]) {
    test(`a ${what} label shows an error page`, async ({ page }) => {
      await page.goto(`http://${label}.localhost:${PORT}/`);
      await expect(page.locator("[data-view=error] h1")).toHaveText("Not a valid site address");
      expect((await storage(page)).caches).toEqual([]);
    });
  }
});

test.describe("rejected archives install nothing", () => {
  for (const name of [
    "bad-dotdot",
    "bad-absolute",
    "bad-symlink",
    "bad-hardlink",
    "bad-duplicate",
    "bad-no-index",
    "bad-settings",
    "not-a-tar",
  ]) {
    test(name, async ({ page }) => {
      await page.goto(siteUrl(name));
      await expect(page.locator("[data-view=error] h1")).toHaveText("Not a site archive", { timeout: 15_000 });
      const s = await storage(page);
      expect(s.state).toBe(false);
      expect(s.caches.filter((c) => c.startsWith("site-v1-"))).toEqual([]);
    });
  }

  test("an address with nothing behind it", async ({ page }) => {
    await page.goto(siteUrl("missing"));
    await expect(page.locator("[data-view=error] h1")).toHaveText("Nothing found at this address");
  });

  test("an archive over the size limit is refused", async ({ page }) => {
    // Lower the limit below the plain fixture's size (the override can only lower it).
    await page.addInitScript(() => sessionStorage.setItem("maxArchiveBytes", "1000"));
    await page.goto(siteUrl("plain"));
    await expect(page.locator("[data-view=error] h1")).toHaveText("This site is too large");
    expect((await storage(page)).state).toBe(false);
  });

  test("a pointer whose target isn't a file", async ({ page }) => {
    await page.goto(siteUrl("pointer-not-chunk"));
    await expect(page.locator("[data-view=error] h1")).toHaveText("This pointer doesn't lead to a site");
  });
});

test.describe("path resolution after install (spec 5.2)", () => {
  test("plain site: root, nested page, directory redirect, 404 page", async ({ page }) => {
    await install(page, "plain", "body[data-page=home]");

    let res = await page.goto(siteUrl("plain", "/docs/page.html"));
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).toHaveAttribute("data-page", "nested");

    res = await page.goto(siteUrl("plain", "/about?x=1"));
    expect(page.url()).toBe(siteUrl("plain", "/about/?x=1"));
    await expect(page.locator("body")).toHaveAttribute("data-page", "about");

    res = await page.goto(siteUrl("plain", "/missing"));
    expect(res?.status()).toBe(404);
    await expect(page.locator("body")).toHaveAttribute("data-page", "not-found");
  });

  test("SPA deep link on first visit and after install", async ({ page }) => {
    await install(page, "spa", "body[data-route='/users/42']", "/users/42");
    await expect(page.locator("#view")).toHaveText("User 42");
    await page.goto(siteUrl("spa", "/settings/profile"));
    await expect(page.locator("#view")).toHaveText("Route /settings/profile");
    // A missing asset (not a navigation) is still a 404.
    const status = await page.evaluate(async () => (await fetch("/nope.js")).status);
    expect(status).toBe(404);
  });

  test("a pointer chain resolves to the site", async ({ page }) => {
    await install(page, "plain (pointer chain)", "body[data-page=home]");
    await page.goto(siteUrl("plain (pointer chain)", "/_autonomi/"));
    await expect(page.getByTestId("archive")).toHaveText(fixture("plain").address);
  });
});

test.describe("served from cache", () => {
  test("a reload makes no request to the host for site files, and works offline", async ({ page, context }) => {
    await install(page, "plain", "body[data-page=home]");

    const fromNetwork: string[] = [];
    let fromWorker = 0;
    page.on("response", (r) => {
      if (r.fromServiceWorker()) fromWorker++;
      else fromNetwork.push(r.url());
    });
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-external", "ran");
    expect(fromNetwork).toEqual([]);
    expect(fromWorker).toBeGreaterThanOrEqual(3); // page, stylesheet, script

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-page", "home");
    await page.goto(siteUrl("plain", "/docs/page.html"));
    await expect(page.locator("body")).toHaveAttribute("data-page", "nested");
    await context.setOffline(false);
  });

  test("a forced reload returns to the site after one automatic reload, without looping", async ({ page }) => {
    await install(page, "plain", "body[data-page=home]");
    // Let the install's own automatic reload fall outside the guard window.
    await page.waitForTimeout(5_500);

    const navigations: string[] = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) navigations.push(f.url());
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Page.reload", { ignoreCache: true }); // bypasses the service worker
    await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 10_000 });
    await page.waitForTimeout(1_000);
    expect(navigations.length).toBe(2); // the shell, then the site

    // A second forced reload straight away still works (two automatic reloads allowed).
    navigations.length = 0;
    await cdp.send("Page.reload", { ignoreCache: true });
    await expect(page.locator("body")).toHaveAttribute("data-page", "home", { timeout: 10_000 });
    await page.waitForTimeout(1_000);
    expect(navigations.length).toBe(2);
  });
});

test("the reload guard shows an error instead of looping", async ({ page }) => {
  await install(page, "plain", "body[data-page=home]");
  // Pretend the shell has just reloaded twice and come straight back.
  await page.evaluate(() => {
    const now = Date.now();
    sessionStorage.setItem("autonomi-loader-reloads", JSON.stringify([now - 200, now - 100]));
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.reload", { ignoreCache: true });
  await expect(page.locator("[data-view=error] h1")).toHaveText("The site didn't open");
});

test.describe("site settings and isolation", () => {
  test("a declared CSP is enforced; a header outside the allowed list is ignored", async ({ page }) => {
    await install(page, "plain", "body[data-external=ran]");
    const res = await page.reload();
    const headers = res!.headers();
    expect(headers["content-security-policy"]).toContain("script-src 'self'");
    expect(headers["x-frame-options"]).toBeUndefined();
    await expect(page.locator("body")).not.toHaveAttribute("data-inline", "ran");
    await expect(page.locator("#inline-status")).toHaveText("Inline scripts blocked.");

    await page.goto(siteUrl("plain", "/_autonomi/"));
    await expect(page.getByTestId("ignored")).toContainText("X-Frame-Options");
  });

  test("a site's own service worker fails to register; the loader's stays in control", async ({ page }) => {
    await install(page, "plain", "body[data-site-sw]");
    await expect(page.locator("body")).toHaveAttribute("data-site-sw", "rejected");
    const controller = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null);
    expect(controller).toBe(siteUrl("plain", "/autonomi-loader-sw.js"));
  });

  test("files under reserved paths in an archive are not served", async ({ page }) => {
    await install(page, "plain", "body[data-page=home]");
    const texts = await page.evaluate(async () =>
      Promise.all(["/_autonomi/secret.txt", "/autonomi-loader-sw.js"].map(async (p) => (await fetch(p)).text())),
    );
    expect(texts[0]).not.toContain("must never be served");
    expect(texts[1]).not.toContain("A site file at the loader's worker path");
    await page.goto(siteUrl("plain", "/_autonomi/"));
    await expect(page.getByTestId("ignored")).toContainText("_autonomi/secret.txt");
  });
});

test.describe("media", () => {
  test("range requests get 206 and a video seeks", async ({ page }) => {
    await install(page, "video", "#clip");
    const r = await page.evaluate(async () => {
      const res = await fetch("/clip.webm", { headers: { Range: "bytes=100-199" } });
      const bad = await fetch("/clip.webm", { headers: { Range: "bytes=999999999-" } });
      return {
        status: res.status,
        range: res.headers.get("Content-Range"),
        length: (await res.arrayBuffer()).byteLength,
        bad: bad.status,
      };
    });
    expect(r.status).toBe(206);
    expect(r.range).toMatch(/^bytes 100-199\/\d+$/);
    expect(r.length).toBe(100);
    expect(r.bad).toBe(416);

    const seeked = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const v = document.getElementById("clip") as HTMLVideoElement;
          v.muted = true;
          const go = () => {
            v.addEventListener("seeked", () => resolve(v.currentTime), { once: true });
            v.currentTime = 4;
          };
          v.addEventListener("error", () => reject(new Error(`video error ${v.error?.code}`)));
          if (v.readyState >= 1) go();
          else v.addEventListener("loadedmetadata", go, { once: true });
          setTimeout(() => reject(new Error("timed out")), 10_000);
        }),
    );
    expect(seeked).toBeCloseTo(4, 0);
  });
});

test.describe("landing page and links", () => {
  test("the landing page lists fixtures and opens a pasted address", async ({ page }) => {
    await page.goto(ROOT_URL);
    await expect(page.locator("[data-view=landing]")).toBeVisible();
    await expect(page.locator("a[data-fixture=plain]")).toHaveAttribute("href", siteUrl("plain"));
    await page.fill("input[name=address]", `ant://${fixture("plain").address}/docs/page.html`);
    await page.click("form button[type=submit]");
    await expect(page.locator("body")).toHaveAttribute("data-page", "nested", { timeout: 15_000 });
  });

  test("the landing page explains a bad address", async ({ page }) => {
    await page.goto(ROOT_URL);
    await page.fill("input[name=address]", "not an address");
    await page.click("form button[type=submit]");
    await expect(page.locator(".form-error")).toContainText("Not a recognised address");
  });

  test("root path forms and portable links redirect, keeping path, query and fragment", async ({ page }) => {
    const hex = fixture("plain").address;
    await page.goto(`${ROOT_URL}ant/${hex}/docs/page.html?q=1#f`);
    await expect(page.locator("body")).toHaveAttribute("data-page", "nested", { timeout: 15_000 });
    expect(page.url()).toBe(siteUrl("plain", "/docs/page.html?q=1#f"));

    // From the installed SPA (worker active), a go-link to the plain site.
    await install(page, "spa", "#view");
    await page.goto(siteUrl("spa", `/_autonomi/go/ant/${hex}/about/?x=2#y`));
    await expect(page.locator("body")).toHaveAttribute("data-page", "about", { timeout: 15_000 });
    expect(page.url()).toBe(siteUrl("plain", "/about/?x=2#y"));
  });
});
