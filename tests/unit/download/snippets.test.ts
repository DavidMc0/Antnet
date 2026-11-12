// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ADDRESS_HINT, ADDRESS_LABEL, BUTTON_STYLES, addressLine, escapeHtml, escapeMarkdown, htmlSnippet, markdownSnippet, shortenName } from "../../../sites/download/src/lib/snippets";
import { buildDownloadUrl } from "../../../sites/download/src/lib/params";

const A = "711c7e20006ff3e0ac6c1f3063286a0c1a3e4c409642e8c526173fa60bb7078a";
const URL_ = buildDownloadUrl("https://example.github.io/autonomirror/", { address: A, name: "lucky.jpg", size: 312_400_000 });
const text = (html: string) =>
  new DOMParser().parseFromString(html, "text/html").querySelector("a")!.textContent!.replace(/\s+/g, " ").trim();

describe("htmlSnippet", () => {
  it.each(BUTTON_STYLES)("%s matches snapshot", (style) => {
    expect(htmlSnippet(style, URL_, { fileName: "lucky.jpg", size: 312_400_000 })).toMatchSnapshot();
  });

  it("escapes & in the href and omits the size when unknown", () => {
    const html = htmlSnippet("light", URL_, { fileName: "lucky.jpg" });
    expect(html).toContain(`/f/ant/${A}?n=lucky.jpg`);
    expect(html).not.toContain("·");
    expect(htmlSnippet("minimal", URL_, { fileName: "lucky.jpg" })).toContain(">Download lucky.jpg from Autonomi</a>");
  });

  it("uses inline styles only: no script, class, id or stylesheet", () => {
    for (const style of BUTTON_STYLES) {
      const html = htmlSnippet(style, URL_, { fileName: "lucky.jpg", size: 1 });
      expect(html).not.toMatch(/<script|<style|<link|class=|id=/i);
      expect(html).toContain('target="_blank" rel="noopener"');
      expect(html).toContain('title="Free to download. Served by the Autonomi network, not this site."');
    }
  });

  it("parses back to one link with the original URL", () => {
    const doc = new DOMParser().parseFromString(htmlSnippet("dark", URL_, { fileName: "lucky.jpg", size: 5 }), "text/html");
    const links = doc.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(URL_);
  });

  it.each(["light", "dark"] as const)("%s puts the name first and the credit with a hidden logo under it", (style) => {
    const html = htmlSnippet(style, URL_, { fileName: "lucky.jpg", size: 138_931 });
    expect(text(html)).toBe("⬇ Download lucky.jpg · 139 KB Powered by Autonomi");
    const svg = new DOMParser().parseFromString(html, "text/html").querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("credits Autonomi in the label of the minimal link", () => {
    expect(text(htmlSnippet("minimal", URL_, { fileName: "lucky.jpg", size: 138_931 }))).toBe("Download lucky.jpg from Autonomi (139 KB)");
  });
});

describe("markdownSnippet", () => {
  it("includes the name, the credit and the compact size", () => {
    expect(markdownSnippet(URL_, { fileName: "lucky.jpg", size: 312_400_000 })).toBe(`[⬇ Download lucky.jpg from Autonomi (312 MB)](${URL_})`);
    expect(markdownSnippet(URL_, { fileName: "lucky.jpg" })).toBe(`[⬇ Download lucky.jpg from Autonomi](${URL_})`);
  });
});

describe("file name in the label", () => {
  it("escapes the name in HTML", () => {
    const html = htmlSnippet("light", URL_, { fileName: 'a<b>&"c".zip' });
    expect(html).toContain("Download a&lt;b&gt;&amp;&quot;c&quot;.zip<");
    expect(text(html)).toContain('Download a<b>&"c".zip');
  });

  it("escapes the name in Markdown", () => {
    expect(markdownSnippet(URL_, { size: 138_931, fileName: "my_mod [v2].zip" })).toBe(
      String.raw`[⬇ Download my\_mod \[v2\].zip from Autonomi (139 KB)](` + URL_ + ")",
    );
    expect(escapeMarkdown("a*b`c")).toBe("a\\*b\\`c");
  });

  it("shortens long names in the middle and keeps the full name in the tooltip", () => {
    const name = "a-very-long-file-name-for-my-favourite-mod-v1.2.zip";
    expect(shortenName(name)).toBe("a-very-long-file-na…vourite-mod-v1.2.zip");
    expect(Array.from(shortenName(name))).toHaveLength(40);
    expect(shortenName("short.zip")).toBe("short.zip");
    const html = htmlSnippet("dark", URL_, { fileName: name });
    expect(html).toContain("<span>Download a-very-long-file-na…vourite-mod-v1.2.zip</span>");
    expect(html).toContain(`title="${name}. Free to download.`);
    expect(htmlSnippet("light", URL_, { fileName: "short.zip" })).toContain('title="Free to download.');
  });
});

describe("escapeHtml", () => {
  it("escapes all five characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("full address", () => {
  it("shows the whole address in the line, so it can be read and copied", () => {
    const doc = new DOMParser().parseFromString(addressLine(A), "text/html");
    expect(doc.body.textContent).toBe(`${ADDRESS_LABEL} ${A}`);
    expect(doc.querySelector("div")!.getAttribute("title")).toBe(ADDRESS_HINT);
  });

  it.each(BUTTON_STYLES)("%s: always goes in the button's hover text when known", (style) => {
    const html = htmlSnippet(style, URL_, { fileName: "lucky.jpg", address: A });
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("a")!.getAttribute("title")).toContain(`${ADDRESS_LABEL} ${A}`);
    expect(doc.querySelector("a")!.nextElementSibling).toBeNull();
  });

  it("adds no line unless asked to", () => {
    for (const style of BUTTON_STYLES) {
      expect(htmlSnippet(style, URL_, { fileName: "lucky.jpg", showAddress: true })).not.toContain(ADDRESS_LABEL);
    }
    expect(markdownSnippet(URL_, { fileName: "lucky.jpg", address: A })).not.toContain(ADDRESS_LABEL);
  });

  it.each(BUTTON_STYLES)("%s: goes under one unchanged link, plain HTML with no script", (style) => {
    const plain = htmlSnippet(style, URL_, { fileName: "lucky.jpg", size: 1, address: A });
    const html = htmlSnippet(style, URL_, { fileName: "lucky.jpg", size: 1, address: A, showAddress: true });
    expect(html).toContain(plain);
    expect(html).not.toMatch(/<script|<style|<link|class=|id=|on\w+=|javascript:/i);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("a")).toHaveLength(1);
    expect(doc.querySelector("a")!.nextElementSibling!.textContent).toContain(`${ADDRESS_LABEL} ${A}`);
  });

  it("adds the full address to Markdown as a code span", () => {
    expect(markdownSnippet(URL_, { fileName: "lucky.jpg", address: A, showAddress: true })).toContain(`)\n\n${ADDRESS_LABEL} \`${A}\``);
  });
});

describe("generator defaults", () => {
  it("leaves the address line off by default", async () => {
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(`${process.cwd()}/sites/download/views/generator.html`, "utf8");
    expect(html).toContain('<input type="checkbox" id="show-address" />');
  });
});
