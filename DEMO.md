# Antnet demo plan

*Drafted 11 November 2026, against the repository at `ad9e575` (milestones M1–M3); short names added the same day (section 5.9). Updated that evening with the decisions in section 11: the loader is at `antnet.autonomirror.com`, the app is called ColonySim, and short names are built. The Download Button site (section 3.6) was added later that evening. Antnet Local, the loader as a desktop app, and its page on the demo site were added on 13 November (sections 3.8 and 12). Also on 13 November: the front door's claim and the script's opening line were corrected, because the host sends each site's loader page the first time that site is opened (journey step 1, sections 4.5, 5.10 and 7). On 19 November: phase 2 of Antnet Local, with the native client built in, a plan to offer the gateway to the Autonomi app, ant-ui, so it can browse and publish sites, and a browser fork considered and set aside (sections 12.10–12.13), an "Open in the Autonomi app" button that hands a hosted link to the app (section 5.11), and Autonomi's own browser extension, ant-webex, adopted as the extension route instead of building one (section 12.11). Also a proof-of-concept plan to show all this to the community and the Autonomi team (section 12.14). Later on 19 November, step 0 of that plan was checked against Autonomi's own code (ant-ui, ant-webex and antd, read from the GitLab mirrors because `github.com/WithAutonomi` returned 404). antd already provides the native reads the gateway needs, so the gateway now passes requests to antd instead of linking its own client (sections 12.10, 12.11 and 12.14), and ant-ui already uses `autonomi://` for file links (sections 5.11 and 12.11). A plan for a small set of linked sites that shows what Antnet does and leaves people wanting more of it.*

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
| 1. **Front door** (ordinary web page on the root domain) | "A web server sent you this page, and it will only ever send this small loader. It never sends the sites." Then: "Each one comes straight from Autonomi, a network of independent computers. Your browser fetches it itself, and checks every piece before showing it." Then a progress line as Antnet Start arrives from the network, then an **Enter** button. | The handover from the old web to the new one, and it hides the slowest wait behind reading time. |
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
  - **What it is for:** it refuses files on Autonomirror's list (copyright notices, illegal material, malware, phishing, breaches of the terms). It removes nothing from Autonomi; it only stops this page from handing those files out. Its main value is protecting the domain. Buttons made with the generator point at `download.antnet.autonomirror.com`, and browser blocklists tend to block whole domains, so one bad file could get the whole loader flagged. The list lets Antnet stop serving a reported file quickly.
  - **Where the page gets it: only from Autonomi.** The page reads it from the newest copy, found through a pointer that only Autonomirror's key can move. Nothing is fetched from autonomirror.com, so the page, the file and the list all come from the network. The page reads the pointer while it connects to fetch the file, so the check adds no wait.
  - **Never in the archive,** because older versions of the page stay readable and can't be updated. Every version follows the pointer, so all of them get the latest list.
  - **Copies are published by hand** by the user, with a funded wallet, whenever the list changes. A script in this repository builds the file of hashes and prints the upload and pointer commands. A removal takes effect once its copy is published.
  - **Never fails closed.** Only listed files are refused. If the list can't be read, every other file still downloads. The last published copy stays in force indefinitely.
  - **Applies on every loader:** it is Autonomirror's page and Autonomirror's list. Autonomirror is responsible for downloads through its own server, gateway and list, not for what others build on Autonomi.
  - **The copies hold SHA-256 hashes of the removed addresses, not the addresses,** so a permanent public copy isn't an index of removed files. The page hashes the address it is asked for.
- **Surprise:** a line under the button: "This page and this file both came from the Autonomi network. Free to download." After a download, the page shows the hashes it checked.
- **Wording:** Autonomirror's rules apply: "free to download", never "free mirror", "forever" or "can't be taken down".
- **Checks:** a cold open of a `/f/ant/…` link; a reload on that link; a save through the picker in Chrome; a buffered download in Firefox and Safari; the hash shown matches the file's published SHA-256; the generator's snippets point at the Antnet address.

### 3.7 The guest site — published during the demo

- **Content:** a single page, "Hello from 14 November", made in front of the audience.
- **What it shows:** how little it takes to publish, and Start updating to include it (journey step 5). It gets the name `hello` by the same claim route visitors use (section 5.9).

### 3.8 Antnet Local — run Antnet on your own computer

- **Name:** `local`, so `local.antnet.autonomirror.com`. Not part of the three-minute tour; linked from Start's fine print (section 4.4).
- **What it shows:** the last web host in the story can go too. The page offers Antnet Local (section 12), a small desktop app that serves the loader from the visitor's own computer, for Windows, macOS and Linux.
- **The installers are files on Autonomi**, downloaded through buttons made with the Download Button generator (section 3.6), with a GitHub Releases link beside each. So the page that offers the app, and the app itself, both come from the network.
- **Details are in section 12.8.**

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

Different type and colour for each site, the same quiet footer on all. Light and dark themes. No trackers, no external fonts or scripts: everything a site needs is in its archive, so nothing on any page comes from anywhere but the network. The one exception is reads from Autonomi itself: Cinema's film, and the Download Button's files and removal list.

### 4.4 Fine print (on Start)

- A first visit to each site takes several seconds while it is fetched and checked. Return visits are instant.
- Some networks block the kind of connection this needs. If a site won't load, try another network.
- These are static sites and apps. There is no server-side code.
- A small share of content on the network can't yet be reached from browsers.
- The loader still comes from an ordinary web host. The first time you open each site, the host sends the same small loader page, which then fetches the site from the network; the host never sends a site's content. The loader is small, open source, and its published build can be checked (section 5.10). Anyone can run their own, or run it on their own computer with [Antnet Local](https://local.antnet.autonomirror.com/) (section 12). In Antnet Local this line reads: "The loader runs on your own computer (Antnet Local, version x.y.z)."
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

Avoid saying the *loader* page didn't come from a server: it did, and the fine print says so. Also avoid saying any page is the *last* one a server will send. Each site has its own origin, and a service worker controls only its own origin, so the first visit to every site (including the hidden warm-up visits in section 5.2) fetches that site's loader page from the host. The accurate claim is that the host sends only the loader, never a site.

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
- after 20 s, a second line: "Still looking. Some records take longer to find.";
- in the footer, one quiet line that says where each part came from: "This loading page came from `antnet.autonomirror.com`. The site is coming from the Autonomi network." Visitors who notice the loading page between sites then hear it from the demo, not discover it.
- once the app exists, a small "Open in the Autonomi app" link (section 5.11).

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
- **The box:** drawn inside a shadow DOM, so the site's styles can't change it. It shows the current site's address (read from the hostname), accepts the same inputs as `?open=`, lists the sites visited in this browser on this loader, has a link to this site's info page, and, once the app exists, an "Open this site in the Autonomi app" item (section 5.11). Enter goes to the target's loader URL; Escape closes it.
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
| `local` | Antnet Local's page (section 3.8) | its archive address |

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


