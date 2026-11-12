# Antnet demo plan

*Drafted 11 November 2026, against the repository at `ad9e575` (milestones M1–M3); short names added the same day (section 5.9). Updated that evening with the decisions in section 11: the loader is at `antnet.autonomirror.com`, the app is called ColonySim, and short names are built. The Download Button site (section 3.6) was added later that evening. A plan for a small set of linked sites that shows what Antnet does and leaves people wanting more of it.*

## 1. What the demo has to do

**In one sentence:** a visitor clicks one link and browses six real websites that no web server sent them: their browser fetched each one directly from Autonomi nodes and checked it.

**Three things a visitor should leave knowing**

1. Websites can live on a network instead of on a server, and still open from an ordinary link in an ordinary browser.
2. Their own browser checked every byte, so nobody in between could alter what they saw.
3. Each site was paid for once, and anyone can publish one with three commands.

**How it earns excitement without asking for it**

- **Say it plainly, then show the evidence.** Start states at the top that no server sent the page. Everything below backs that up with this visit's own numbers, and lets the visitor see where the page came from.
- **Every claim has a number from this visit beside it.** "4 records, 212 kB, checked in your browser, arrived in 9.2 s" persuades better than any adjective.
- **One surprise per site** (section 3), and one for the whole tour: seeing the nodes a page came from (section 4.5).
- **Be honest about limits.** A short "fine print" list (section 4.4) makes the rest more believable.
- **End on an invitation:** "What would you put here?", with the three commands.

**Words to avoid:** forever, unstoppable, uncensorable, revolutionary, Web3. Prefer: "paid for once", "no renewal", "stored for the life of the network", "no server sent this page".

---

## 2. The visitor's journey (about three minutes)

| Step | What they see | What it teaches |
| --- | --- | --- |
| 1. **Front door** (ordinary web page on the root domain) | "This is the last page a web server will send you." Three short lines on what happens next, a progress line as Antnet Start arrives from the network, then an **Enter** button. | The handover from the old web to the new one, and it hides the slowest wait behind reading time. |
| 2. **Antnet Start** (the hub), at `start.antnet.autonomirror.com` | A calm directory of five sites. Under the title, a receipt: where this page came from, in real numbers. Each card shows its site arriving in the background, then "Ready". | Sites come from the network as a few verified records. |
| 3. **Any site** | Opens at once, because it was fetched while they read. It is a different website with its own look and its own short address: `docs.antnet.autonomirror.com`, `cinema.antnet.autonomirror.com`. | This is a web of independent sites, not one app. |
| 4. **Where it came from** | Start's "Where this page came from" panel: the records that made up the page and the nodes that served them. Technical visitors can open their browser's developer tools and see that no web request fetched the site's content. | There really is no server: the page came from many independent computers, and the browser can prove it. |
| 5. **A new site appears** (live demos and the video) | The presenter publishes a site and updates Start. A line appears: "A newer version of this page is available." After a reload there is a sixth card. The earlier version of Start is still there at its own link. | Sites can be updated by their owner, and old versions don't disappear. |
| 6. **Your turn** | Three commands, the cost of the last publish, how to claim a short name, and a link to the repository. | It is open to them, down to a name of their own. |

---

## 3. The sites

Every archive stays under 12 MiB so it is four network records. Each site has its own visual style so the set feels like a web. Two small shared pieces tie them together: a "Start" link and the receipt (section 4).

### 3.1 Antnet Start — the hub

- **Link type:** pointer, the only one in the demo, under the short name `start` (section 5.9). People see and share `start.antnet.autonomirror.com`.
- **Content, top to bottom:**
  1. Title, then one prominent line, in larger type than anything except the title (section 4.5 has alternatives):
     > **This site wasn't sent by a web server. Your browser fetched it directly from Autonomi nodes and checked every piece itself.**

     Then a quieter line: "A small web of sites that live on the Autonomi network."
  2. **The receipt** for this page (section 4.1).
  3. **The directory:** one card per site with a one-line description, its size, and a live status (section 5.2): "Arriving… 2 of 3 records", then "Ready".
  4. **How this reached you:** a five-step strip (connect, find, fetch, check, hand over) with this visit's own timings on each step. Link to this site's info page at `/_autonomi/` for the full detail.
  5. **Where this page came from** (section 4.5): the records and the nodes that served them.
  6. **Earlier versions:** a list of Start's previous versions, each an immutable link. "Every version ever published is still there."
  7. **Publish your own:** the three commands, what the last publish cost, and **Claim a short name** (section 5.9).
  8. **Fine print** (section 4.4).
- **Surprise:** what's behind the short name. A line under the receipt: "`start` is a short name for this site's address on the network, `p4x…` (show the full address on click). That address is also how your browser knows nothing was changed."

### 3.2 Autonomi Developer Docs — unofficial mirror

