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

### Next

1. **Commit and push** this work (asked; awaiting the user's answer).
2. **Then, in DEMO.md section 10's order:**
   - warm-up and the front door;
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