### 5.10 What the host sends: keep it small and checkable

The host has to answer the first request to every site's subdomain, because nothing else can run code on a new origin (section 4.5). It can't be removed from the hosted loader; Antnet Local removes it (section 12). What can be done is to make the host's part as small and as checkable as possible.

**A. A small stub per site, one shared loader.**

- Every subdomain gets the same stub page of about 1 kB. It registers the service worker and loads the loader's code (scripts, the SDK and its WASM) from fixed, versioned URLs on the root domain, such as `https://antnet.autonomirror.com/_autonomi/loader/<build hash>/…`, served with `Cache-Control: public, max-age=31536000, immutable` and the CORS headers the subdomains need.
- **Why it should help:** all the subdomains belong to one registrable domain, and browsers key their HTTP cache by the top-level site, so code fetched for Start should be reused, not downloaded again, when Cinema's stub asks for the same URL. **Untested;** check it in Chrome, Firefox and Safari. Like warm-up (section 5.2), it stops working if the domain is added to the Public Suffix List.
- **The stub loads each file with Subresource Integrity** (`integrity="sha384-…"`), so it runs only the exact build it names.
- **Result:** after the first site, the host sends a 1 kB stub per new site, never the loader's code again and never any site content. The service worker file itself must still come from each subdomain (a worker's script has to be same-origin), so keep it small.
- **What it doesn't change:** the stub still comes from the host, so a compromised host could still send a different stub. This reduces what the server sends; it doesn't remove trust in the server.

**B. A published, checkable loader.**

- Publish each loader build on Autonomi as a public file (the same tar format as a site), and keep its address and hash in the repository's release notes.
- The info page (spec section 3.6) shows "Loader build `<hash>`" with a link to the published copy, and the fine print points to it (section 4.4).
- Anyone who cares can then compare what their browser ran with the published build, so the host can't change the loader without that being visible. It also gives Antnet Local (section 12) a published build to match.

**Tests:** opening a second site after Start makes one small request to the host for the stub, and the loader's files are served from the browser's cache (developer tools, Network tab); a stub whose integrity hash doesn't match refuses to run and shows a plain error; the build hash on the info page matches the published copy.

### 5.11 "Open in the Autonomi app": from a hosted link to the local gateway

*Added 19 November 2026. Useful once Antnet Local (section 12) or the Autonomi app with the gateway (section 12.11) exists; until then the button stays hidden behind a build setting.*

A link someone shares, such as `cinema.antnet.autonomirror.com`, always opens on the hosted loader: the browser asks the web host, and nothing on the visitor's computer is involved. This button is the bridge to the local version. It is an ordinary `ant://` link for the same site; the app registers that scheme, so the operating system hands the link to the app, which opens the browser at the site's local address.

**What the visitor sees**

1. On the hosted loading screen or info page, a small secondary link: **"Open in the Autonomi app"**, with a second line, "Needs the Autonomi app or Antnet Local. Get it" (linking to the `local` page, section 3.8).
2. The first time, the browser asks whether to open the app ("Open Autonomi?"), with an option to always allow this site to open such links.
3. The app opens the browser at the local address, for example `http://cinema.autonomi.localhost:<port>/`, and the site loads through the gateway (section 12.10).

**The link**

- **It carries the resolved address, never only the name.** The hosted shell already knows the chain from its state record (section 5.9), so the button works even when the app has no names directory turned on (section 12.11):
  - an immutable site: `ant://<64 hex>`, the form ADR-0006 already defines for a public file;
  - a pointer site, or a name on a pointer: `ant://p/<64 hex>`. **ADR-0006 has no pointer form yet,** so this is Antnet's proposal; agree it with the Autonomi team before the app ships (section 12.11 questions);
  - a name, as a hint only: `?name=cinema` added to either form. The app uses it if its own directory maps that name to the same address, and ignores it otherwise.
- **The current path, query and fragment** are carried too, percent-encoded, so a deep link such as a Download Button page (`/f/ant/<address>?n=…&s=…`) opens at the same place.
- **The app maps the link** to `http://<root>:<port>/?open=<the link>`, and the local root page redirects as it does for any `?open=` input (section 5.7 A). Anything the app doesn't recognise opens the local root page with the input filled in.

**Where it appears**

- **Loading screen** (section 5.4): under the progress lines, from the start. It doesn't promise speed: "Open in the Autonomi app" only.
- **Info page** (spec section 3.6): beside "Open the site".
- **In-page address box** (section 5.7 B): an item "Open this site in the Autonomi app".
- **Start's fine print** (section 4.4): "Have the Autonomi app or Antnet Local? Open Antnet there", linking to `ant://p/<Start's pointer>?name=start`.
- **Not inside site pages** beyond the address box: sites don't need to change.

**Limits to state plainly**

- **The page can't tell whether the app is installed.** Without it, clicking the link does nothing in some browsers and shows an error in others, which is why the "Needs…" line and the Get it link sit beside it. Don't try to detect the app from the page by contacting localhost: Chrome would ask the visitor's permission first (section 12.8). The ant-webex extension can check without a prompt, so with it installed the button can be shown only when the app is running (section 12.11).
- **Saved data doesn't move.** The local site is a different origin, so ColonySim's colonies and other site storage start fresh there. Say so on the info page.
- **Not `autonomi://`.** The Autonomi app already registers `autonomi://` and treats `autonomi://<address>` as a file to download (section 12.11), so the button uses `ant://` for sites rather than changing what an existing link means.
- **One handler per computer.** If both Antnet Local and the Autonomi app are installed, the operating system chooses one for `ant://`. Both use the same crate (section 12.11), so either works; Antnet Local's installer should not take over the scheme from the Autonomi app if it is already registered.
- **It isn't automatic.** Sending every hosted link to the app without a click needs a browser extension: the changes requested from ant-webex (section 12.11).

**Tests**

