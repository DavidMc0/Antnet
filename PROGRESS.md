# Build progress: where we stopped

*Last updated 11 November 2026. The plan is in [Autonomi_Site_Loader_SPEC.md](Autonomi_Site_Loader_SPEC.md).*

## M1 (offline pipeline): done

- **Unit tests:** 57 passing (`npm test`): base32, host, tar, site settings and headers, `resolvePath`, ranges, `inspectArchive`.
- **Playwright:** 27 passing in Chromium (`npm run test:e2e`). They cover every M1 item in spec 11.4, plus some M2 and M4 extras:
  - "not a tar" and missing-address errors;
  - pointer chains;
  - landing page, path forms and go-links.
- **Type-check:** clean (`npm run typecheck`).
- **Builds:** `npm run build` (SDK source → `dist/`) and `npm run build:fixture` (→ `dist-fixture/`) both work.
- **Dev server:** smoke-tested (`npm run dev`, fixture source).

### What was added this session

- `src/main.ts`: boot, install, update check (5 s budget), guarded reload, info page, landing page with fixture list, `?open=`.
- `index.html`, `src/ui/style.css` (light and dark), `src/vite-env.d.ts`.
- `vite.config.ts`:
  - a worker plugin that bundles `src/sw.ts` to one IIFE with Vite's `build()` in lib mode;
  - no-cache headers;
  - shell CSP in the build only;
  - `allowedHosts`.
- `tools/`:
  - `tar-writer.mjs`, the shared deterministic ustar writer (plus a `.d.mts`);
  - `pack.mjs` (with `--nonce`, stored as a pax `comment`);
  - `link.mjs`, which imports `src/base32.ts` through Node's type stripping;
  - `build-fixtures.mjs`.
- `fixtures/`:
  - `plain`: CSP, a disallowed header, reserved-path files, a site `sw.js` registration;
  - `spa`;
  - `video`: a 6 s VP9 `clip.webm` made with ffmpeg.
- `tests/unit/*.test.ts`, `tests/e2e/{helpers.ts,m1.spec.ts}`, `playwright.config.ts` (preview on port 4173).
- `@types/node@24.19.2` (dev).

### Decisions worth knowing

- **Reload guard window** is now **5 s**, down from 15 s. A real loop bounces back within about a second, and the longer window would have shown the error to a visitor who hard-reloads twice.
- **The forced-reload e2e test** uses CDP `Page.reload({ ignoreCache: true })`, which bypasses the service worker like Shift+Reload.
- **Fixture source:** an archive's address is the SHA-256 of its tar, and pointer fixtures are `sha256("fixture-pointer:<name>")`. `public/_autonomi/fixtures/index.json` lists everything; entries with `listed: false` are hidden on the landing page.
- **Oversize archives** (> 64 MiB) are only unit-level so far. There's no 64 MiB fixture, to keep the repo light. The fixture source checks the HEAD `Content-Length`.

## M2 (mainnet, immutable links): done 11 November 2026

### Published files (user uploaded with the ant CLI)

| File | Address |
| --- | --- |
| `spa-v1.tar` | `9ea63625861bd3e72a31bf54af2f2e5daf9a1a1f0a04c5f5fb43d8e281a1e9e1` |
| `not-a-site.txt` | `3c58fa1efb58346a639ab423b95ec9b039c0b46179496486f880e1281cefc822` |

The CLI prints addresses with `0x`. The landing page, `link.mjs` and the mainnet tests now accept that prefix.

### Results

- **`npm run test:mainnet`:** 4 of 4 pass, with `ANT_SPA_V1` and `ANT_NOT_SITE` set. The SPA opens by its `i…` link, timings show on the info page, a non-tar shows "Not a site archive", the lowered limit refuses the download, and a missing address shows "Nothing found".
- **Cold opens of spa-v1** (4.6 kB, 4 records), Chromium on Windows:
  - **Connect** is steady at 0.84–0.90 s.
  - **Download** takes 8.4–14.2 s typically, with some outliers:
    - one auto run took 22 s;
    - two runs at concurrency 16 took 44 s and 50 s;
    - one auto run printed no result. It probably hit the probe's 120 s timeout, but this wasn't investigated.
  - **Warm open** takes 41 ms.