- **Content:** the official developer docs (182 Markdown pages, about 2 MB of source), built with an ordinary docs generator that has built-in local search, such as VitePress or Astro Starlight.
- **Licence:** the `autonomi-developer-docs` repository is MIT and Apache-2.0. Keep the copyright notice, link to the source and name the commit it was built from. The licence covers the text, not the Autonomi name or logo as a brand, so label every page "Unofficial mirror" and don't use the logo.
- **What it shows:** a large multi-page site from a standard toolchain runs unchanged, search included.
- **Surprise:** "The documentation for the network, served by the network."
- **Check:** the built site is under 12 MiB, uses `"notFound": "404.html"` and has no absolute links back to the original host.

### 3.3 ColonySim — an app, not a page

*Named ColonySim, not Colony: Colony was an app on Autonomi 1.0.*

- **Content:** a small ant-colony simulation on a canvas. Ants forage and lay trails; the visitor drops food and obstacles and watches the trails re-form. The colony saves itself in the browser as it runs.
- **Why this app:** it is original (nothing to license), on theme, lovely to watch in a video, and small.
- **What it shows:** real applications work, not just documents. The colony is still there after a reload, with no account and no server.
- **Surprise:** a line in the corner, "Day 3 of your colony. It lives in your browser, on this site's own address."
- **Settings:** `"spa": true` if it uses client-side routes.

### 3.4 Cinema — streaming video