- With the app installed: the button opens the same site locally from an immutable site, a pointer site, a named site and a deep link with a query and fragment, in Chrome, Firefox, Edge and Safari.
- Without the app: the click fails harmlessly and the "Needs…" line is visible.
- An app without names turned on opens a named site by its address; with names turned on and a matching directory, it opens the name's local address.
- A malformed or unknown `ant://` link opens the local root page with the input filled in, never an error from the app.

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
| 0:00 | Front door. Progress line running. | "This is an ordinary web page. The server sends the loader, never the sites." |
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
- [ ] Every archive under 12 MiB; no site requests anything from outside its own archive, except reads from Autonomi (Cinema; the Download Button's files and removal list).
- [ ] Download Button: the checks in section 3.6, plus the EPUB and film buttons on Library and Cinema.
- [ ] If Antnet Local is shared at the same time: the checks in section 12.9, and every installer on the `local` page matches its published SHA-256.
- [ ] Cinema: ten cold plays in Chromium; note time to first frame and to each seek. Ten minutes of continuous playback in Chrome, Firefox and Safari.
- [ ] Every hand-picked name opens its site, and a test claim goes through the GitHub form and Action end to end, including a rejected one.
- [ ] Nowhere does the demo claim that a page is the last one a server will send. The front door, Start, the fine print, the loading screen and the script all say the host sends only the loader (section 4.5).
- [ ] Section 5.10's tests, if the stub is built: shared loader files come from the cache on a second site, and the info page's build hash matches the published loader.
- [ ] If the "Open in the Autonomi app" button is enabled: the tests in section 5.11.
- [ ] `publish/start.key` backed up somewhere other than the laptop.

---

## 10. Build order

1. **Start and one content site** (the Library is the simplest), with the receipt and Start link. Publish, and prove the link plan end to end.
2. **Hosting** on a real wildcard domain, with **name resolution and the hand-picked `names.json`** (section 5.9). Names simplify every link after this.
3. **Warm-up and the front door.** This decides how slick the demo can be, so test it early.
4. **Non-blocking updates** and the update notice.
5. **Cinema streaming first** (section 5.8): it is the riskiest piece and the most impressive, so prove it early. **Then the Download Button** (it reuses the same SDK setup), **ColonySim and Docs.**
6. **Loading screen, "can't connect" page and the address bar** (section 5.7): the OpenSearch keyword first, as it is small, then the in-page shortcut. Then **the stub and the published loader** (section 5.10).
7. **The name claim form and Action**, tested with a throwaway site.
8. **Checks, recording, share.**
9. **Antnet Local** (section 12), after the demo is shared. Start with the Safari test in section 12.9: it decides the macOS story.
10. **Phase 2, the native client** (section 12.10), after Antnet Local's first release. Start by measuring the gateway path against WebRTC.
11. **The `antnet-gateway` crate and a conversation with the Autonomi team** (section 12.11), as soon as Antnet Local works. Then the ant-ui fork, the "Open in the Autonomi app" button on the hosted loader (section 5.11), and publishing from the app. **The proof of concept in section 12.14 is the fast route through steps 9–11:** it needs only the M1–M3 loader and can run in parallel with the demo.

## 11. Open decisions

- ~~**Domain** for the demo.~~ Decided 11 November: the loader root is `antnet.autonomirror.com`, on the user's VPS. (`antnet.site` was considered; it isn't owned.)
- ~~**Download Button removal list:** when the list can't be fetched, fail closed everywhere, or only on `antnet.autonomirror.com`?~~ Decided 12 November: never fail closed. The list is read only from Autonomi, through a pointer, and the user publishes it by hand. Only listed files are refused, on every loader. Details are in section 3.6. This differs from the Autonomirror MVP's fail-closed rule (MVP spec, section 20), so update that spec to match.
- **Names policy:** are a GitHub account and a one-claim-a-day limit the right bar for the demo, and is 14 days the right release period for a name whose site stops claiming it?
- **Address bar shortcut:** is Alt+Shift+A the right default, and should the in-page bar be on for every site or only for sites that opt in?
- ~~**Is Colony the right app?**~~ Decided: keep the simulation, named ColonySim.
- **Ask the Foundation** about the docs mirror label and about publishing autonomi.com themselves?
- **Pointer read time.** About 19 s on a new connection is the demo's slowest step. Warm-up hides it. Raised with the SDK maintainers on 11 November (`docs/sdk-issue-read-latency.md`).
- **Offer the gateway to ant-ui?** Section 12.11; first, ask the Autonomi team the questions listed there.
- **Offline.** Installed sites keep working without a connection, and the tests cover it, but the demo doesn't make a point of it: that is normal for anything a browser has already downloaded.
- **Antnet Local's name.** In Autonomi, a gateway usually fetches from the network on the browser's behalf, as AntTP does. The first release doesn't, so this document calls it Antnet Local. Phase 2 adds the native client (section 12.10), and "Antnet Gateway" then becomes accurate. Rename at phase 2, or use one name from the start? Inside ant-ui (section 12.11) it would be a feature, not a product, so it needs no name there.
- **Antnet Local's host layout and port:** `<label>.antnet.localhost` or `<label>.localhost`, and which fixed port (section 12.3).
- **Code signing budget** for Antnet Local: an Apple Developer ID and a Windows signing certificate or Azure Trusted Signing (section 12.7).
- **Open at login:** on or off by default for Antnet Local?

---

## 12. Antnet Local — the loader on your own computer

*Added 13 November 2026. Not needed for the demo's first share; build it after the steps in section 10. Nothing here has been tested yet.*

**In one sentence:** a small desktop app for Windows, macOS and Linux that serves the Antnet loader from the visitor's own computer, so opening an Autonomi site involves no web host at all. The loader comes from their machine, and every site still comes from Autonomi nodes over WebRTC and is checked in their browser.

**What it adds**

- **It removes the last caveat in the fine print** (section 4.4): that the loader comes from an ordinary web host. With Antnet Local, nothing on the internet takes part except Autonomi nodes.
- **It keeps working when `antnet.autonomirror.com` doesn't:** if the host is down, blocked on a network, or flagged by a browser blocklist.
- **`ant://` links open from anywhere on the computer** (email, chat, documents), because the installer registers the scheme with the operating system. A website can't do that.

**What the first release doesn't change:** it isn't faster, it can't reach records with no browser-reachable holder, and networks that block UDP still can't connect, because the browser makes the same WebRTC connections as before. Phase 2 (section 12.10) addresses the first two. It doesn't fix the third, because the native client's QUIC also runs over UDP.

### 12.1 Why a local server, not a downloaded HTML file

The loader depends on three things a page opened from a file (`file://`) doesn't get:

- **A service worker,** which only registers on http(s) origins. It serves installed sites and handles their navigations (spec section 3).
- **One origin per site.** Every `file://` page shares one opaque origin, so sites could read each other's storage.
- **A secure context,** which the SDK requires (HTTPS or localhost).

A loopback server fixes all three. Browsers treat `localhost` and names ending in `.localhost` as secure contexts and send them to the computer itself, so the loader runs unchanged, with one subdomain per site as on the hosted version. A single-file HTML loader (the site rendered into a sandboxed frame) was considered; it would break SPAs, storage and streaming, so it is left as a possible later option.