- **From SDK debug events** (`npm run probe -- <url> --debug`):
  - The DataMap takes about 2.2 s.
  - The three chunks then arrive about 1.5–3 s apart, even at concurrency 16. The concurrency setting (`--concurrency`, sessionStorage `autonomiConcurrency`) makes no difference, so the per-record lookup cost looks like an SDK or network issue worth raising upstream.
  - The 44–50 s outliers match the SDK's documented retries for missing records at 15 s and 45 s.
- **Progress:** SDK 0.1.5 reports chunk progress only in the message text ("Downloaded chunk 2/3"). The source parses that, so the loading screen shows "2 of 3 records".
- **Gate risk for M5:** a 2 MB site is still 4 records, so expect about 10 s too. That is right at the gate's 10 s median.

## M3 (pointers and updates): done on mainnet (with a raised check budget); budget decision pending

- **`tests/e2e/m3.spec.ts`:** 8 tests pass (36 fixture e2e in total). They cover:
  - a due check with no change;
  - a re-point installing the new version, with the old cache deleted;
  - a slow check: the 5 s budget is respected, the outcome is "timed out", and the next check is due in about 10 min;
  - a failed check;
  - an expired check while offline;
  - immutable links never checking;
  - the info page's "check now" and "clear" actions.
- **Bugs those tests found and fixed:**
  - The info page's "Cleared" message was written into the page it had just replaced.
  - `readState()` used `caches.open()`, which re-created an empty cache after "Clear". It now checks `caches.has()` first.
- **`tools/m3-mainnet.mjs before|after <pointer>`:** a two-phase mainnet test with a persistent profile in `test-results/m3-profile`. It needs `npx vite preview --port 4174` running on a fresh `npm run build`.
  1. `before` installs v1 through the pointer and times a no-change check.
  2. The user re-points the pointer.
  3. `after` expects the due check to install v2.

### Mainnet run (2026-11-11)

- **Addresses:**
  - pointer `ddabf062d1bbc960eaaaa01edf3cacbd3b3cbae8329cb4f48685a093032e4699` (owner key `publish/site.key`, gitignored), created pointing at spa-v1;
  - spa-v2 `5423f9da1e46527e28228f90553add3089f5bbd4adbc8c7c210675afbe0541b3`.
- **`before`:** passes. A cold open through the pointer installed v1. Measured times:
  - pointer resolve 18.6–18.8 s;
  - total 33–54 s, including one chunk that took 33 s on the SDK's retry.
- **Finding: the 5 s check budget doesn't work on mainnet with SDK 0.1.5.** `tools/pointer-timing.mjs` shows:
  - the first pointer read on a new connection takes 18.7–19.5 s, whether `getPointer` or `resolvePointer`;
  - later reads on the same connection take 1.3–4.5 s;
  - idling 10–20 s after connecting before the first read still leaves it at 9.3 s, so it's per-request lookup work, not connection warm-up;
  - every update check is a new connection, so with a 5 s budget it always times out. The fallback works as designed (cached site, retry in 10 min).
- **Test setting `checkBudgetMs`:** sessionStorage, 1–60 s, set through `m3-mainnet.mjs --budget <s>`. With 30 s, the no-change check succeeded in 18.9 s.
- **Design question for the user:** raise the budget, bring forward background checks (spec 10 / phase 2), and/or take the first-read latency up with the SDK maintainers. This is open question 486 in the spec.

- **`after` (pointer re-pointed to spa-v2, counter 1, 30 s budget):** passes. The due check found the new archive and installed v2:
  - pointer resolve 16.96 s, download 7.51 s, 24.7 s in total until Version 2 showed;
  - state recorded "new version installed", with the archive in use now spa-v2.
