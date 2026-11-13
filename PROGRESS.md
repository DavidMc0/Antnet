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

## Front door design pass: built and deployed (2026-11-12)

Built in Fable, to the plan above. Only the door changed look; the loading, info, error and address pages are as before.

- **Scope:** `showFrontDoor` sets `data-page="door"` on `<html>` (`mount()` clears it for every other view). The door's styles are the last block of `src/ui/style.css`, with the two fonts bundled from `src/ui/fonts/`.
- **Layout:** top bar (mark, "antnet", Source) → hero (the `h1` and one line on what it means) → live panel on the dark band → "What changes on the other side" (three benefits) → "Going somewhere else?" (named sites, address box) → fine print → footer.
- **Live panel:**
  - a five-node trail (Connect, Find, Fetch, Check, Hand over), each pending, under way (turning ring), done (tick) or failed;
  - a seconds counter, a status line, and a second line that holds the hint ("A first visit usually takes 10 to 30 seconds…"), then this visit's numbers, or the error;
  - Enter is an outline while the site is on its way and filled once it is ready ("Enter Antnet Start"). Pressed early it reads "Opening when ready".
  - The tab title becomes "Ready · Antnet Start", for visitors who switched tabs.
- **Plumbing:** `InstallUI.step(text, stage)` with `connect | find | fetch | install`; the door's `done()` reads the state record for the numbers; `FrontDoorView.entered()` replaces the old step-text report.
- **Copy change:** a failure now reads "Antnet Start couldn't be fetched." with the reason beneath (was "… Enter tries again."). `warm.spec.ts` was updated to match.
- **Checked:** screenshots at 1280, 820, 390 and 320 px wide, light and dark, in the working, early-Enter, ready and error states; no sideways scroll at any width. Unit 74/74, Chromium e2e 67/67.
- **Deployed 2026-11-12;** the user checked it live and is happy with it.
- **Left for later:** the plain message for browsers without WebRTC (DEMO.md 5.5); the loading screen still has the old look, so an early deep link looks different from the door.

## Cinema, step 1: checking the film (2026-11-12)

`tools/media-probe.mjs <address>` (needs `npx cross-env VITE_SOURCE=autonomi vite --port 5180 --strictPort`) opens a public file with the SDK and reads only its head and tail.

- **The film at `a6fbc263…e7a1a` is WebM, not MP4:** AV1 video at 1920×1080, Opus stereo audio at 48 kHz, 10 min 35 s, 162.5 MB (about 2 Mbit/s).
  - Its index (Cues) is in the last 2.6 kB, inside the SDK's 64 KiB tail prime. Media starts at byte 661.
  - The SDK reports it as `public-file-….bin`, `application/octet-stream`, so it isn't recognised as media: pass `primePlayback: true`. The stream worker takes the type from the media URL's `type` query parameter, so set `type=video/webm` on `source.url` before giving it to the `<video>`.