### 12.2 What the user sees

1. They download the installer for their system from the `local` page (section 12.8) and run it.
2. An Antnet icon appears in the system tray (Windows, Linux) or menu bar (macOS), and their normal browser opens at `http://antnet.localhost:<port>/`: the same front door as the hosted demo, then Start at `http://start.antnet.localhost:<port>/`.
3. From then on it behaves like the hosted version. The `ant` keyword (section 5.7 A) works the same way, through the OpenSearch description on the local root.

**Tray menu:** Open Antnet Start; Open an address… (a small box that accepts the same inputs as `?open=`, including a full `antnet.autonomirror.com` URL); Open at login; About (version, and whether updates are checked); Quit.

**`ant://` links** go to `http://antnet.localhost:<port>/?open=ant://…`, which the root page already handles.

**When the app isn't running,** installed sites should still open from the browser's own storage, because their service worker serves them without the host (spec rule 2). Only sites not yet installed, update checks and name changes need the app. This is expected from the spec's rules but untested here.

### 12.3 How it works

- **One binary** with the loader's production build embedded, built with the loader root set to `antnet.localhost:<port>`. It serves the shell for every host and path, exactly as the wildcard host does (section 5.6), with `index.html` and the service worker sent as `Cache-Control: no-cache`.
- **No network beyond loopback.** It listens on `127.0.0.1` and `::1` only. Its one outbound request is the optional update check (section 12.6).
- **Host layout.** Two choices, both untested:
  - `<label>.antnet.localhost`: every site shares the registrable domain `antnet.localhost`, as they share `antnet.autonomirror.com` when hosted. Warm-up (section 5.2) should work, and cookie isolation between sites is incomplete in the same way. **Recommended**, so the local and hosted versions behave alike.
  - `<label>.localhost`: each site is its own site, so cookies are fully isolated, but warm-up through frames probably breaks, because browsers keep framed storage from other sites apart.