- **Fix:** an install made during an update check showed "connect —" on the info page. The check now times connect and resolve separately and passes both on.

**M3 done-when is met on mainnet: a re-pointed pointer shows the new version on the next due check, and a slow check falls back to the cached site.**

- **Budget decision (user, 2026-11-11):** `CHECK_BUDGET_MS` raised to 25 s for now. With that default and no override, a due check with no change succeeded in 17.9 s on mainnet. The fixture test for a slow check now sets `checkBudgetMs` to 3 s to stay fast. Background checks remain the better long-term fix.
- **SDK issue drafted:** `docs/sdk-issue-read-latency.md`, for WithAutonomi/ant-browser-sdk. It is related to the user's existing issue #10 there, about chunks that can't be fetched.

## Hosting: live at https://antnet.autonomirror.com/ (2026-11-11)

- **Server:** the user's VPS (Ubuntu 26.04, 77.42.84.209), with nginx alongside impactivefinance.com.
- **DNS:** at GoDaddy, `A antnet` and `A *.antnet` records point to the VPS.
- **Certificate:** a wildcard certificate from acme.sh via the GoDaddy DNS API (`dns_gd`), installed to `/etc/ssl/antnet/` and renewed automatically.
- **Files:**
  - `deploy/nginx/antnet.conf` is the nginx site;
  - `deploy/deploy.ps1 -Server root@77.42.84.209` deploys, using `npm run build:deploy` and atomic release switching under `/var/www/antnet`;
  - `deploy/README.md` has the setup steps.
- **Production builds no longer include `public/`** (the test fixtures).
- **Checked live:**
  - HTTP redirects to HTTPS, and the certificate is valid for subdomains;
  - the shell, service worker and assets have the right caching headers;
  - spa-v1 opened by its `i…` link at `/users/42` in 10.5 s, with download 8.8 s and connect 1.55 s (the WASM now comes over the internet);
  - the M3 pointer opened v2 in 23 s, with resolve 18.9 s.

## Demo, step 1: Start and the Library (plumbing done, plain look; 2026-11-11)

- **`sites/`** (see `sites/README.md`):
  - `build.mjs` builds each site from `site.mjs` plus `static/`, adds the shared receipt and the Start link, and writes a strict CSP (`default-src 'self'`) into each settings file;
  - `addresses.json` keeps track of uploads, and the build warns when a site has changed since it was uploaded;
  - Start lists its earlier versions;
  - `npm run sites` builds for mainnet into `publish/sites/`.
- **The Library:** four Standard Ebooks texts (CC0), fetched by `sites/library/fetch-books.mjs` with Standard Ebooks' branding sections dropped. The archive is 835 kB.
- **Start:**
  - the receipt;
  - the directory cards;
  - "How this page reached you", with this visit's timings from the loader's state;
  - Try this, Earlier versions, Publish your own and the fine print.
- **Fixtures:** `tools/build-fixtures.mjs` builds the demo sites linked exactly as on mainnet: `demo: Antnet Start` (pointer) and `demo: The Library`.
- **`tests/e2e/demo.spec.ts`** (5 tests; 41 in total, all passing):
  - links both ways, with back and forward history (the M4 behaviour, on fixtures);
  - receipt and timings;
  - the full tour offline;
  - the Library's 404;
  - archive size.
- **Checked:** no console errors or CSP violations on the demo pages.

## Demo, step 1b: design pass on Start and the Library (done 2026-11-11)

- **Looks:** described in `sites/README.md`. Fonts are bundled under the Open Font License: Literata for the Library; Instrument Sans and JetBrains Mono for Start.
- **The Library gained:**
  - cloth-bound covers on the shelf;
  - a title page in each book's cover colour;
  - a contents list and reading time built from the text;
  - a "next on the shelf" link;
  - a reading-progress line, where the browser supports scroll-driven animation.
- **Start gained:**
  - the three-dot mark;
  - the receipt as a card;
  - site cards tinted with each site's own colours;
  - the five-step trail;
  - the offline band;
  - numbered publish commands.
