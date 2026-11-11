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

## M3 (pointers and updates): fixture tests done, mainnet `before` done, waiting on the re-point

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

### Next

1. **The user** re-points: `ant pointer update --key site.key 5423f9da…41b3`.
2. **Run** `node tools/m3-mainnet.mjs after ddabf062… --budget 30`.
3. **The user** decides the budget or background-check question above.
3. **M4** (links between sites): see the upload-order note in the M2 hand-off above; one side must be a pointer.
4. **M5:** upload the bench archives, then do ten cold opens each with `npm run probe`.