- **A fixed port.** An origin includes its port, so a changed port orphans every installed site and its saved data (ColonySim's colonies, for example). Pick one unusual port. If it is taken at first launch, try a short fixed list of fallbacks, remember the one used, and show the address in the About box.
- **Loopback safety.** Reject any request whose Host header isn't `antnet.localhost` or a subdomain of it at this port, which blocks DNS-rebinding attacks. Serve only GET and HEAD, except the names endpoint (section 12.4), which accepts a write only with the root's own `Origin`. Chrome also asks the visitor before any public website can reach a local address. The app holds no keys or accounts, under the same rule as the hosted shell (spec section 4).

### 12.4 Names without a host

When hosted, `names.json` comes from the host (section 5.9). Locally there is no host to update it, so the item listed there as "later" becomes a requirement: **publish each version of `names.json` on Autonomi behind Antnet's own pointer.**

- **The app ships with a copy** of `names.json` from its build, so names work from the first launch.
- **Updating it:** whenever the front door or Start is open, a hidden frame on the root (`/_autonomi/local/sync`, the same mechanism as section 5.3) resolves the names pointer in the background, downloads the file (checked by the SDK) and sends it to the app with `PUT /_autonomi/local/names`. The app checks the format and the name rules, and keeps it only if its `updated` date is newer. Shells read `/_autonomi/names.json` from the app as before.
- **Publishing:** by hand, like the removal list (section 3.6). After the Action merges a claim, the maintainer runs a script that prints the upload and pointer commands. Local users see a new name once that copy is published.
- **Trust:** a stale copy can only point a name at an older target. The info page shows the full chain, as it does when hosted.

### 12.5 What changes on the sites

- **Nothing in the archives.** Portable links (`/_autonomi/go/…`), name links and `?open=` already work on any loader root.
- **Wording.** The loader knows it is local when its root ends in `.localhost`. Start's top line gains a second sentence there: "Even the loader came from your own computer." The fine print line about the web host changes as shown in section 4.4. The info page shows "Loader: Antnet Local x.y.z".
- **Links shared on the web** point at `antnet.autonomirror.com` and open there. To open one locally, use the hosted page's "Open in the Autonomi app" button (section 5.11), paste it into Open an address…, or use the `ant` keyword. Redirecting them automatically is one of the changes requested from Autonomi's ant-webex extension (section 12.11).
- **The Download Button** keeps its hosted base URL for links and embed codes. Opened locally, the download page works as usual.

### 12.6 Updates

- **Loader updates ship inside signed app updates.** The loader's code runs in every site's origin, so it should be as trustworthy as the app itself. The app's updater checks a signed manifest on GitHub Releases. This is the one request the app makes to anything but loopback; it can be turned off in the tray menu, and the `local` page says so.
- **Later:** loader releases published on Autonomi behind Antnet's pointer, read by the app itself once it has a native client (section 12.10), so updates need no server either.

### 12.7 Building and packaging

- **Rust and Tauri,** used for the tray icon and the installers, not as a browser. One codebase produces an MSI or NSIS installer for Windows, a universal DMG for macOS (Intel and Apple silicon) and an AppImage and `.deb` for Linux, plus a signed updater. A plain command-line binary (`antnet-local --port …`) for headless or power users comes from the same code.
- **`ant://` registration:** in the Windows installer (registry), the macOS app bundle (`CFBundleURLTypes`) and the Linux `.desktop` file (`x-scheme-handler/ant`). An AppImage doesn't register itself, so the `.deb` is the main Linux package.
- **Signing decides how polished it feels.** Unsigned apps get SmartScreen warnings on Windows and Gatekeeper warnings on macOS. macOS needs an Apple Developer ID and notarisation; Windows needs a signing certificate or Azure Trusted Signing. Until those are in place, label downloads "unsigned test build".
- **Where:** each installer is published as a public file on Autonomi and offered through the Download Button, with GitHub Releases beside it and the SHA-256 of every file on the `local` page.
- **Desktop only.** iOS doesn't allow an app to run a local web server in the background, and Android makes it awkward. Phones keep using the hosted loader.

### 12.8 The `local` page

A small Antnet site (section 3.8) in the demo's style, with its own look.

1. **Headline:** "Run Antnet on your own computer." Then one line: "The loader runs on your machine, so no web host takes part. Sites still come straight from the Autonomi network."
2. **Three benefits** from the top of this section: no web host, works when the website doesn't, `ant://` links from anywhere.
3. **Download:** the visitor's platform is detected and offered first, with the others below. Each entry has a Download Button link (the file on Autonomi), a GitHub Releases link, the size and the SHA-256.
4. **What it does on your computer:** runs one small program that serves pages to your own browser and nothing else; sends nothing anywhere except the optional update check; how to quit it and uninstall it. Installed sites stay in the browser until its site data is cleared.
5. **Limits:** desktop only; networks that block UDP still can't connect; Safari's status (section 12.9).
6. **Already installed?** A plain link: "Open Start in Antnet Local" (`http://start.antnet.localhost:<port>/`). The page doesn't try to detect the app, because Chrome would ask the visitor's permission first.

### 12.9 Tests

- **First, in a day:** a bare binary serving the loader on `*.antnet.localhost`, opened in Safari, Firefox and Chrome on macOS, and in Chrome, Edge and Firefox on Windows and Linux. Check that the names resolve, that the page is a secure context, that the service worker registers and that the SDK connects. Safari is the main unknown; if it fails, the app opens Start in another installed browser and the `local` page says Safari isn't supported yet.
- Every demo site opens from cold and from cache; video seeks; Docs search works; ColonySim's saved state survives quitting and restarting the app.
- Warm-up works under the chosen host layout.
- With the app quit: installed sites still open, and a site not yet installed shows the browser's ordinary connection error (nothing else can answer without the app; the `local` page explains this).
- A names update published through the pointer reaches the app and is picked up by the next due check.
- An `ant://` link opened from another app (an email client, a text editor) opens the right site.
- Port collision: a second program on the port makes the app use a fallback and show it.
- A request with a foreign Host header, and a names write from another origin, are both refused.
- Each installer installs, registers `ant://`, starts at login only when chosen, updates through the signed updater, and uninstalls cleanly.

### 12.10 Phase 2: the native client (Antnet Gateway)

*Added 19 November 2026. Build after Antnet Local's first release (section 10, step 9). Nothing here has been tested or measured. Revised the same day: the native reads come from antd, not from a client built into the app.*

Antnet Local's first release only serves the loader; the browser still fetches everything over WebRTC. Phase 2 puts the native Rust client (ant-core, from ant-client) behind the same app, so the app fetches from Autonomi itself. At that point it is a gateway in the usual Autonomi sense, and the product can be called **Antnet Gateway** (section 11).

**The native client is antd, not our own.** antd, Autonomi's local daemon (in `ant-sdk`, MIT or Apache-2.0, v0.17.0 on ant-core 0.15.0), already answers everything the endpoints below need. It reads a public file whole or as a stream with one HTTP byte range (`206` or `416`). It resolves pointers, reporting the target's kind, and reports network health with a peer count. So the gateway doesn't link a client. It is a small loopback server that serves the loader and passes the four endpoints to antd on its own loopback port. That means no network code of Antnet's own, and one native client shared with ant-webex, which also uses antd. Linking ant-core in-process stays possible later, behind the same endpoints (section 12.11, "One client or several").

**What it adds**

- **Every chunk.** About half of mainnet nodes never answer a browser's WebRTC dial, which leaves roughly 0.9% of records with no browser-reachable holder (spec section 2). The native client reaches nodes over QUIC, the network's normal transport, so it isn't limited to the browser-reachable half.
- **Faster in some ways, not all. Measured 19 November 2026** (`docs/measurements/2026-11-19-gateway.md`):
  - Pointers resolved about ten times faster (median 1.3 s against 14.4 s).
  - Sites antd had fetched before came back in 1–4 s against 9–31 s.
  - **A first fetch of a site antd hadn't seen was no faster,** and usually slower (12–31 s against 6–37 s). Don't claim "faster" in general.
- **Work without a page open.** The app reads pointers itself: the names pointer (section 12.4), update checks (section 5.3) and loader releases (section 12.6), with no hidden frames needed.
- **Networks that block WebRTC but allow other UDP** can connect. QUIC also runs over UDP, so **a network that blocks all UDP blocks the native client too.** On its own it doesn't fix the "can't connect" case in section 9; only a relay over TCP would.

**How the loader uses it**

- **Reserved loopback endpoints** on the root origin, answered by the app:
  - `GET /_autonomi/local/fetch/<address>?max=<bytes>`: downloads a public file (a site archive) and returns its bytes after checking every chunk. Passed to antd's `/v1/data/public/<address>/stream`. That call sends the file's size first, so the gateway refuses a file over `max` (`413`) before downloading it. A body that ends short of its size is an error, not a file. The gateway adds the content's BLAKE3 hash in a header, for the info page.
  - `GET /_autonomi/local/pointer/<address>`: resolves a pointer and returns its target and kind. Passed to antd's `/v1/pointers/<address>/resolve`.
  - `GET /_autonomi/local/stream/<address>`: a public file with HTTP range support, for media. Passed to antd's `/v1/data/public/<address>/stream` with the `Range` header.
  - `GET /_autonomi/local/status`: the gateway's version, whether antd answers, and antd's version and peer count, from antd's `/health`.
- **The shell tries the app first.** When the loader root ends in `.localhost` and `/status` reports a connected client, the shell fetches archives and pointers through these endpoints. If a call fails or times out, it falls back to the SDK over WebRTC, exactly as today. The hosted loader never calls them.
- **The loading screen and the receipt** say which path was used: "Fetched by Antnet Gateway on your computer" or "Fetched by your browser".
- **Streaming gets simpler.** A site can point a `<video>` at `/_autonomi/local/stream/<address>` and let the browser make ordinary range requests, with no SDK and no media bridge (section 5.8). Sites must still work without it, because the hosted loader and phones don't have it. This is the declarative form from section 5.8's "later" list, offered only where the gateway is present.
- **The Download Button** can save through the same endpoint, so large files download at native speed in every browser, not only Chrome and Edge.

**What changes in the claims**

- **Where checking happens.** On this path the app checks each chunk, not the browser. It is still on the user's own computer, so the receipt changes from "checked in your browser" to "checked on your computer", and the info page says which.
- **Avoid "faster" and "reaches everything"** until the tests below have numbers.

**Safety**

- The endpoints are read-only, accept only GET and HEAD, and get the same Host check as the rest of the app (section 12.3). No CORS headers are sent, so only pages on `*.antnet.localhost` can read their responses.
- **Any installed site can ask the gateway to fetch any address.** Each site can already do that through the SDK, so this adds no new power, but limit fetches in flight and the cache size so one site can't exhaust the machine.
- **No wallet and no uploads.** Phase 2 only reads. Publishing stays in the `ant` CLI, so the app still holds no keys (spec section 4).

**Packaging**

- antd runs beside the gateway as a separate program: either one the user already has (ant-webex's setup installs it), or one the app ships and starts, as ant-ui already does with its own daemon. The gateway's binary stays small.
- antd's version is pinned per release and updated through the signed updater (section 12.6), like the loader.
- antd opens outbound UDP connections to nodes. Some firewalls (Windows Defender Firewall, macOS's application firewall, Little Snitch) will ask the user to allow that on first launch, so the installer and the `local` page should say so.

**Tests**

- Each demo site opened through the gateway and through WebRTC, cold, ten times each, on two networks: time to open and failures.
- A record known to have no browser-reachable holder (from the census) loads through the gateway.
- With the client disconnected (network off, then on), the shell falls back to WebRTC and the receipt says so.
- Cinema plays and seeks through `/stream/`; the Download Button saves a 1 GB file through the gateway in Firefox and Safari.
- A network that allows UDP but blocks WebRTC, if one can be found or simulated: the gateway connects where the browser can't.
- A network that blocks all UDP: both paths fail, and the "can't connect" page appears.
- Requests with a foreign Host header or another method are refused; many parallel fetches from one site are throttled.

### 12.11 Inside the Autonomi app (ant-ui)

*Added 19 November 2026. A proposal to the Autonomi team, not something Antnet controls. Nothing here has been discussed with them yet.*

**The idea:** offer the gateway to ant-ui, the official Autonomi desktop app, so one app lets people upload and download files, run nodes, **browse Autonomi websites in their own browser, and publish sites of their own.** Start with a fork that shows it working, and aim for the team to adopt it upstream.

**Why ant-ui fits**

- **Same stack.** ant-ui is Tauri 2 with ant-core 0.15 linked in-process, the same ant-core release antd uses. The gateway becomes one more Rust component in an app that already connects to the network, not a new app.
- **It already has the pieces.** Checked in ant-ui's code on 19 November 2026 (MIT or Apache-2.0, the same as Antnet; version 0.9.10-rc.1):
  - It already runs a loopback HTTP server: its wallet bridge, built on axum, the same library as the gateway.
  - It already registers a link scheme, `autonomi://`, through Tauri's deep-link plugin, with single-instance forwarding on Windows and Linux. Today `autonomi://<address>?name=<file>` opens a file download.
  - It already ships a daemon beside the app (its `ant` binary, as a Tauri sidecar), which is how antd could ship too.
- **Its users already run it.** Node operators often leave the app running, which is exactly what a local gateway needs.
- **Signing and distribution are already solved.** The Foundation signs and ships ant-ui, removing the biggest cost and risk in section 12.7.
- **Publishing fits beside it.** ant-ui already uploads files and pays through WalletConnect, with the split payment flow keeping keys out of the app. Packing a folder, uploading it as a site and creating or updating its pointer are a short step from there.
- **Good for the network.** Every node operator gets a reason to browse Autonomi sites, and every site visitor sees a reason to install the app.

**Plan**

1. **Extract the gateway into its own crate, `antnet-gateway`,** with a narrow interface: pass in a back end for network reads (an in-process ant-core client, or a connection to a local daemon such as antd; see "One client or several" below), a port and a configuration (the names directory URL or pointer, whether update checks run); get back a running loopback server with the embedded loader and the phase 2 endpoints, plus a handle to stop it and to read its status. Antnet Local becomes a thin tray app around this crate.
2. **Ask the Autonomi team early,** before building the fork in earnest: an issue or discussion on ant-ui that links to a working Antnet Local, a short description of the crate, and the questions below.
3. **Fork ant-ui as a thin demonstration,** kept close to upstream:
   - one setting, off by default: "Open Autonomi sites in your browser";
   - a menu item, "Open an Autonomi site…", taking the same inputs as `?open=`;
   - `ant://` registration for sites beside the existing `autonomi://` for files, through the same deep-link plugin, handling the link forms in section 5.11 (including the proposed `ant://p/<address>` for pointers). The fork leaves `autonomi://<address>` meaning a file download, so upstream behaviour doesn't change;
   - antd shipped as a second sidecar and started with the gateway, unless one is already running;
   - a status line showing the gateway's address and whether it is running.
4. **Add publishing in a second step,** as its own pull request: choose a folder, pack it with the same deterministic packer as `tools/pack.mjs` (ported to Rust or shared), upload it, create or update a pointer, then open the result through the gateway to check it from a clean origin, as section 6 step 3 requires. Pointer keys follow ant-ui's existing key handling, and the app warns that a lost pointer key freezes the site's link.
   - The upload uses ant-ui's existing external-signer flow: the app prepares and quotes, the wallet pays, and the app finalises.
   - antd has the matching calls for pointers, `/v1/pointers/prepare` and `/v1/pointers/finalize`, beside `create` and `update`. It also lists pointer keys it holds (`/v1/pointers/keys`). **Check where antd keeps those keys** before choosing between antd and ant-ui's own client for pointer writes.
5. **Upstream pull requests,** small and separate: the gateway setting first, publishing second. The crate stays in its own repository, versioned, so ant-ui can pin it.
6. **Keep Antnet Local** as the standalone option for people who want to browse without running nodes or holding a wallet. Both use the same crate, so fixes land in both.

**The browser extension: ant-webex, not our own**

Autonomi already publishes a browser extension, ant-webex (MIT or Apache-2.0, Chrome and Firefox, version 0.2.2 on the stores as of 19 November 2026; source on GitHub at `WithAutonomi/ant-webex`, mirrored at `gitlab.com/autonomi/ant-webex`). Request changes to it instead of building an Antnet extension. *Checked against the GitLab mirror's code on 19 November 2026:* it is a Manifest V3 extension whose background worker finds antd (port 8082 by default, or the port antd writes to a file, read through a native messaging host), checks its health every 30 seconds, and fetches through it.

- **What it does now:** shows Autonomi content inside ordinary web pages. When a page references a file with an `autonomi://` link or embed, it fetches the file through **antd**, a local daemon running the native client, and shows it inline (images, video, audio, PDFs) or offers it as a download. It walks the user through installing antd, and asks for optional access to localhost.
- **What it doesn't do:** open whole websites with their own addresses, redirect hosted links, or handle `ant://` links.
- **Why it is the right base:** it is in both stores under Autonomi's name, it already has localhost access and a local native client, and it already onboards users to a local program. An extension with localhost access can also check whether the gateway is running without the prompt Chrome shows web pages (section 5.11).

**Changes to request from ant-webex**

1. **Open Autonomi sites through the local gateway when it is running.** Links to `antnet.autonomirror.com` (and any loader that declares itself, for example by a `<meta>` tag the shell adds) go to the same site's local address, carrying the resolved address, path and query as section 5.11 does. When the gateway isn't running, links open as usual. This is the automatic version of the "Open in the Autonomi app" button.
2. **Treat a link to a site archive as a site, not a download.** If the file is a tar archive with `index.html` at its root (the `autonomi-site/1` format, spec section 5), offer "Open as a website" through the gateway beside "Download".
3. **Tell the hosted loader when the app is available,** so the loading screen and info page show "Open in the Autonomi app" only when it will work.
4. **Agree one link scheme** (next paragraph).

**One link scheme.** ant-webex and ant-ui both use `autonomi://` (ant-ui as `autonomi://<address>?name=<file>`, opening a download); Autonomi's own link format (ant-client ADR-0006) uses `ant://<address>` and `ant://manifest/…`; and none has a pointer form or a way to say "open this as a site". Ask the team to settle on one scheme, with a pointer form (Antnet proposes `ant://p/<address>`, section 5.11). Until then the app should accept both schemes, and Antnet's own links use `ant://`.

**One client or several.** As planned, ant-webex, ant-ui and the gateway could each run their own native client: antd for the extension, the `ant` daemon for ant-ui's node management, and ant-core linked in-process for uploads and for the gateway. Each opens its own connections to the network. Two options for the team:

- **Gateway on antd. Chosen for the proof of concept.** antd already serves a native client to local programs over a REST API. Its code (checked 19 November 2026) supports what section 12.10 needs: whole and streamed public reads, one HTTP byte range per request, pointer resolution with the target's kind, and a health call with a peer count. One client serves the extension and the gateway, and the Autonomi team maintains the network code. The gateway stays a small loopback server that serves the loader and passes requests through.
- **Gateway with its own client,** linked in-process. Possible later inside ant-ui, which already has a connected ant-core client, at the cost of porting antd's range-read code (also MIT or Apache-2.0).

The crate's back end is behind one interface (plan step 1), so either can be used. Which daemon ant-ui would standardise on is the team's call.

**Defaults that should differ in an official app**

- **Names.** Antnet's directory and the Download Button's removal list are Antnet's decisions, and in an official app they would read as the Foundation's. ant-ui should ship with raw `p…`/`i…` addresses and `ant://` links only, with an optional setting to add a names directory by its pointer, Antnet's or anyone else's. That requires the names-on-Autonomi work in section 12.4.
- **Loader domain and branding.** Use a neutral local root, for example `*.autonomi.localhost`, chosen with the team. The loader's wording ("No server sent this page", the fine print) is reviewed by them.
- **Updates.** The loader ships inside ant-ui releases, so loader fixes wait for an ant-ui release. That matches section 12.6.

**Questions for the Autonomi team**

- Is browsing Autonomi sites from the app something they want, and on by default or opt-in?
- Would they adopt an external crate, or want the code inside ant-ui?
- Who reviews and owns the loader's code, which runs inside every site the user opens? Section 5.10's published, reproducible build is the starting point.
- Their position on names, abuse reports and removal lists for an official app.
- Contribution terms for ant-ui. Its licence is settled: MIT or Apache-2.0, the same as the loader (checked 19 November 2026).
- One link scheme, `ant://` or `autonomi://`, used by ant-webex, ant-ui and the gateway alike, with a pointer form and a site form. ADR-0006 defines `ant://<address>` and `ant://manifest/…`; ant-webex and ant-ui use `autonomi://<address>` for files; none has a pointer form. Antnet proposes `ant://p/<address>` (section 5.11).
- Would they accept the ant-webex changes above, and should the gateway use antd as its back end, so one native client serves the extension, the gateway and ant-ui?
- Whether the native client inside ant-ui should share one network connection between the gateway, uploads and node management.

**Risks**

- **They may decline, or want it later.** Nothing is lost: the crate still powers Antnet Local.
- **Fork drift.** ant-ui changes often. Keep the fork's changes small and rebase often; don't add features to the fork that aren't headed upstream.
- **Scope.** A bigger app means more to test with each release. The gateway's tests (sections 12.9 and 12.10) move into the crate, so ant-ui only tests the integration.

**Tests for the fork**

- Turning the setting on starts the gateway, and turning it off stops it and frees the port.
- With nodes running, browsing still works, and node management is unaffected.
- `ant://` links open sites from other apps.
- A site published from the app opens through the gateway from a clean origin, and its pointer update is picked up by the next check.
- ant-ui's existing test suite still passes unchanged.

### 12.12 Considered and not planned

- **A fork of an open-source browser** with Antnet built in. Its per-site origins and `ant://` handling are already provided by Antnet Local (sections 12.2 and 12.3), and its native fetching by phase 2. Keeping a Chromium or Firefox fork current with security fixes needs a dedicated team; a fork that falls behind is less safe than the browser people already use; and few people switch browsers for one feature. Precedents: Beaker Browser (Dat) was discontinued, and Brave removed its built-in IPFS node in 2024 after low use.
- **A browser extension on its own.** Extensions can't open UDP sockets or run the native client, so one can't replace the app. ant-webex works the same way: it relies on antd running locally.
- **An Antnet browser extension.** Autonomi's ant-webex already exists, is in both stores and talks to a local client, so the plan requests changes to it instead (section 12.11).

### 12.13 Later

- **The ant-webex changes** (section 12.11), once the gateway exists: sending hosted links to the local gateway automatically, opening site archives as websites, and showing "Open in the Autonomi app" only when the app is running.
- **A relay over TCP** for networks that block all UDP, if Autonomi provides one. It would be a server, so say so wherever it is used.
- **A single-file HTML loader** for simple static sites, for people who can't install anything (section 12.1).

### 12.14 Proof of concept for the community and the team

*Added 19 November 2026. The aim is to show, not describe: a short video and a build people can try, in which the Autonomi app opens Autonomi sites in an ordinary browser and publishes a new one, with measurements beside it. Estimates are rough until step 0 is done.*

**What's in, and what's cut**

- **In:** the `antnet-gateway` crate (sections 12.10 and 12.11), a fork of ant-ui that uses it, the "Open in the Autonomi app" button (section 5.11), and three demo sites.
- **Cut for now:** the standalone Antnet Local tray app (a command-line wrapper is enough for testing), code signing, the updater, names sync over Autonomi (ship a bundled `names.json`), the `local` page, and more than one platform.
- **Starting point:** the loader build from milestones M1–M3. The proof of concept doesn't have to wait for the full demo in section 10.

**Steps**

0. **Check before building. Mostly done on 19 November 2026.**
   - **Licences:** ant-ui, ant-webex and antd are all MIT or Apache-2.0, the same as the loader. ant-ui's contribution terms are still to read.
   - **ant-webex's code:** as section 12.11 now describes; it fetches through antd.
   - **antd's API:** supports range reads, pointer resolution and health with a peer count (section 12.10). **The gateway reads through antd.**
   - **Still to do:** build ant-ui on Windows; run antd (v0.17.0 has a Windows build and MSI) against mainnet; check that its stream plays and seeks the Cinema film; and see where antd keeps pointer keys (section 12.11 plan step 4).
1. **The gateway (2–3 days).** Its own repository, `antnet-gateway`: a Rust crate and a command-line tool, `antnet-gateway --port … --loader … --antd …`.
   - It serves a loader build made with `VITE_LOADER_ROOT=antnet.localhost` on `*.antnet.localhost` at a fixed port, following the same rules as the hosted nginx configuration. It applies the Host check (section 12.3) and passes the four endpoints in section 12.10 to antd.
   - Its tests use a stand-in for antd, so they run without the network.
   - Test first in Chrome, Firefox and Safari on one machine (section 12.9). Safari is the main unknown. If it fails, note it and carry on in Chrome and Firefox.
   - **Built 19 November 2026** (`C:\antnet-gateway`; not yet pushed or tested against a real antd). `npm run build:local` here builds the loader for it.
     - Checked in Playwright's Chromium, Firefox and WebKit on Windows: a secure context, the service worker registers, and `start` resolves to its pointer.
     - Chromium and Firefox then fetch over WebRTC as usual. Playwright's Windows WebKit couldn't connect over WebRTC, which says nothing yet about real Safari.
     - The front door still says "A web server sent you this page" there; the local wording in section 12.5 isn't done.
2. **The loader uses it (about 2 days).**
   - A third `SiteSource`, `GatewaySource`, beside the SDK and fixture sources. The shell uses it when the loader root ends in `.localhost` and `/status` says antd is connected, and falls back to WebRTC otherwise.
   - The receipt says which path was used.
   - **Measure:** ten cold opens of each demo site through the gateway and through WebRTC, and one record that browsers can't reach but the gateway can (from the census). These numbers are what persuade engineers.
   - **Built 19 November 2026** (PROGRESS.md, "Antnet Gateway and GatewaySource"). Checked end to end against a stand-in for antd (`tools/fake-antd.mjs`) in Chromium and Firefox. On 19 November it also opened Start through a real antd on mainnet, with the same content hash as the hosted loader. **Measured the same day** (`docs/measurements/2026-11-19-gateway.md`): it reached two records the browser still can't, and resolved pointers about ten times faster, but a first fetch was no faster than WebRTC.
   - **The earliest thing worth showing,** about a week in: send it to the Autonomi team privately before building the fork (section 12.11 plan step 2).
3. **The ant-ui fork (about a week).** **Browsing built 19 November 2026** (PROGRESS.md, "The ant-ui fork"). The private repo is DavidMc0/ant-ui, branch `antnet-sites`. The user tried it in the app and everything worked. **Publishing was built the same day and also worked:** a new site, then an update behind the same link (PROGRESS.md, "The ant-ui fork: publishing").
   - One platform, the one used for presenting, unsigned and labelled "unsigned test build".
   - An opt-in setting, "Open Autonomi sites in your browser", which starts antd (shipped as a second sidecar) and the gateway inside the app.
   - An "Open an Autonomi site…" menu item.
   - `ant://` registered for sites beside the existing `autonomi://` for files (section 5.11).
   - **"Publish a folder as a site"**, minimal: choose a folder, pack it, upload it with ant-ui's existing wallet flow, create or update a pointer, then open the result through the gateway from a clean origin. This shows the whole loop: run a node, browse, publish.
   - Keep the fork's changes small and in one branch, ready to become upstream pull requests.
4. **The bridges (a few days).**
   - The "Open in the Autonomi app" button on the hosted loader, behind a build setting (section 5.11).
   - **Optional:** a small patch to a fork of ant-webex that redirects hosted links to the gateway when it is running. If time is short, show the button and describe the extension change instead.
5. **Content.** Start, Cinema and Library from the hosted demo (section 3). Cinema matters most: streaming and seeking through the gateway is the most visible difference.

**The video (about two minutes)**

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | The Autonomi app (the fork), with a node running. Turn on "Open Autonomi sites in your browser". | "This is the Autonomi app, with one new setting." |
| 0:15 | An email containing an `ant://` link. Click it: the browser opens Start at its local address. | "An Autonomi link, clicked like any other. The app fetched this site from the network on this computer. No web server." |
| 0:35 | Open Cinema. Press play, seek to the middle and near the end. | "A full film, streamed from the network through the app." |
| 0:55 | A file with records browsers can't reach (the prepared 4K Cinema copy, `289d3381…`, records 11 and 70): it stops in the browser, then plays through the app. | "The app reaches parts of the network a browser can't." |
| 1:10 | The measurements, as a simple table on screen: the two unreachable records, and pointer resolution (1.3 s against 14.4 s). Not a general "faster" claim (section 12.10). | "Measured: records the browser couldn't fetch arrived in seconds, and finding a site's latest version took about a second instead of fourteen." |
| 1:25 | In the app: Publish a folder as a site. Pay, wait, open it. | "Publishing from the same app: pick a folder, pay once, and it's a website." |
| 1:45 | A hosted `antnet.autonomirror.com` link: press "Open in the Autonomi app". | "Links from the web open in the app too." |
| 1:55 | The questions slide. | "This is a community proof of concept. Here's what we'd like to ask the Autonomi team." |

Record the upload in real time once, then cut it. Narrate over the wait if presenting live.

**Sharing it**

1. **Contact the Autonomi team privately** a few days before posting: the video, the repositories, and the questions from section 12.11. They shouldn't learn about it from a public post.
2. **A forum post** with the video, the measurements, the repositories (the crate, the ant-ui fork branch, and any ant-webex patch), the unsigned build with SHA-256 hashes, and the questions for the team.
3. **State plainly:** a community proof of concept, not an Autonomi product; unsigned test builds; one platform; what was measured and what wasn't.
4. **An issue or discussion on ant-ui** linking to the post, proposing the two upstream pull requests in section 12.11 (browsing first, publishing second).

**Checklist**

- [x] Step 0 findings written down: licences, ant-webex's current state, antd's API (19 November 2026).
- [ ] Step 0's remaining checks: ant-ui builds on Windows, antd streams the Cinema film from mainnet, where antd keeps pointer keys.
- [ ] The gateway opens Start, Cinema and Library in Chrome and Firefox; Safari's result recorded either way.
- [x] Gateway versus WebRTC measurements recorded, and one browser-unreachable record opened through the gateway (19 November 2026: two records).
- [ ] With the gateway stopped, installed sites still open, and the shell falls back to WebRTC for new ones.
- [ ] The fork's setting, menu item and `ant://` links work; ant-ui's own tests still pass.
- [ ] Publishing a folder from the app produces a site that opens from a clean origin.
- [ ] The "Open in the Autonomi app" button opens the same site locally, including a deep link.
- [ ] The video, the post and the build, with hashes; the team contacted before posting.