- **Plays in Playwright Chromium** (dev server, the SDK's own stream worker, two runs):

| | Run 1 | Run 2 |
| --- | --- | --- |
| Connect | 0.8 s | 0.9 s |
| `createMediaSource` (opens the file) | 12.1 s | 12.3 s |
| First frame after `src` is set | 8.2 s | 3.5 s |
| Seek to 50% / 85% / 20% | 1.8 / 15.8 / 4.0 s | 3.3 / 7.7 / 4.0 s |
| 60 s of playback | no stalls, 0 dropped frames | no stalls, 219 of 2106 frames dropped |

- **So a cold start is about 16–21 s, not the 3–4 s DEMO.md 3.4 expected.** Most of it is opening the file (about 12 s), which can start as soon as the page loads, behind the poster, before Play is pressed.
- **Firefox:** not tested. From the `localhost` dev server, Playwright Firefox can't connect to any seed at all (WebRTC fails), but it does on the live loader, so test it there in step 2.
- **Codecs:** Chromium, Firefox and Playwright's Windows WebKit all say they can play WebM with AV1 and Opus. Windows WebKit isn't Safari, though. Real Safari decodes AV1 only on Apple hardware with an AV1 decoder (M3 Macs and later, iPhone 15 Pro and later), so this film probably won't play on older Macs or iPhones. **Confirmed on the Mac mini (M1, Safari), 2026-11-12:** `canPlayType` for WebM AV1 + Opus returns `""`, so Safari there can't play it. The same goes for every Mac before M3 and every iPhone before the 15 Pro. **Open decision for the user:** keep this film and say so on Safari, upload an H.264 MP4 copy (about 250 MB), or pack a short clip.

- **The replacement, uploaded by the user (12 November 2026):** `b1d797857bfb241c5123164b86cb78882f78d24c0d57a5567cbc67739bf7f13c`, 64 records (63 chunks and the DataMap), 239.4 MB as the CLI counts it, 3.43 ANT plus 0.000012 ETH gas. It is Blender's `bbb_sunflower_1080p_30fps_normal.mp4` with the AC-3 5.1 track dropped (`ffmpeg -map 0:0 -map 0:1 -c copy -movflags +faststart`): H.264 High 1920×1080 at 30 fps, MP3 stereo, index at the start, 251,070,017 bytes, 10 min 35 s, 3.2 Mbit/s. `media-probe.mjs` confirms the network copy is the same.

## Cinema, step 2: the media bridge in the loader's worker (built 2026-11-12; not deployed)

- **The bridge:** `vite.config.ts` appends the pinned SDK's `autonomi-stream-sw.js`, in its own function scope, to the built `autonomi-loader-sw.js`, in dev and in builds alike, so it always matches the installed SDK. A site passes `serviceWorkerUrl: "/autonomi-loader-sw.js"` to `createMediaSource`.
- **Order matters:** the loader's code comes first. In Chromium, once one fetch listener has answered, later listeners never run. So the loader's listener sees `/__autonomi_stream/` URLs first, notes them and steps aside, and the bridge's listener answers them.
- **What the loader notes:** once per media session, the file's name, size and type (from the stream URL; the page chooses them) in `/_autonomi/streams.json` in the meta cache. The info page shows them under "Streamed from Autonomi". The worker never sees the address: the page opens the file and the worker only relays byte ranges.
- **Reserved:** archive files under any `__autonomi_stream/` folder are listed as ignored, since the bridge would answer those paths first.
- **Tests:** the new `fixtures/stream` site plays its own clip through the bridge, answering the worker's range requests as the SDK's page side does (`stream.js`). `stream.spec.ts` covers playback and seeking, exact byte ranges with the bridge's headers (206, 416, `sandbox`, `nosniff`), and the info-page listing. Chromium 70/70 and unit 75/75 pass; Firefox passes all three stream tests, and WebKit the two that don't decode the clip.
- **Real SDK on mainnet through the loader's worker** (dev server, Playwright Chromium, the new film, `type=video/mp4` set on the URL):

| | Run 1 | Run 2 |
| --- | --- | --- |
| `createMediaSource` (opens the file) | 6.8 s | 6.1 s |
| First frame after `src` is set | 1.7 s | 3.0 s |
| Seek to 50% / 85% / 20% | 2.6 / 12.5 / 14.8 s | 4.5 / 11.8 / 11.1 s |
| 60 s of playback | no stalls, 0 dropped frames | no stalls, 0 dropped frames |

- **So a cold start is about 9–10 s,** about half the AV1 film's. Most of it is opening the file, which Cinema can do as the page loads. Seeks far from what has already played take 11–15 s, so Cinema's status line should say so while it seeks.
- **Still to do:** Firefox and Safari with the real SDK, on the live loader once Cinema exists (step 3). Deploy this loader change before uploading Cinema.

## Cinema, step 3: the site (built 2026-11-12, in Fable; live the same day)

- **The site** (`sites/cinema/`, name `cinema`, second in `CONTENT_SITES`): one page with the poster, a play button, a status line, the "Streamed so far" counter, this visit's timings, the "No video host." claim, three points on how it works, small print and credits. Its look is described in `sites/README.md`.
- **The player** (`src/player.js`, bundled by Vite with the Autonomi client when the site is built):
  - connects and opens the film as soon as the page loads, behind the poster, and attaches it with `preload="metadata"`;
  - play pressed early waits and starts as soon as the film is open; pressed when ready, it starts at once;
  - once playing, the browser's own controls take over; a status line returns only while a seek or stall lasts over 0.7 s;
  - the counter adds up the byte ranges the worker asks the page for, counting each part once;
  - failures say what happened on the screen, with "Try again" (no WebRTC, no service workers, can't connect, film not found, can't decode, stopped mid-film).
- **Archive:** 6.1 MiB, the same bytes on every build. The client's upload worker, with a second copy of the WebAssembly, is left out.
- **Policy:** Cinema exports its whole CSP as `csp` (new in `build.mjs`): the shared policy plus `'wasm-unsafe-eval'` and `connect-src 'self' https: wss:`.
- **Measured locally** (the fixture loader, Playwright Chromium, the film from mainnet):

| | Pressed early | Pressed when ready (two runs) |
| --- | --- | --- |
| Connected | 0.9 s | 0.8 s, 0.9 s |
| Film found | 5.4 s | 6.1 s, 6.7 s |
| First frame after play | 8.9 s (most of it waiting for the film to open) | at once, 0.4 s |
| Streamed after 10 s of film | 12 MB | 11 MB, 13 MB |

- **Tests:** `cinema.spec.ts` checks the page, its policy, the address toggle and an early press, with no network. `CINEMA_LIVE=1` adds a test that streams from mainnet: play, the counter, a seek to the middle, and the info-page listing. All pass in Chromium; Firefox passes the three that need no network. `warm.spec.ts` now counts only the page's own fetches, since Start's cards fetch two sites in the background.
- **Not yet checked:** real Firefox and Safari, which need Cinema on the live loader; and Start v2's Cinema card by eye.
- **Published (2026-11-12):**
  - Cinema: `e4b5d6a0…2e705`, 4 records, 0.2411 ANT.
  - Start v2: `648bfeb9…49e76`, 0.2285 ANT; it adds Cinema's card and the card warm-up. Start's pointer was updated to it.
  - Before Start was uploaded, a local loader against mainnet installed Cinema by name in 7 s, and the film's first frame came 0.9 s after play.
  - The loader was then deployed with `cinema` in `names.json`. The user checked it live and reports that it works.

## The Download Button: the Antnet version (ported 2026-11-12; not uploaded)

Ported from github.com/DavidMc0/autonomirror at `4a2d8e3` (7 November 2026), following DEMO.md 3.6. It is the download page and the button generator, without uploads or payments. It still looks like Autonomirror; the design pass is for Fable.

- **Layout:**
  - `sites/download/src/` holds Autonomirror's TypeScript (`download.ts`, `generator.ts`, `lib/`), with `removals.ts` and `main.ts` added.
  - `views/` holds each view's markup, taken from Autonomirror's two HTML pages.
  - `static/` holds Autonomirror's CSS, the fonts (Inter and IBM Plex Mono, Latin subsets) and `theme.js`.
  - `site.mjs` builds one `index.html` holding both views as `<template>`s, and bundles `src/main.ts` with the client into `app/`.
- **Shared bundling:** the bundling moved to `sites/shared/bundle.mjs`, used by both Cinema and the Download Button. Cinema rebuilds to the same archive, so its upload is still current.
- **One page, two views** (`"spa": true`, so every path serves the page):
  - `/` is the generator;
  - `/f/ant/<address>?n=&s=` is the download page;
  - `/d/?a=…` (Autonomirror's old form) moves to the new form, keeping the name and size.

  Each view loads its own stylesheet and script only when it is shown.
- **Buttons point at `https://download.antnet.autonomirror.com/f/ant/…`** (`PUBLIC_BASE` in `site.mjs`, given to the page in a `<meta>`).
- **Changes for Antnet:**
  - the theme script moved to `static/theme.js` (no inline scripts);
  - a top-bar link to Antnet Start, and the receipt under the footer;
  - the download line now reads "This page and this file both come from the Autonomi network… Free to download."
- **Policy:** the site's own `csp` adds the client's needs, plus `style-src 'unsafe-inline'`, for the button preview only (see `sites/README.md`).
- **The removal list** (`src/lib/removals.ts`, DEMO.md 3.6):
  - **On the download page:** the page reads the list through its pointer while it checks the file, with a 45 s budget. A listed file is refused as soon as the list arrives.
  - **At Download:** Chrome and Edge open the save window first (`showSaveFilePicker`, which creates no file), wait for the list, then stream into that file. Other browsers download into memory, wait for the list, then save. So a quick click can't get round the list.
  - **On the generator:** it refuses to make a button for a listed file.
  - **It never fails closed.** Until a pointer is recorded, there is nothing to check.
  - **The list file:** `{ v: 1, updated, sha256: [...] }`, where each entry is the SHA-256 of an address's lowercase hex text.
- **Publishing the list** (`sites/removals.mjs`, run by hand):
  - put addresses in `publish/removals.txt`, one per line with `#` comments (gitignored);
  - `node sites/removals.mjs` writes `publish/removals.json` and prints the upload command;
  - `node sites/removals.mjs record …` notes the uploaded address and prints `ant pointer create` the first time and `ant pointer update` after that;
  - the pointer's key is `publish/removals.key`, and `node sites/build.mjs record removals-pointer …` records its address, which is built into the site.
- **Tests:**
  - **Unit:** Autonomirror's own tests for addresses, sizes, links, progress and snippets, ported to `tests/unit/download/`. The snippet tests run under jsdom, added as a dev dependency at Autonomirror's 30.1.1. There are also tests for the list and the publishing script. 195 unit tests in all.
  - **Browser:** `download.spec.ts` checks the two views, the old-link move, a broken link, the pre-filled generator, the preview's styling and that the policy raises no errors. `DOWNLOAD_LIVE=1` adds a real download of `lucky.jpg` from mainnet: it streamed, verified and showed its hash in 11 s. Chromium 78/78.
- **Not yet tested:**
  - **Refusing a listed file in a browser:** the logic is unit-tested, but no list is published yet.
  - **Firefox's in-memory download from mainnet:** Playwright's Firefox can't connect from `localhost`.
  - **Real Safari.**
- **Removal list pointer (2026-11-12):** `f3e9e13c…7ae9`, recorded and built into the site. Its key is `publish/removals.key`, which is gitignored; the user was asked to back it up. No list is published yet.
- **Design pass (2026-11-12, in Fable):** the user was happy for it to keep Autonomirror's look, which already sets it apart from the other sites. The pass changed how it works as an Antnet site:
  - **Download page:**
    - the "Autonomi app" route is a closed `<details id="app-route">`, which the script opens when the browser route fails (blocked or error);
    - the "This page and this file both come from the Autonomi network" line is a mint-edged callout with a strong first sentence;
    - a removed file sets `#app[data-refused]`: nothing lit, no badge, no other route offered, and the title "Not available".
  - **Generator:**
    - the embed code runs across the bottom, HTML beside Markdown and the link, where it used to leave a hole under step 2;
    - long code no longer pushes the card off a phone's screen;
    - the "Also show the full address" label is normal weight.
  - **Antnet pieces:** the Start link carries Antnet's three-dot mark; the receipt sits under the footer behind a hairline; the top bar wraps to two lines on phones.
  - **Checked by screenshot:** connecting, ready, downloading, done, blocked, error, removed (stood in for by hand, since no list is published), broken link, and the generator empty and checked, in dark and light, at 1280, 390 and 320 px. No sideways scroll.
  - **Tests:** unit 195/195; Chromium 79/79 with `DOWNLOAD_LIVE=1`, including the real download.
- **Before uploading:**
  1. Decide whether Cinema's "Download this film" and the Library's EPUB buttons (DEMO.md 3.6) go in the same round. Each means re-uploading that site, and Start lists every site's size.
  2. Upload `publish/sites/download.tar` and record it, then Start v3 and its pointer, then deploy the loader so `names.json` carries `download`.

## Demo download buttons: done and live (2026-11-13)

The user asked for the demo buttons before publishing, and for EPUB buttons on all four books.

- **Done, uncommitted:**
  - `sites/shared/button.mjs` makes a button with the generator's own `snippets.ts` (via Vite's `runnerImport`). It turns each inline style into a class in `download-button.css`, so Cinema and the Library keep `style-src 'self'`.
  - **Cinema:** a "Take a copy home" section under the claim, with the Dark button for the film, linking through `/_autonomi/go/name/download/f/ant/…`.
  - **Library:** each book page has a Light "Download The Time Machine.epub" button on its cloth header, with the note "The Standard Ebooks EPUB, unchanged". A book whose EPUB isn't recorded yet gets no button.
  - **`node sites/build.mjs record file <path> <address>`** records a file's address and size in `sites/addresses.json` under `files`, keyed by file name.
  - **Checked by screenshot**, with a stand-in address that was then removed: both buttons, at 1280 and 320 px, with no sideways scroll and no policy errors.
- **The EPUBs** are downloaded to `publish/epub/` (gitignored):
  - `h-g-wells_the-time-machine.epub`
  - `robert-louis-stevenson_the-strange-case-of-dr-jekyll-and-mr-hyde.epub`
  - `arthur-conan-doyle_a-study-in-scarlet.epub`
  - `oscar-wilde_the-importance-of-being-earnest.epub`
- **Tests:** unit 195/195. Chromium 77 passed, with 1 failure in `m3.spec.ts:114` ("pointer sites get the loader's check script"): `page.request.get` gets ECONNREFUSED to 127.0.0.1:4173. It fails the same way with these changes stashed, so it isn't caused by them. Look into it separately.
- **Published 2026-11-13:**
  - The four EPUBs, recorded under `files`. Each SHA-256 matched the file on disk.
  - Library v2 `f5c75fa5…cd521` (0.2849 ANT), Cinema v2 `b3d7795e…0c651` (0.2306 ANT), Download Button `161b69a0…e48b6` (0.2665 ANT), Start v3 `bcdc36d7…77ae3` (0.4964 ANT). Start's pointer was updated to v3, and the loader was deployed with `download` in `names.json`.
- **Checked live** (scratch script, Chromium and Firefox): Start v3 shows the library, cinema and download cards. Cinema's button links to the film. In Firefox, The Time Machine's button opens the Download page in a new tab (the generator's snippets use `target="_blank"`), and the saved EPUB's SHA-256 matches the original. There were no console errors.
- **Fixed:** the `m3.spec.ts:114` ECONNREFUSED failure. The test made an unused `page.request.get` from Node, which went to IPv4 `127.0.0.1` while the preview server listens on `::1`. The request is removed, and e2e passes at 78 tests, with 2 skipped.

## ColonySim: built and designed; ready to upload (2026-11-13)

DEMO.md 3.3. Built in `sites/colonysim/`, at 26 KiB. It uses the shared policy, with no Autonomi client and no WebAssembly.

- **`src/sim.ts`:** the colony on a 192×120 grid. It is pure and seeded, so the same seed always gives the same colony. Searching ants lay "home" scent and carrying ants lay "food" scent. Each follows the other's, so trails form, bend round walls and fade once the food runs out.
  - The colony starts with 70 ants. A new ant costs 20 food, up to 420.
  - A day is 14,400 steps, about two minutes at normal speed.
  - A small windfall pile turns up every sixth of a day while food is low, so an idle colony keeps foraging.
- **`src/save.ts`:** saves to `localStorage` (`colonysim:v1`) on this site's own origin. It saves every 5 s, on `pagehide` and when the tab is hidden. Scents are rounded to 1/255. A save that is missing, broken or in another format starts a new colony. If storage is blocked, the page shows a line saying the colony won't be kept.
- **`src/render.ts`:** draws on a canvas. Every colour comes from a `--sim-*` CSS property, so the look lives in `static/style.css`.
- **`src/main.ts`:** the brushes (Food, Wall, Clear), drawn by dragging and working with touch; Pause; Faster (×4); Start a new colony; and the corner line ("Day N of your colony…").
- **Start:** ColonySim is second in `CONTENT_SITES`, after the Library. Start already had an icon for it.
- **Tests:**
  - 9 unit tests (`tests/unit/colonysim/`): determinism, foraging and growth, walls, windfalls, days, the save round trip, and broken saves.
  - One e2e test in `demo.spec.ts`: the colony runs, a wall is drawn, and after a reload the colony is restored, still running, with the same wall and founding date.
  - The warm-up test now counts only the Library's own fetches: ColonySim's card is still warming when it clicks.
  - Totals: 204 unit and 79 e2e tests pass.
- **Checked by screenshot:** light, dark and 360 px, with no sideways scroll and no console errors.
- **Design pass (Fable, 2026-11-13).** The look is described in `sites/README.md`. The simulation and the saving are unchanged.
  - **`src/render.ts` was rewritten.** It draws textured sand, pebble walls, the nest's mound, torn leaf for food and ants with legs. Sand and pebbles are drawn once and kept; pebbles are redrawn only when the walls change. Trails are blurred at twice the grid's size, so they have soft edges.
  - **Day and night:** the last third of each colony day is night (`nightness()`): a blue wash, trails added back as light, a glow from the nest and fireflies. Fireflies are left out under `prefers-reduced-motion`.
  - **`src/main.ts`:** a ring the size of the brush follows the pointer; keys F, W, C, space and full stop; a "Day N" banner when a day begins; a "Paused" note; the time of day beside the counts.
  - **`site.mjs` and `static/style.css`:** new markup and styles. Fredoka (Latin subset, 30 KB, Open Font License) is in `static/fonts/` with its licence. The archive is 84 KiB.
  - **The colony's colours** are the `--sim-*` properties, the same in light and dark: the tray keeps its own clock.
  - **Checked by screenshot:** light and dark at 1280 px, and a 360 px phone, by day and by night; the day banner, the paused state and the keys. No sideways scroll and no console errors.
  - **Tests:** 204 unit and 79 e2e pass.
- **Next:** upload ColonySim, then Start v4 and its pointer, then deploy, so `names.json` carries `colonysim`.

## DEMO.md: the Download Button site (added by the user, 2026-11-11, late)

Section 3.6 adds **Download Button**: Autonomirror's download page and button generator as an Antnet site named `download`, with links of the form `/f/ant/<address>?n=&s=`. It makes six sites, adds a step to the script, and is built after Cinema in section 10. Notes for building it:

- **The site's CSP must loosen as Cinema's does:** export the whole policy as `csp` in its `site.mjs`, with `'wasm-unsafe-eval'` and `connect-src 'self' https: wss:` for the bundled SDK. No autonomirror.com entry is needed.
- **The Library's "Download as EPUB" button means a Library v2 upload.** Upload it together with Start v2.
- **`/f/ant/…` paths are fine:** the loader reserves only `/_autonomi/…`, and `"spa": true` serves deep links and reloads.
- **Removal list, decided 12 November:**
  - It is read only from Autonomi, through a pointer, as a file of SHA-256 hashes of the removed addresses. Nothing is fetched from autonomirror.com.
  - It never fails closed. Only listed files are refused, on every loader.
  - The user publishes the copies by hand, with a funded wallet. Build a script that writes the file of hashes and prints the upload and pointer commands (DEMO.md 3.6).

### Next

1. **Next:** the Download Button (DEMO.md 3.6). It reuses Cinema's set-up: the SDK bundled into the site, its own `csp`, and the loader's worker. Then ColonySim and the Docs.
2. **In DEMO.md section 10's order:**
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