- **Checked** in light, dark and phone layouts: no console errors, CSP violations or sideways scrolling. All 41 e2e tests and 57 unit tests pass.
- **Archive sizes:** the Library is 1.09 MB and Start is 142 kB, both far under 12 MiB.
- **Not done:**
  - Safari and Firefox haven't been looked at.
  - The Library's receipt doesn't yet lead with its publish date and cost (DEMO.md 3.5); that needs the date at publish time.
  - Start shows one card until the other sites exist.

## Demo, step 1c: short names and the updated DEMO.md (done locally 2026-11-11; not deployed)

DEMO.md was revised (short names, "Where this page came from", a new top line for Start). The parts that change the Start and Library archives are built, so the sites can be published.

- **Short names in the loader** (`src/names.ts`, `src/host.ts`, `src/main.ts`):
  - **Rules:** 1–32 characters of a–z, 0–9 and single hyphens, with a reserved list. `ant`, `p`, `i` and `name` are reserved too, because they would clash with the address paths.
  - **Name hosts:** `library.<root>` looks the name up in `/_autonomi/names.json` and installs what it points to, on the name's own origin. The state record gains `name`, `nameSince` and `declaredName`.
  - **Name links:** `/_autonomi/go/name/<name>/…` is answered by the service worker. `<root>/<name>`, `?open=<name>` and the address box work on the root domain.
  - **Due checks:** a named site re-reads the directory first. A changed entry installs the new target; a removed name stops being served; an unreadable directory falls back to the cached site and retries in 10 minutes. A name on a pointer then does the pointer check as before.
  - **Other pages:** an unknown name gets a plain page. The info page shows the chain and what the site calls itself.