- **Content:** the full *Big Buck Bunny* in 1080p, **streamed from its own address on Autonomi**, not packed into the site: public file `b1d797857bfb241c5123164b86cb78882f78d24c0d57a5567cbc67739bf7f13c` (H.264 and MP3 in MP4, index at the start, 251 MB, uploaded 12 November 2026 for 3.43 ANT; it plays in every browser). The earlier candidate, `a6fbc263…e7a1a`, is AV1 in WebM, which Safari can't play on Macs before M3 or iPhones before the 15 Pro (PROGRESS.md). Credit: "© 2008 Blender Foundation, bigbuckbunny.org, CC BY 3.0".
- **What it shows:** a full-length film starts in a few seconds and seeks anywhere, with no video host. The site itself is small; the film is fetched piece by piece as it plays.
- **How:** the Cinema page includes the browser SDK itself and plays the film with `client.createMediaSource(address, { serviceWorkerUrl: "/autonomi-loader-sw.js" })`. The SDK's own media bridge handles the byte-range requests; the loader's worker passes them through to it (section 5.8). Reading needs no wallet.
- **What to expect:** SDK 0.1.5's own mainnet audit measured the first frame at about 3 s typical in Chromium, with some over 6 s, and a seek to 85% of a 55 MB video at 2–4 s. Add about a second for the page to connect. Measured in Playwright Chromium and WebKit only, not real Firefox or Safari.
- **Page design:** the poster frame (an image in the archive) shows at once, with a play button and a slim status line: "Connecting to Autonomi…", "Fetching the first pieces…", then nothing once it plays. A small live counter under the player: "Streamed so far: 38 MB from the Autonomi network."
- **Surprise:** a caption under the player: "No video host. This film streams from Autonomi nodes, and its publisher pays nothing more however many people watch."
- **Size:** the SDK's WASM is about 6 MB, so the archive is about 7 MB, still within four records.
- **Policy:** if Cinema sets a `Content-Security-Policy`, it must allow `'wasm-unsafe-eval'` for the SDK.
- **Checks before building on it:**
  - Confirm the address is a public file the SDK can open, and note its size and format (MP4 with H.264 plays in every browser; check whether its index is at the start or the end, since the SDK primes both).
  - Pass `primePlayback: true`: from a bare address the SDK may not know the file is a video. If it isn't served as `video/mp4`, check Safari, which is stricter about media types than Chrome.
  - Play, pause, seek to the middle and the end, and leave it playing for ten minutes, in Chrome, Firefox (which stops idle workers after 30 s; the SDK's keep-alive messages handle this) and Safari.
- **Fallback:** if streaming isn't reliable enough by demo day, pack a 60–90 second 720p clip (about 8 MB, `-movflags +faststart`) into the archive instead. The loader already plays and seeks those.

### 3.5 Library — durable publishing

- **Content:** three or four short public-domain books as clean HTML, from Standard Ebooks (which dedicates its editions to the public domain). A plain, bookish design with a contents page and comfortable reading type.
- **What it shows:** publishing with no hosting bill. The receipt here leads with the date and cost: "Published 14 November 2026. Paid for once. No renewal."
- **Surprise:** "This shelf has no server behind it."
- **Check:** the books chosen are public domain where the audience is, not only in the US, and Standard Ebooks' own logo and name aren't used as branding.

### 3.6 Download Button — Autonomirror on Antnet

*The current Autonomirror proof of concept (the download page and the button generator), published as an Antnet site, without sign-in, uploads or payments. The Autonomirror MVP spec, section 20, covers it from that side.*

- **Name:** `download`, so `download.antnet.autonomirror.com`. Download links look like `download.antnet.autonomirror.com/f/ant/<address>?n=<name>&s=<size>`.
- **What it shows:** a download page for files on Autonomi that is itself on Autonomi. Neither the file nor the page is sent by a server; the browser fetches both from the network and checks them. And anyone can make a button for their own file.
- **How:**
  - The page bundles the browser SDK, like Cinema (archive about 7 MB, within four records).
  - `"spa": true`, so every `/f/ant/…` path serves the page with its query string kept, and reloads and deep links work. Old `/d/?a=…` links are redirected by the page.
  - **Chrome and Edge** save through the save picker with `streamAndSave()`, which must stay the first thing awaited in the click handler. **Other browsers** use the buffered download, up to the SDK's 1 GB default.
  - A media preview, if the page has one, uses the loader's merged media bridge (section 5.8). If the page uses its own service worker to stream saves in Firefox or Safari, that worker's handler is merged into the loader's worker the same way: an origin can have only one.
  - The generator's base URL for links and embed codes is a build setting, set to `https://download.antnet.autonomirror.com`.
- **Files to download in the demo:**
  - **Cinema** gets a "Download this film" button made with the generator, so the demo shows an embed in use. The film is large, so on stage it only starts.
  - **Library** gets a "Download as EPUB" button for one book (Standard Ebooks publishes EPUBs of its public-domain editions; upload one as a public file). It finishes in seconds and shows the verified hash.
- **Removal list** (decided 12 November 2026; section 11):
  - **Where the page gets it:** first live from autonomirror.com, which must allow the Antnet origin with CORS. If that fails, from the newest copy on Autonomi, found through a pointer that only Autonomirror's key can move. The page reads the pointer in parallel, since it is connecting to Autonomi anyway.
  - **Never in the archive,** because older versions of the page stay readable and can't be updated. Every version follows the pointer, so all of them get the latest list.
  - **Copies are published whenever the list changes,** from wherever the key is, not by the web server. So an outage doesn't make the list go stale.
  - **Never fails closed.** Only listed files are refused. If neither list can be read, every other file still downloads, and the buttons never stop because a server is down or gone. If Autonomirror's server disappears for good, the last copy stays in force indefinitely.
  - **Applies on every loader:** it is Autonomirror's page and Autonomirror's list. Autonomirror is responsible for downloads through its own server, gateway and list, not for what others build on Autonomi.
  - **The copies hold SHA-256 hashes of the removed addresses, not the addresses,** so a permanent public copy isn't an index of removed files. The page hashes the address it is asked for. If the server's list holds plain addresses, consider switching it to hashes too.
  - **Who publishes the copies:** Autonomirror's own code, or a script run by hand for the demo. Still to decide.
- **Surprise:** a line under the button: "This page and this file both came from the Autonomi network. Free to download." After a download, the page shows the hashes it checked.
- **Wording:** Autonomirror's rules apply: "free to download", never "free mirror", "forever" or "can't be taken down".
- **Checks:** a cold open of a `/f/ant/…` link; a reload on that link; a save through the picker in Chrome; a buffered download in Firefox and Safari; the hash shown matches the file's published SHA-256; the generator's snippets point at the Antnet address.

### 3.7 The guest site — published during the demo

- **Content:** a single page, "Hello from 14 November", made in front of the audience.
- **What it shows:** how little it takes to publish, and Start updating to include it (journey step 5). It gets the name `hello` by the same claim route visitors use (section 5.9).

### Not included: a copy of autonomi.com

It would make a strong sixth site, but only with the Autonomi Foundation's agreement. The site isn't openly licensed, a full copy of an organisation's homepage on another domain looks like an imitation of it, and an upload can't be withdrawn. If they are willing, the best version is one they publish themselves and hold the pointer key for: "the Autonomi website, served from Autonomi".

---

## 4. Shared pieces

### 4.1 The receipt

A small script every demo site includes. It reads the loader's own record for the site and prints one line in the footer (Start shows it prominently):

> No server sent this page. It arrived as **4 records** (**212 kB**) from the Autonomi network in **9.2 s** and was checked in your browser. Address `9ea6…e9e1`. [Details](/_autonomi/)

- **Where the numbers come from:** the state record the loader writes at install: the Cache Storage cache `autonomi-loader-meta`, entry `/_autonomi/state.json`, fields `records`, `bytes`, `timings.totalMs`, `archive`, `installedAt`. Site code shares the origin, so it can read it with the Cache API. (A plain `fetch` of that path won't work; reserved paths go to the network.)
- **If the record is missing** (the site was opened some other way), the receipt hides itself.
- **Date:** each site's footer shows its publish date, fixed when the archive is built for upload (`sites/build.mjs`).
- **Cost:** an archive can't contain the cost of its own upload, so the cost is recorded afterwards (`record <site> <address> --cost "…"`) and shown on Start, which is built later.

### 4.2 The Start link

Every site has a small "Antnet Start" link in its header, written as a portable name link so it works on any loader domain that carries the Antnet names: `/_autonomi/go/name/start/` (section 5.9).

### 4.3 One look per site

Different type and colour for each site, the same quiet footer on all. Light and dark themes. No trackers, no external fonts or scripts: everything a site needs is in its archive, so nothing on any page comes from anywhere but the network. The two exceptions are reads from Autonomi itself (Cinema's film, the Download Button's files) and the Download Button's removal list, if it keeps one.

### 4.4 Fine print (on Start)

- A first visit to each site takes several seconds while it is fetched and checked. Return visits are instant.
- Some networks block the kind of connection this needs. If a site won't load, try another network.
- These are static sites and apps. There is no server-side code.
- A small share of content on the network can't yet be reached from browsers.
- The first page (the loader) still comes from an ordinary web host. It is small, open source, and anyone can run their own.
- Short names like `cinema.antnet.autonomirror.com` come from a directory kept by Antnet, in public. The address behind each one is shown on its info page.
- Antnet is an independent proof of concept, not an Autonomi Foundation product.


### 4.5 Where this page came from

The tour-wide moment: the visitor sees that the page came from many independent computers, not one server.

- **On Start,** a panel lists the records the page arrived as, and for each one the node that served it (a short form of its peer ID) and how long it took. The panel's header: "This page came from N computers on the Autonomi network." The same panel is on every site's info page.
- **Data:** ant-client #249 (merged 4 November, in ant-core 0.15.0) names the serving node in each record's progress message: "Downloaded chunk 3/147 from <peer> after 1 attempts". **SDK 0.1.5 doesn't include it yet;** its WASM was built before that change. Until an SDK release carries it, the panel shows the records and their sizes, the node that served the DataMap (which SDK 0.1.5 does report), and when each chunk arrived, and says the other nodes will be listed once the client reports them. **Built:** the loader parses the message, including the peer when present, and stores `recordList` and `arrivals` in the state record.
- **Don't add maps or locations.** Peer IDs say nothing about where a node is, and looking up node IP addresses to place them on a map would be guesswork and would expose node operators.
- **For technical visitors:** a line under the panel: "Check it yourself: open your browser's developer tools and reload. In the Network tab, every file of this site is marked as served by the service worker, from your browser's own storage. None was requested from a web server: the site arrived over direct connections to the nodes." (The Network tab does list the site's files, so saying it shows no request would be wrong.) In Chrome, `chrome://webrtc-internals` lists the connections while a site is being fetched.

**Wording for Start's top line.** Pick one; all are accurate, because the shell came from the host but the site's content came from the nodes:

1. "This site wasn't sent by a web server. Your browser fetched it directly from Autonomi nodes and checked every piece itself." (recommended)
2. "No web server sent you this page. It came straight from computers on the Autonomi network, and your browser verified it."
3. "Served by the network, not a server: your browser fetched this site from Autonomi nodes and checked it."

Avoid saying the *loader* page didn't come from a server: it did, and the fine print says so.

---

## 5. Loader work the demo needs

Measured on mainnet so far (PROGRESS.md): a cold open takes about 8–14 s, the first pointer read on a new connection about 19 s, and a warm open 41 ms. Five cold waits in a row would sink the demo, so most of this section is about moving the waiting to where the visitor is reading.

### 5.1 Front door (root-domain landing page)

Replace the fixture list in the production build with the front door from journey step 1. It warms Antnet Start in the background (5.2) and enables **Enter** when it is ready. A visitor can also click early and watch the normal loading screen.

### 5.2 Warm-up: install a site before it is clicked

- **New reserved path `/_autonomi/warm`:** the shell installs the site as usual, but doesn't reload into it. It reports progress and the result to its parent window with `postMessage`, and only to a parent on the same loader root.
- **Use:** the front door opens Start's warm path in a hidden frame. Start does the same for each card, one site at a time, in card order. A portable link reaches it without the site needing to compute labels: `/_autonomi/go/name/<name>/_autonomi/warm`. Warm the **name's** origin, since that is the one the visitor will open.
- **Why it should work:** all sites are subdomains of one registrable domain, so a frame and a later top-level visit use the same storage. **This is untested.** Check it in Chrome, Firefox and Safari. It stops working if the loader's domain is added to the Public Suffix List, because browsers would then keep framed and top-level storage apart, so don't file that request before the demo.
- **If it doesn't work in a browser,** nothing breaks: the cards stay "Not fetched yet" and a click shows the normal loading screen.
- **Say what it is.** Start's cards show the fetching as it happens. Prefetching is a normal web technique; hiding it would undercut the honesty the demo depends on.

### 5.3 Updates that never block

With SDK 0.1.5 the first pointer read on a new connection takes about 17–20 s on mainnet. The check budget was raised from 5 s to 25 s on 11 November, so checks now succeed, but a visit to Start stalls for about 20 s whenever a check is due (once an hour). That makes this section a priority: do it alongside warm-up (5.2), which uses the same hidden-frame mechanism. A named site whose name points to a fixed address also checks hourly, but only re-reads `names.json`, which takes a fraction of a second.

- **For the demo:** stop the service worker holding navigations for checks. Add a reserved path `/_autonomi/check` that runs the check in the background with a 30 s budget and posts the result to its parent. Start embeds it in a hidden frame after it loads, and shows "A newer version of this page is available. Reload" when the pointer has moved.
- This is the "background update checks" item from the spec's later options, done the cheap way: the site opts in by embedding the frame.

### 5.4 Loading screen

It will still be seen: by anyone who clicks early, follows a deep link, or uses a browser where warm-up fails. Make it part of the story:

- the site's address, then live steps: "Connected", "Found", "2 of 3 records", "Checked", "Opening";
- one line of context: "Fetching this site from the Autonomi network. First visits take a few seconds.";
- after 20 s, a second line: "Still looking. Some records take longer to find."

### 5.5 When it can't connect

A plain page instead of an error: "Your network blocks the connection Antnet needs. Try another network, or watch the 90-second tour." Link to the video (section 8).

### 5.6 Hosting

A deployed HTTPS host with wildcard DNS and a wildcard certificate, serving the built shell for every subdomain and path. Needed before anything can be shared, and for Safari testing.

### 5.7 An address bar for Autonomi sites

From any Antnet site, a visitor should be able to type another site's address and go there, the way they would on the web. There are two ways to do it, and the demo uses both.

**A. The browser's own address bar (do this first)**

Every Antnet address is an ordinary URL, so the browser's real address bar only needs a keyword:

- The front door's `<head>` links an OpenSearch description (`<link rel="search" type="application/opensearchdescription+xml" href="/_autonomi/opensearch.xml" title="Antnet">`). Its search URL is `https://<loader root>/?open={searchTerms}`, which the landing page already handles.
- **Chrome and Edge** add it automatically after a visit; the keyword can be set to `ant` in their search settings. **Firefox** offers it in the search bar's menu. **Safari** doesn't support custom keywords.
- Then from anywhere: Ctrl/Cmd+L, type `ant`, a space and an address (64 hex, `0x…`, an `ant://` link, or a path form), then Enter.
- **Accept more input forms at `?open=`:** a full Antnet URL from any loader, and a short name (section 5.9), so `ant cinema` in the address bar goes to `cinema.antnet.autonomirror.com`. Anything that isn't recognised shows the landing page with the input filled in and an explanation.
- Start's "Publish your own" section gets a one-line tip: "Add Antnet to your browser: then type `ant` and an address in the address bar."

No code runs in the sites, nothing can be spoofed, and the trusted address bar shows where the visitor is going.

**B. An in-page shortcut (the "wow" moment)**

The loader adds a small address box to every site, opened with a keyboard shortcut.

- **How it gets in:** when the service worker serves an HTML file, it inserts `<script src="/_autonomi/bar.js" defer></script>` as the first element of `<head>`. The script is a reserved loader file served from the site's own origin, so a site policy of `script-src 'self'` still allows it. A site whose policy blocks it simply has no bar.
- **Shortcut:** the default is **Alt+Shift+A**. Pages can't override Ctrl/Cmd+L or Ctrl/Cmd+T, and Ctrl/Cmd+K is already used for search on many sites. The script listens on `window` in the capture phase, ignores key presses while focus is in a text field, and shows a small hint the first time a visitor opens any site: "Press Alt+Shift+A to open another Autonomi site."
- **The box:** drawn inside a shadow DOM, so the site's styles can't change it. It shows the current site's address (read from the hostname), accepts the same inputs as `?open=`, lists the sites visited in this browser on this loader, and has a link to this site's info page. Enter goes to the target's loader URL; Escape closes it.
- **Recent sites:** each site's origin keeps its own storage, so a shared list needs a reserved path on the root domain that the bar reads and writes through a hidden frame with `postMessage`. Until that is built, the box shows only the current site.
- **Opting out:** `"loaderBar": false` in `.autonomi-site.json`.
- **Say what it is:** the info page notes that the loader adds this one script to the site's HTML. It is loader code, not the publisher's, which matters because the receipt says the page was checked in the browser.
- **It is not a security feature.** Site code shares the origin, so a hostile site could draw a lookalike box. The destination's info page always shows the true address. The browser's own address bar (option A) is the trusted route.

**Tests:** the shortcut opens the box on a plain site, an SPA and the Docs; it doesn't fire while typing in Docs search; each input form reaches the right site; a site with a strict policy or `"loaderBar": false` loads normally with no bar; the box looks the same on a site with aggressive global CSS.


### 5.8 Streaming media from a site

Sites run as ordinary pages after the handover, so a site that wants to stream a large file from Autonomi brings the browser SDK itself and holds its own connection while it plays. The SDK needs a service worker to turn the player's byte-range requests into reads, and an origin can have only one, which is the loader's. The SDK supports exactly this case: merge its media bridge into the existing worker and pass that worker's URL.

- **Loader worker:** before its own rules, hand any same-origin request whose path contains `/__autonomi_stream/` to the SDK's range handler, taken from `autonomi-stream-sw.js` in the **same pinned SDK version** (about 6 kB). Keep the SDK's `message` listener; Firefox needs the page's keep-alive messages to reach it.
- **Rebuild the loader worker whenever the SDK version changes,** and keep the merged handler's tests next to the loader's own.
- **Site side:** `createMediaSource(address, { serviceWorkerUrl: "/autonomi-loader-sw.js" })`. The SDK refuses to replace a different worker on the same scope, so the site must pass the loader's URL, not the default.
- **The page must stay open** while the video is in use; closing the tab stops the stream, as on any website.
- **Info page:** list "streams from Autonomi" with the addresses the site opened, so visitors can see what it fetched beyond its archive.
- **Later:** serve the SDK from a reserved loader path (`/_autonomi/sdk/…`) so sites don't each carry 6 MB, and a declarative form such as `<video src="/_autonomi/stream/<address>">`. Both put more loader code into site pages, so leave them until the demo has proved the simple version.


### 5.9 Short names

Addresses on the network are 64 characters long, which is right for checking content and wrong for people. Antnet adds a small directory of short names, so a site can be `cinema.antnet.autonomirror.com` instead of `p` plus 52 characters. The demo ships with hand-picked names, and visitors can claim their own.

**Hand-picked names for the demo**

| Name | Site | Points to |
| --- | --- | --- |
| `start` | Antnet Start | Start's pointer |
| `docs` | Autonomi Developer Docs (unofficial mirror) | its archive address |
| `colonysim` | ColonySim | its archive address |
| `cinema` | Cinema | its archive address |
| `library` | Library | its archive address |
| `download` | Download Button | its archive address |
| `hello` | The guest site | claimed live (journey step 5) |

**Rules for every name**

- Lowercase `a–z`, `0–9` and hyphens; 1 to 32 characters; no leading, trailing or double hyphen (which also rules out internationalised `xn--` names). ASCII only, so no lookalike letters from other scripts.
- Address labels are always exactly 53 characters, so a name can never be mistaken for one.
- **Reserved:** the demo names above, plus `www`, `api`, `admin`, `mail`, `static`, `cdn`, `assets`, `loader`, `antnet`, `official`, `support`, `help`, `login`, `wallet`, `pay`, and anything starting `autonomi`. Also `ant`, `p`, `i` and `name`: the first three would clash with the root-domain address paths (`/ant/<address>`, `/p/ant/<address>`) and the label prefixes, and `name` with name links.
- **A name points to a pointer or to an archive address.** A pointer is best: the publisher updates the site by re-pointing it, and the name never changes. A name on an archive address needs a directory change for each new version, which suits the hand-picked demo sites.
- **One name per claim,** first come, first served.

**The directory**

One file in the antnet repository, `names.json`, deployed with the loader:

```json
{
  "v": 1,
  "updated": "2026-11-14T12:00:00Z",
  "names": {
    "start":  { "kind": "p", "address": "<64 hex>", "since": "2026-11-14" },
    "cinema": { "kind": "i", "address": "<64 hex>", "since": "2026-11-14" }
  }
}
```

- **Served at `/_autonomi/names.json` on every host,** so it is same-origin for every site and needs no CORS. It is small and changes rarely, so it is fetched from the host rather than from Autonomi: reading it from the network would add a second pointer read (about 19 s on a new connection) to every first visit.
- **The repository's git history is the public record** of every name and change. Later, also publish each version of `names.json` to Autonomi behind its own pointer, so anyone can check the directory without trusting the host, keep its history, or run a loader with it.

**How the loader resolves a name**

- `classifyHost` treats a label that matches the name rules as a name. The shell looks it up, then carries on exactly as for the `p…` or `i…` link it points to. The site's origin is the **name's** origin, so `cinema.antnet.autonomirror.com` keeps its own storage.
- The state record stores the name beside the link it resolved to: `"name": "cinema", "nameSince": "2026-11-14", "link": { "kind": "i", "address": "…" }`. It also stores `declaredName`, the name the site gives itself in its settings.
- **Unknown name:** a friendly page: "No site is called `bunny` here yet." The "Claim it?" link is added with the claim form.
- **Changes:** when an update check is due, the check re-reads `names.json` first. If the name now points somewhere else, it installs the new target; if the name has been removed, the site stops being served. Once checks run in the background (section 5.3), this shows the same "newer version" notice.
- **Links between sites:** `/_autonomi/go/name/<name>[/path]` redirects to `https://<name>.<this loader>/path`, keeping the query and fragment. On the root domain, `antnet.autonomirror.com/<name>` redirects to the name's site when the name is registered, which is easy to say aloud.
- **Info page:** shows the whole chain: `cinema` → archive `9ea6…e9e1` (or `start` → pointer `ddab…4699` → archive `5423…41b3`), with how the name was resolved and the date it was registered.

**Claiming a name (visitors can try this)**

For the demo, claims go through a GitHub issue form in the antnet repository. It costs nothing to run, every claim and decision is public, and it needs no server.

1. **Publish a site** as usual, and add the name to its settings file before packing it:
   ```json
   { "format": "autonomi-site/1", "name": "bunny" }
   ```
2. **Open the claim form.** Start's "Claim a short name" button links to a prefilled new issue (`/issues/new?template=claim-name.yml&name=…&link=…`) with two fields: the name, and the site's `p…` or `i…` link or address.
3. **A GitHub Action checks the claim:**
   - the name follows the rules and is free;
   - it fetches the site through the link (pointer resolve, then the archive; reading needs no wallet) and reads `.autonomi-site.json` from the archive;
   - **the site must name itself `bunny`.** Only whoever controls the pointer (or published the archive) can put that there, so this proves the claim without the owner key ever touching a web page or form.
4. **If it passes,** the Action commits the new entry to `names.json`, comments with the link `https://bunny.antnet.autonomirror.com/`, closes the issue and triggers a redeploy. If it fails, it comments with the reason.
5. **Keeping names honest:** a weekly job re-checks every claimed name. A site that stops naming itself (its owner re-pointed it at something else) gets a comment, and the name is released after 14 days.

- **The check can reuse the repository's existing mainnet tooling**, or the `ant` CLI (`ant pointer resolve`, `ant file download`). Whether GitHub's runners can reach Autonomi nodes is untested. If they can't, the maintainer runs the same script locally (`node tools/claim-check.mjs <issue>`) and the Action only applies the result.
- **Limits:** one claim per GitHub account per day. Names can be removed for abuse under a short published policy, linked from the form.
- **Later:** a claim page on Antnet itself, with no GitHub account needed, backed by a small service that runs the same check.

**What a name does and doesn't promise**

- **Antnet controls the names**, so it could reassign or remove one. Because names point to pointers or fixed addresses, it can never change what a site contains, only which site a name leads to. The info page always shows the full chain.
- Names belong to this loader's directory. On a loader that doesn't carry it, a name link shows the unknown-name page; `p…` and `i…` links work everywhere.
- Add a line to the fine print (section 4.4): "Short names like `cinema.antnet.autonomirror.com` come from a directory kept by Antnet, in public. The address behind each one is shown on its info page."

**Built on 11 November** (`src/names.ts`, `tests/e2e/names.spec.ts`): name hosts, name links, the root path form, the info page chain, due checks and the unknown-name page. The claim form, the Action and the weekly re-check are still to do.

**Tests:** each hand-picked name opens its site; the info page shows the chain; an unknown name shows the claim page; a name that fails the rules (uppercase, too long, `xn--`, a 53-character label) is never looked up; the go-link and root-path forms redirect correctly; a changed `names.json` entry is picked up by the next due check; a claim whose site doesn't name itself is rejected with a clear reason.

---

## 6. Links and publish order

A site's address is the hash of its contents, links included, so two sites can't link to each other by address: each would need the other's address before it exists. **Short names break the circle.** Every demo site links to the others by name, and names are only filled in once the addresses exist.

```
                    start.antnet.autonomirror.com  (pointer, so its owner can update it)
           links by name to   docs · colonysim · cinema · library · download
                               │       │        │         │          │
           each links back by name to  start
```

**Order**

1. **Make Start's key and note its address.** The address is known before the pointer exists.
   ```bash
   ant pointer keygen --output publish/start.key      # back this up; it can't be recovered
   ant pointer address --key publish/start.key        # → START
   ```
2. **Build and publish each content site, in any order,** with links by name: `/_autonomi/go/name/start/`, and where wanted `/_autonomi/go/name/docs/` and so on. Put the site's own name in its `.autonomi-site.json`.
   ```bash
   node tools/pack.mjs sites/library/dist publish/library.tar
   ant file upload publish/library.tar --public       # → LIBRARY (repeat for the others)
   ```
   Note the cost of each upload for its receipt.
3. **Open each site by its `i…` link in a clean browser profile.** If one fails on a missing record, re-pack with `--nonce` and upload again.
4. **Build Start** with cards linking by name, publish it, and create the pointer.
   ```bash
   node tools/pack.mjs sites/start/dist publish/start-v1.tar
   ant file upload publish/start-v1.tar --public      # → START_V1
   ant pointer create --key publish/start.key <START_V1>
   ```
5. **Write `names.json`** with `start` → the pointer and each content name → its archive address, and deploy the loader.
6. **To add a site later** (the live moment): publish it with its name in its settings, claim the name (section 5.9), build Start v2 with the new card and a link to `START_V1` under "Earlier versions", upload, then `ant pointer update --key publish/start.key <START_V2>`.

`node sites/build.mjs` does the bookkeeping: it builds every archive into `publish/sites/`, prints the next commands, keeps the addresses in `sites/addresses.json` (`record <site> <address>`), and writes `names.json` from them, so addresses are never typed by hand.

---

## 7. Running it live, or recording it

**Before the audience arrives:** open the front door once on the presenting machine in a fresh profile and check all cards reach "Ready". For a live talk, keep a second fresh profile for the real run and a recording as backup.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Front door. Progress line running. | "This is an ordinary web page. It's the last one a server will send us." |
| 0:20 | Enter. Start opens instantly at `start.antnet.autonomirror.com`. Point at the receipt. | "This page came from the Autonomi network: four records, checked here in the browser. No server sent it." |
| 0:40 | Cards turning to "Ready". Open the Docs, search for something. | "A normal docs site, built with normal tools." |
| 1:00 | ColonySim. Drop food, watch trails form. | "And real apps. This one saves itself in the browser." |
| 1:20 | Cinema. Press play; it starts in a few seconds. Drag the playhead to the middle, then near the end. | "A full-length film in HD, streaming straight from the network. No video host, and its publisher pays nothing more however many people watch." |
| 1:35 | Library. Press "Download as EPUB": the download page opens, saves the book in seconds and shows the hash it checked. | "A download page that is itself on the network. Neither the page nor the file came from a server. Anyone can make one of these buttons." |
| 1:50 | Back to Start. Open "Where this page came from". Optionally, developer tools: the Network tab marks every file of the site as served by the service worker, none by a web server. | "No server. This page came from these computers on the Autonomi network, and the browser checked every piece." |
| 2:10 | Terminal: pack and upload the guest site, claim `hello`, update Start's pointer. | "Publishing is three commands, and you pay once. And it gets a name, like any website." |
| 2:35 | Start shows "A newer version is available". Reload: sixth card. Open "Earlier versions". | "The owner can update a site. The old version is still there." |
| 2:45 | Open `hello.antnet.autonomirror.com`. Press Alt+Shift+A, type `library`, Enter. | "And getting around works like the web: type a name, and you're there." |
| 2:55 | "Publish your own" section. | "What would you put here?" |

The upload, the name check and the pointer update take real time. In a recording, cut them. Live, start them before the 1:50 step and narrate over the wait.

---

## 8. Share kit

- **The link:** the root domain (the front door). After Enter, visitors land on `start.antnet.autonomirror.com`.
- **A 90-second screen recording** of section 7, captioned, no voice needed. It is also the fallback for people whose network blocks the connection.
- **One still image:** Start with the receipt and all cards "Ready".
- **Two sentences for a post:** "Six websites with no web server behind them, including a download page. Your browser fetches each one directly from the Autonomi network and checks it."
- **For the Autonomi community:** the measurements, the repository, and an invitation to publish a site, claim a name for it, and have it listed on Start.

---

## 9. Checks before sharing

- [ ] Fresh-profile run of the whole journey in Chrome, Firefox and Safari on desktop, and Chrome on Android. Record what warm-up does in each.
- [ ] Ten cold opens of the front door from at least two different networks. Note the time until **Enter** enables and any failures.
- [ ] Every site opened by its `i…` link from a clean profile after publishing.
- [ ] Return visits: every page of every site, video seeking, ColonySim's saved state and Docs search work without fetching again.
- [ ] A network that blocks UDP (many office and guest networks): the "can't connect" page appears, with the video link.
- [ ] Start's update notice appears after a pointer update, and "Earlier versions" opens v1.
- [ ] The `ant` keyword works in Chrome and Firefox, and Alt+Shift+A opens the in-page bar on every demo site.
- [ ] Licence and credit lines present: Docs (MIT/Apache, source and commit, "Unofficial mirror"), Cinema (Blender Foundation, CC BY 3.0), Library (public-domain status).
- [ ] Every archive under 12 MiB; no site requests anything from outside its own archive, except reads from Autonomi (Cinema, Download Button) and the Download Button's removal list.
- [ ] Download Button: the checks in section 3.6, plus the EPUB and film buttons on Library and Cinema.
- [ ] Cinema: ten cold plays in Chromium; note time to first frame and to each seek. Ten minutes of continuous playback in Chrome, Firefox and Safari.
- [ ] Every hand-picked name opens its site, and a test claim goes through the GitHub form and Action end to end, including a rejected one.
- [ ] `publish/start.key` backed up somewhere other than the laptop.

---

## 10. Build order

1. **Start and one content site** (the Library is the simplest), with the receipt and Start link. Publish, and prove the link plan end to end.
2. **Hosting** on a real wildcard domain, with **name resolution and the hand-picked `names.json`** (section 5.9). Names simplify every link after this.
3. **Warm-up and the front door.** This decides how slick the demo can be, so test it early.
4. **Non-blocking updates** and the update notice.
5. **Cinema streaming first** (section 5.8): it is the riskiest piece and the most impressive, so prove it early. **Then the Download Button** (it reuses the same SDK setup), **ColonySim and Docs.**
6. **Loading screen, "can't connect" page and the address bar** (section 5.7): the OpenSearch keyword first, as it is small, then the in-page shortcut.
7. **The name claim form and Action**, tested with a throwaway site.
8. **Checks, recording, share.**

## 11. Open decisions

- ~~**Domain** for the demo.~~ Decided 11 November: the loader root is `antnet.autonomirror.com`, on the user's VPS. (`antnet.site` was considered; it isn't owned.)
- ~~**Download Button removal list:** when the list can't be fetched, fail closed everywhere, or only on `antnet.autonomirror.com`?~~ Decided 12 November: never fail closed. The live list comes first, then the newest copy on Autonomi through a pointer, and only listed files are refused, on every loader. Details are in section 3.6. This differs from the Autonomirror MVP's fail-closed rule (MVP spec, section 20), so update that spec to match.
- **Names policy:** are a GitHub account and a one-claim-a-day limit the right bar for the demo, and is 14 days the right release period for a name whose site stops claiming it?
- **Address bar shortcut:** is Alt+Shift+A the right default, and should the in-page bar be on for every site or only for sites that opt in?
- ~~**Is Colony the right app?**~~ Decided: keep the simulation, named ColonySim.
- **Ask the Foundation** about the docs mirror label and about publishing autonomi.com themselves?
- **Pointer read time.** About 19 s on a new connection is the demo's slowest step. Warm-up hides it. Raised with the SDK maintainers on 11 November (`docs/sdk-issue-read-latency.md`).
- **Offline.** Installed sites keep working without a connection, and the tests cover it, but the demo doesn't make a point of it: that is normal for anything a browser has already downloaded.