- **`names.json`** at the repository root is the live directory. `sites/build.mjs` writes it from `sites/addresses.json`. Production builds emit it at `_autonomi/names.json`; fixture builds use a test directory written by `tools/build-fixtures.mjs`.
- **nginx:** `deploy/nginx/antnet.conf` has a new rule so `/_autonomi/names.json` serves the file, not the shell. **It must be copied to the VPS again** (deploy/README.md, "When the nginx config changes").
- **Per-record detail:** the Autonomi source stores `recordList` (the DataMap with its serving node, and each chunk's address and size) and `arrivals` (when each chunk arrived, plus the peer when a later SDK reports it). The info page shows them as "Where this site came from".
- **Site builds:**
  - Links are by name, and each site's settings carry its `name`.
  - Content sites carry their publish date, pinned so an unchanged site rebuilds to the same bytes.
  - `record` notes the last build's hash rather than rebuilding, and takes `--cost`.
- **Start:**
  - the claim as its top line, with the tagline quieter beneath;
  - the name line, with the full address on click;
  - "Where this page came from" in place of the offline band;
  - the publish command showing the loader in use;
  - the fine-print line about names.
- **The Library:** the footer leads with the publish date, and the offline clause is gone.
- **Receipt fix:** it now counts the DataMap, so it agrees with the info page ("4 records").
- **One change to DEMO.md's wording:** the developer-tools line said the Network tab shows no request for the site's content. It does list the files, marked as served by the service worker, so the line now says that.
- **Tests:** 71 unit (14 new in `names.test.ts`) and 58 e2e (`names.spec.ts` is new; `demo.spec.ts` moved to name hosts), all passing. No console errors, CSP violations or sideways scrolling in light, dark and phone layouts.
- **`tools/m4-mainnet.mjs`** runs M4 against the live loader once the sites are published.

## Publishing Start and the Library (2026-11-11, evening)

- **Done:**
  - The nginx config was copied to the VPS and reloaded; `/_autonomi/names.json` returned 404 before the deploy.
  - The loader was deployed with names support; `names.json` is served as `200 application/json`, with an empty directory at that point.
  - **The Library** was uploaded: `9dd1fcae0e27248c4c3a87e3676e3ac03d100bab7a63eaa7b410c8c7abf785ae`, costing 0.3213 ANT plus 0.000004 ETH gas, and recorded.
    - Checked on mainnet through the live loader, opened by its `i…` link in a fresh profile: 9.85 s in total (connect 1.50 s, download 8.22 s), 4 records.
  - **Start's pointer key** is `publish/start.key` (gitignored; the user is to back it up). The pointer address is `797c42a3c98e910a027825f7f3785175d9c80750baa1e564e1401166354be5f1`, recorded.
  - **Start v1** was uploaded: `e18cdc3620a70498e17f78b1d04eb0a7a7047a34147756eb767b6fa160748c90`, costing 0.3738 ANT plus 0.000004 ETH gas, and recorded.
  - `names.json` now maps `start` to the pointer and `library` to the Library's archive. `sites/addresses.json` holds all of this.
- **Given to the user, not yet confirmed:**
  1. `ant pointer create --key publish\start.key e18cdc3620a70498e17f78b1d04eb0a7a7047a34147756eb767b6fa160748c90`
  2. `.\deploy\deploy.ps1 -Server root@77.42.84.209`, so `names.json` with both names reaches the host.
  3. `Remove-Item Env:SECRET_KEY`.
- **None of today's short-names work is committed or pushed yet,** including `sites/addresses.json` and `names.json`. The user hasn't yet said whether to push.

- **Confirmed:**
  - Start's pointer (counter 0) targets `e18cdc36…8c90`.
  - The live `names.json` lists `start` and `library`.

## M4 (links between sites): done on mainnet, 2026-11-11

`node tools/m4-mainnet.mjs` passed all 6 checks against https://antnet.autonomirror.com/, in a fresh profile:

| Check | Result |
| --- | --- |
| Start opens by name, `start.antnet.autonomirror.com` | connect 1.89 s · resolve 14.32 s · download 3.28 s · total 19.60 s |
| Start links to the Library by a name link | connect 1.85 s · download 8.33 s · total 10.30 s |
| The Library links back to Start | pass |
| Back and forward work across the two sites | pass |
| A portable address link keeps its path, query and fragment | `/users/42?from=m4#top` on the M2 SPA |
| The root-domain path form reaches the same site | pass |

- **The live info page** shows the chain `start` → pointer `797c…5f1` → archive `e18c…8c90`, and the records. The DataMap's serving node is named (`e04804fc…ae0fda`); the chunk nodes aren't reported by SDK 0.1.5, as expected.
- **Fixes to the tools:**
  - `m4-mainnet.mjs` opened the info page in a separate browser session.
  - `probe.mjs` read a named site's info page before it rendered.

## Demo, step 3: warm-up and the front door (built locally 2026-11-11; not deployed)

- **Warm-up** (`src/warm.ts`, DEMO.md 5.2):
  - **The warm path:** `<site>/_autonomi/warm` installs the site without reloading and reports to the page that embedded it. The frame sends `{type:"antnet:warm", status, step, done, total, unit}` in reply to `{type:"antnet:hello"}`.
  - **Who it answers:** only a parent on this loader (`isLoaderOrigin`: the root or a subdomain, same scheme and port), and only the window that embedded it.
  - **Already installed:** a site that is already there reports ready without fetching.
  - **`install()`** now takes an `InstallUI`: the loading screen, or a reporter for the warm path.
- **Front door** (`showFrontDoor`, DEMO.md 5.1): when `names.json` has `start`, the root page says "This is the last page a web server will send you." It warms Start in a hidden frame, shows its progress, and has an Enter link that also works early. The address box, handler offer and test-fixture list sit below. Without `start`, the old landing page shows. The design is plain; it gets a Fable pass later.
- **Shell CSP:** gains `frame-src 'self' https://*.<root>` (`http://*.localhost:*` without a root).
- **Start, v2 (built, not uploaded):**
  - Each card warms its site one at a time, through its portable link to `/_autonomi/warm`, showing "Arriving… 2 of 3 records" and then "Ready".
  - Start's CSP adds `frame-src 'self' https: http://localhost:* http://*.localhost:*` (`cspExtra` in its `site.mjs`).
  - **Holding the upload** until the next site exists, so Start is only paid for once more.
- **Tests:** 74 unit (`warm.test.ts` is new) and 65 Chromium e2e (`warm.spec.ts` is new), all passing. Opening Start after the front door, or the Library after Start's card says Ready, fetches nothing from the network.
- **Cross-browser** (new `playwright.browsers.config.ts`; `npx playwright install firefox webkit` done):
  - **Firefox:** warm-up works.
  - **WebKit:** keeps framed storage apart from top-level visits on `*.localhost`, so warm-up doesn't help there. This is the open question for Safari on the real domain. Nothing breaks: Enter shows the loading screen, though a WebKit card can say "Ready" when it isn't.
  - **Full suite in Firefox and WebKit:** 14 failures. Mostly tool limits:
    - CDP-only forced-reload tests;
    - request interception not reaching WebKit's service worker and frames;
    - WebM/VP9 not playing in Windows WebKit.
  - **Possibly real, to check on the Mac mini in Safari:** `?open=<name>` after a path-form visit (`names.spec.ts`, "the root domain opens a name…"), and the reload-guard behaviour.

- **Root page:** both versions now list every site in `names.json` as links, and say what to type (commit `511ed37`), after the user found the old page left visitors stuck.
- **Deployed and live (2026-11-11, about 22:10 UTC).** `tools/warm-live.mjs` on the live loader, fresh profiles:

| Browser | Front door fetch | Enter → Start | Result |
| --- | --- | --- | --- |
| Chromium | ready after 21.4 s | 191 ms | Warmed |
| Firefox | ready after 26.3 s | 226 ms | Warmed |
| WebKit (Playwright, Windows) | "Couldn't reach the Autonomi network" within 2 s | — | Can't test: this build has no `RTCPeerConnection` |

- **Safari** therefore has to be checked on the user's Mac mini.
- **To do:** say plainly when a browser has no WebRTC ("This browser can't make the direct connections Antnet needs"), rather than "Couldn't reach the Autonomi network". This belongs with DEMO.md 5.5.

- **Safari on the Mac mini, with the frame-based front door:** it worked, but after "ready" and Enter, Start was fetched again, pointer read included. So Safari keeps a framed site's storage apart from a top-level visit even on the real domain. The same applies to every iPhone and iPad browser, since they all use WebKit.

## Front door, redesigned: on the site's own origin, no frames (2026-11-11, late)

The user agreed to the redesign after the Safari result.

- **The bare root** (`/`, no query) on a loader whose directory has `start` redirects to `start.<root>/_autonomi/door`. `?landing`, `/<unknown-name>`, `?open=` and the path forms behave as before. A loader without `start` shows the address page, now with the named sites listed.
- **`/_autonomi/door`** on any site:
  - **Already installed:** the service worker redirects straight to `/`, without the shell (`DOOR_PATH` in `config.ts`, handled in `sw.ts`). The shell does the same if the worker isn't active yet.
  - **Otherwise:** the shell shows the front door ("This is the last page a web server will send you") while it installs the site on its own origin. Enter opens it at once once it has arrived. Pressed early, it opens the site as soon as the install finishes, with no second install. On failure the button becomes "Try again". The door replaces itself in history.
  - **Lower down:** the other named sites, and the address box.
- **The shell no longer embeds frames:** the parent side of `warm.ts` and the shell's `frame-src` were removed. `/_autonomi/warm` stays, for Start's cards.
- **Start v2 cards** skip warm-up on WebKit, including every iOS browser, and say "Fetched when you open it". Elsewhere they warm as before.
- **Tests:** Chromium 66/66 and 74 unit tests pass. In Firefox, the door, demo and names files all pass. In WebKit the door's main path passes (root → door → ready → Enter → Start instantly); what fails:
  - the four directory-change tests (interception doesn't reach WebKit's service worker);
  - **two that need checking in real Safari:** after a script redirect from the root (`localhost`) to an installed site (`start.localhost`), WebKit shows the meta cache but no `state.json`, so it reinstalls. That covers a returning visitor at the root, and `?open=library` after visiting the Library. It may be specific to `localhost`.

- **Deployed and confirmed (2026-11-11, late):**
  - **Chromium, fresh profile (`tools/warm-live.mjs`):** root → door, ready after 25.8 s → Enter → Start in 116 ms.
  - **Safari on the Mac mini, return visit:** the root goes straight to Start, in a new tab and in an existing one.
  - **Safari, first visit** (after clearing Start's data on its info page): the loading screen and front door show, become ready, and Enter opens Start instantly.
  - **So the front door works in Chrome, Brave, Firefox and Safari.** The WebKit return-visit failure seen locally was specific to `localhost`.

- **Safari, `?open=library` after visiting the Library:** works. Both WebKit failures seen locally were artefacts of `*.localhost`.

## Non-blocking updates (DEMO.md 5.3; built 2026-11-11, late; not yet deployed)

- **The service worker no longer holds navigations for due checks** (the old Rule 4 is removed). An installed site is always served at once.
- **The check script:** for pointer and named sites, the worker adds `<script src="/_autonomi/check.js" defer>` as the first element of each HTML page's `<head>`, and serves that script itself (`src/check-client.js`, bundled raw into the worker). It is loader code, and the info page says so in a new "Updates" row.
- **How the check runs:** about 1 s after the page loads, the script opens `/_autonomi/check` in a hidden frame on the **site's own origin**, so it shares storage in every browser, Safari included.
  - The shell there runs `checkForUpdate()` if a check is due. That function re-reads `names.json` for named sites, then reads the pointer within `BACKGROUND_CHECK_BUDGET_MS` (30 s), installs any new version and records the outcome.
  - It reports `updated`, `no-change`, `removed`, `not-due` or `not-installed` to the page.
- **What the visitor sees:** `updated` shows a notice, "A newer version of this page is available. [Reload]"; `removed` shows "This site's name has been removed from the directory." The notice is in an open shadow root and styled through CSSOM, so a site policy of `style-src 'self'` allows it.
- **Info page:** "Check for a new version now" runs `checkForUpdate()` on the spot and shows the outcome there.
- **Removed:** the blocking `updateCheck` and `nameCheck`. A hard reload of an installed site just hands back to the worker.
- **Tests:** `m3.spec.ts` and the names due-check tests were rewritten for background semantics. Helpers `readState`, `expireCheck`, `waitForCheck` and `updateNotice` are in `helpers.ts`.
  - **Results:** Chromium 67/67, unit 74, and Firefox all pass. WebKit passes too, apart from the interception-based tests, which are skipped there with `INTERCEPT`.
- **Not handled:** a site whose own CSP blocks same-origin frames, or the script, won't get background checks (there is no blocking fallback any more). The demo sites allow both.

- **Deployed and checked live (`tools/checks-live.mjs`, fresh profiles):** the loader script is first in `<head>` on both sites. With a check due, each page showed at once and the check ran afterwards, with no notice (nothing had changed):

| Site | Page shown | Background check |
| --- | --- | --- |
| Start, Chromium | 79 ms | no change, 15.2 s |
| Start, Firefox | 111 ms | no change, 15.9 s |
| Library, Chromium | 92 ms | no change, 0.1 s |
| Library, Firefox | 138 ms | no change, under 0.1 s |

## Front door design pass: planned, not started (2026-11-11, end of session)

The user asked for the pass in Fable: clear, attractive, strong and confident without being over the top, and highlighting the benefits that come from Autonomi. The session ended before any code changed. The only change on disk is `src/ui/fonts/`, which holds copies of Start's Instrument Sans and JetBrains Mono with their licences. It is untracked and not yet referenced.

**The plan:**
- **Look:** the same family as Start (cool paper, deep green ink, the three-dot mark, Instrument Sans with JetBrains Mono), so door → Start feels like one place. Scope the styles to the door with a page attribute (for example `data-page="door"` on `<html>`), leaving the loading, info and error views as they are. Bundle the fonts through `src/ui/style.css`; Vite emits them under `/_autonomi/assets/`.
- **Layout:** a full page, not a card.
  1. **Top bar:** the mark, "antnet", and a Source link.
  2. **Hero:** "This is the last page a web server will send you.", with one line beneath: from here on, sites come straight from the Autonomi network, fetched by the browser and checked piece by piece.
  3. **Live panel:** a five-node trail (Connect, Find, Fetch, Check, Hand over) matching Start's strip, the status line, and Enter. When ready, a mono line shows this visit's numbers (records, size, time).
  4. **Three benefits:** no server in the middle (checked in your browser); opens from an ordinary link (nothing to install); paid for once (no hosting bill, no renewal).
  5. **Lower, quieter:** the other named sites, the address box, and a fine-print line that this first page is the loader, small and open source.
- **Plumbing needed:**
  - `InstallUI.step(text, stage?)` with stages `connect | find | fetch | install`, so the trail doesn't depend on message text.
  - The door's `done()` reads the state record for the summary line.
- **Keep for tests** (`tests/e2e/warm.spec.ts`):
  - `[data-door]` with `working | ready | error`;
  - `data-testid="door-status"`, with ready text "Antnet Start is here, checked and ready.";
  - `data-testid="enter"`, reading "Try again" on error;
  - "Opening as soon as it arrives" after an early Enter;
  - `data-testid="named-sites"`;
  - the `h1` text.

  Update the test's "Enter tries again" wording if the error copy changes.
- **Avoid:** forever, unstoppable, uncensorable, revolutionary, Web3 (DEMO.md section 1).

## DEMO.md: the Download Button site (added by the user, 2026-11-11, late)

Section 3.6 adds **Download Button**: Autonomirror's download page and button generator as an Antnet site named `download`, with links of the form `/f/ant/<address>?n=&s=`. It makes six sites, adds a step to the script, and is built after Cinema in section 10. Notes for building it:

- **The site's CSP must loosen** (as for Cinema): `script-src 'self' 'wasm-unsafe-eval'` and `connect-src 'self' https: wss:` for the bundled SDK, plus `https://autonomirror.com` if it fetches the removal list. Use `cspExtra` in its `site.mjs`; the shared CSP replaces `script-src`, so build the policy rather than appending a second `script-src`.
- **The Library's "Download as EPUB" button means a Library v2 upload.** Upload it together with Start v2.
- **`/f/ant/…` paths are fine:** the loader reserves only `/_autonomi/…`, and `"spa": true` serves deep links and reloads.
- **Open decision:** how the removal list fails when it can't be fetched (DEMO.md section 11).

### Next

1. **The front door design pass** above, in Fable.
2. **In DEMO.md section 10's order:**
   - **A design pass on the front door:** a good job for Fable.
   - **Cinema streaming** (section 5.8), then ColonySim and the Docs. Upload Start v2 with the next new site.
   - **The loading screen and "can't connect" page,** including a plain message for browsers without WebRTC.
   - **The address bar.**
   - **The name claim form and Action.**
3. **Then, in DEMO.md section 10's order:**
   - non-blocking updates (Start's hourly check holds the page for about 15–20 s);
   - Cinema streaming;
   - ColonySim and the Docs;
   - the loading screen and "can't connect" page;
   - the address bar;
   - the claim form and Action.
4. **Then, in DEMO.md section 10's order:**
   - warm-up and the front door;
   - non-blocking updates;
   - Cinema streaming (section 5.8);
   - ColonySim and the Docs;
   - the loading screen and "can't connect" page;
   - the address bar (5.7);
   - the claim form and Action;
   - the node list, when an SDK release reports it.
5. **M5:** upload the bench archives, then do ten cold opens each with `npm run probe` on the live host.
