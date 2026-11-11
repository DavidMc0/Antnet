# Antnet demo plan

*Drafted 11 November 2026, against the repository at `ad9e575` (milestones M1–M3). A plan for a small set of linked sites that shows what Antnet does and leaves people wanting more of it.*

## 1. What the demo has to do

**In one sentence:** a visitor clicks one link, browses five real websites that no web server sent them, turns off their wifi, and keeps browsing.

**Three things a visitor should leave knowing**

1. Websites can live on a network instead of on a server, and still open from an ordinary link in an ordinary browser.
2. Their own browser checked every byte, so nobody in between could alter what they saw.
3. Each site was paid for once, and anyone can publish one with three commands.

**How it earns excitement without asking for it**

- **Show, then explain.** Every site looks and behaves like a normal website first. The unusual part (no server) is revealed by something the visitor does, not announced in a headline.
- **Every claim has a number from this visit beside it.** "4 records, 212 kB, checked in your browser, arrived in 9.2 s" persuades better than any adjective.
- **One surprise per site** (section 3), and one for the whole tour: the offline moment.
- **Be honest about limits.** A short "fine print" list (section 4.4) makes the rest more believable.
- **End on an invitation:** "What would you put here?", with the three commands.

**Words to avoid:** forever, unstoppable, uncensorable, revolutionary, Web3. Prefer: "paid for once", "no renewal", "stored for the life of the network", "no server sent this page".

---

## 2. The visitor's journey (about three minutes)

| Step | What they see | What it teaches |
| --- | --- | --- |
| 1. **Front door** (ordinary web page on the root domain) | "This is the last page a web server will send you." Three short lines on what happens next, a progress line as Antnet Start arrives from the network, then an **Enter** button. | The handover from the old web to the new one, and it hides the slowest wait behind reading time. |
| 2. **Antnet Start** (the hub) | A calm directory of four sites. Under the title, a receipt: where this page came from, in real numbers. Each card shows its site arriving in the background, then "Ready". | Sites come from the network as a few verified records. |
| 3. **Any site** | Opens at once, because it was fetched while they read. It is a different website with its own look and its own address. | This is a web of independent sites, not one app. |
| 4. **Offline** | Start suggests: "Turn off your wifi and keep browsing." Everything they've seen still works. | The sites are theirs now, verified and on their device. |
| 5. **A new site appears** (live demos and the video) | The presenter publishes a site and updates Start. A line appears: "A newer version of this page is available." After a reload there is a fifth card. The earlier version of Start is still there at its own link. | Sites can be updated by their owner, and old versions don't disappear. |
| 6. **Your turn** | Three commands, the cost of the last publish, and a link to the repository. | It is open to them. |

---

## 3. The sites

Every archive stays under 12 MiB so it is four network records. Each site has its own visual style so the set feels like a web. Two small shared pieces tie them together: a "Start" link and the receipt (section 4).

### 3.1 Antnet Start — the hub

- **Link type:** pointer. This is the address people share, and the only pointer in the demo.
- **Content, top to bottom:**
  1. Title and one line: "A small web of sites that live on the Autonomi network."
  2. **The receipt** for this page (section 4.1).
  3. **The directory:** one card per site with a one-line description, its size, and a live status (section 5.2): "Arriving… 2 of 3 records", then "Ready".
  4. **How this reached you:** a five-step strip (connect, find, fetch, check, hand over) with this visit's own timings on each step. Link to this site's info page at `/_autonomi/` for the full detail.
  5. **Try this:** the offline challenge. It appears once every card says "Ready".
  6. **Earlier versions:** a list of Start's previous versions, each an immutable link. "Every version ever published is still there."
  7. **Publish your own:** the three commands and what the last publish cost.
  8. **Fine print** (section 4.4).
- **Surprise:** the long name in the address bar. One line under the title explains it: "That long name is this site's address on the network. It is also how your browser knows nothing was changed."

### 3.2 Autonomi Developer Docs — unofficial mirror

- **Content:** the official developer docs (182 Markdown pages, about 2 MB of source), built with an ordinary docs generator that has built-in local search, such as VitePress or Astro Starlight.
- **Licence:** the `autonomi-developer-docs` repository is MIT and Apache-2.0. Keep the copyright notice, link to the source and name the commit it was built from. The licence covers the text, not the Autonomi name or logo as a brand, so label every page "Unofficial mirror" and don't use the logo.
- **What it shows:** a large multi-page site from a standard toolchain runs unchanged, search included, and works offline.
- **Surprise:** "The documentation for the network, served by the network."
- **Check:** the built site is under 12 MiB, uses `"notFound": "404.html"` and has no absolute links back to the original host.

### 3.3 ColonySim — an app, not a page

*Named ColonySim, not Colony: Colony was an app on Autonomi 1.0.*

- **Content:** a small ant-colony simulation on a canvas. Ants forage and lay trails; the visitor drops food and obstacles and watches the trails re-form. The colony saves itself in the browser as it runs.
- **Why this app:** it is original (nothing to license), on theme, lovely to watch in a video, and small.
- **What it shows:** real applications work, not just documents. The colony is still there after a reload and with the network off, with no account and no server.
- **Surprise:** a line in the corner, "Day 3 of your colony. It lives in your browser, on this site's own address."
- **Settings:** `"spa": true` if it uses client-side routes.

### 3.4 Cinema — video

- **Content:** a 60–90 second clip from *Big Buck Bunny* at 720p, H.264 MP4 with the index at the front (`-movflags +faststart`), about 8 MB. Credit: "© 2008 Blender Foundation, bigbuckbunny.org, CC BY 3.0".
- **What it shows:** media plays and seeks. The loader answers byte-range requests from the installed archive.
- **Surprise:** drag the playhead anywhere and it jumps instantly. A caption: "Nothing is streaming. The film arrived with the page."
- **Check:** playback and seeking in Safari, which is strict about range requests.

### 3.5 Library — durable publishing

- **Content:** three or four short public-domain books as clean HTML, from Standard Ebooks (which dedicates its editions to the public domain). A plain, bookish design with a contents page and comfortable reading type.
- **What it shows:** publishing with no hosting bill. The receipt here leads with the date and cost: "Published 14 November 2026. Paid for once. No renewal."
- **Surprise:** "This shelf has no server behind it."
- **Check:** the books chosen are public domain where the audience is, not only in the US, and Standard Ebooks' own logo and name aren't used as branding.

### 3.6 The guest site — published during the demo

- **Content:** a single page, "Hello from 14 November", made in front of the audience.
- **What it shows:** how little it takes to publish, and Start updating to include it (journey step 5).

### Not included: a copy of autonomi.com

It would make a strong sixth site, but only with the Autonomi Foundation's agreement. The site isn't openly licensed, a full copy of an organisation's homepage on another domain looks like an imitation of it, and an upload can't be withdrawn. If they are willing, the best version is one they publish themselves and hold the pointer key for: "the Autonomi website, served from Autonomi".

---

## 4. Shared pieces

### 4.1 The receipt

A small script every demo site includes. It reads the loader's own record for the site and prints one line in the footer (Start shows it prominently):

> No server sent this page. It arrived as **4 records** (**212 kB**) from the Autonomi network in **9.2 s** and was checked in your browser. Address `9ea6…e9e1`. [Details](/_autonomi/)

- **Where the numbers come from:** the state record the loader writes at install: the Cache Storage cache `autonomi-loader-meta`, entry `/_autonomi/state.json`, fields `records`, `bytes`, `timings.totalMs`, `archive`, `installedAt`. Site code shares the origin, so it can read it with the Cache API. (A plain `fetch` of that path won't work; reserved paths go to the network.)
- **If the record is missing** (the site was opened some other way), the receipt hides itself.
- **Cost and date** are added at build time from a small `receipt.json` written when the site is published.

### 4.2 The Start link

Every site has a small "Antnet Start" link in its header, written as a portable link so it works on any loader domain: `/_autonomi/go/p/ant/<Start pointer address>/`.

### 4.3 One look per site

Different type and colour for each site, the same quiet footer on all. Light and dark themes. No trackers, no external fonts or scripts: everything a site needs is in its archive, which is also what makes the offline moment work.

### 4.4 Fine print (on Start)

- A first visit to each site takes several seconds while it is fetched and checked. Return visits are instant.
- Some networks block the kind of connection this needs. If a site won't load, try another network.
- These are static sites and apps. There is no server-side code.
- A small share of content on the network can't yet be reached from browsers.
- The first page (the loader) still comes from an ordinary web host. It is small, open source, and anyone can run their own.
- Antnet is an independent proof of concept, not an Autonomi Foundation product.

---

## 5. Loader work the demo needs

Measured on mainnet so far (PROGRESS.md): a cold open takes about 8–14 s, the first pointer read on a new connection about 19 s, and a warm open 41 ms. Five cold waits in a row would sink the demo, so most of this section is about moving the waiting to where the visitor is reading.

### 5.1 Front door (root-domain landing page)

Replace the fixture list in the production build with the front door from journey step 1. It warms Antnet Start in the background (5.2) and enables **Enter** when it is ready. A visitor can also click early and watch the normal loading screen.

### 5.2 Warm-up: install a site before it is clicked

- **New reserved path `/_autonomi/warm`:** the shell installs the site as usual, but doesn't reload into it. It reports progress and the result to its parent window with `postMessage`, and only to a parent on the same loader root.
- **Use:** the front door opens Start's warm path in a hidden frame. Start does the same for each card, one site at a time, in card order. A portable link reaches it without the site needing to compute labels: `/_autonomi/go/ant/<address>/_autonomi/warm`.
- **Why it should work:** all sites are subdomains of one registrable domain, so a frame and a later top-level visit use the same storage. **This is untested.** Check it in Chrome, Firefox and Safari. It stops working if the loader's domain is added to the Public Suffix List, because browsers would then keep framed and top-level storage apart, so don't file that request before the demo.
- **If it doesn't work in a browser,** nothing breaks: the cards stay "Not fetched yet" and a click shows the normal loading screen.
- **Say what it is.** Start's cards show the fetching as it happens. Prefetching is a normal web technique; hiding it would undercut the honesty the demo depends on.

### 5.3 Updates that never block

With SDK 0.1.5 the first pointer read on a new connection takes about 17–20 s on mainnet. The check budget was raised from 5 s to 25 s on 11 November, so checks now succeed, but a visit to Start stalls for about 20 s whenever a check is due (once an hour). That makes this section a priority: do it alongside warm-up (5.2), which uses the same hidden-frame mechanism.

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

---

## 6. Links and publish order

A site's address is the hash of its contents, links included. Two immutable sites therefore can't link to each other: each would need the other's address before it exists. One pointer breaks the circle.

```
               ┌────────────── Antnet Start (pointer) ──────────────┐
               │        links to every site by immutable address    │
               ▼              ▼              ▼              ▼
             Docs         ColonySim       Cinema         Library
               └── every site links back to Start by its pointer ──┘
```

**Order**

1. **Make Start's key and note its address.** The address is known before the pointer exists.
   ```bash
   ant pointer keygen --output publish/start.key      # back this up; it can't be recovered
   ant pointer address --key publish/start.key        # → START
   ```
2. **Build and publish each content site** with its Start link set to `/_autonomi/go/p/ant/<START>/`.
   ```bash
   node tools/pack.mjs sites/library/dist publish/library.tar
   ant file upload publish/library.tar --public       # → LIBRARY (repeat for the others)
   ```
   Note the cost of each upload for its receipt. A later site may link to an earlier one, for example ColonySim to the Docs.
3. **Open each site by its `i…` link in a clean browser profile.** If one fails on a missing record, re-pack with `--nonce` and upload again.
4. **Build Start** with the four addresses, publish it, and create the pointer.
   ```bash
   node tools/pack.mjs sites/start/dist publish/start-v1.tar
   ant file upload publish/start-v1.tar --public      # → START_V1
   ant pointer create --key publish/start.key <START_V1>
   node tools/link.mjs p <START>                      # the link to share
   ```
5. **To add a site later** (the live moment): publish it, build Start v2 with the new card and a link to `START_V1` under "Earlier versions", upload, then `ant pointer update --key publish/start.key <START_V2>`.

Keep the addresses in one file (`sites/addresses.json`) that every site's build reads, so links are never typed by hand.

---

## 7. Running it live, or recording it

**Before the audience arrives:** open the front door once on the presenting machine in a fresh profile and check all cards reach "Ready". For a live talk, keep a second fresh profile for the real run and a recording as backup.

| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Front door. Progress line running. | "This is an ordinary web page. It's the last one a server will send us." |
| 0:20 | Enter. Start opens instantly. Point at the receipt. | "This page came from the Autonomi network: four records, checked here in the browser. No server sent it." |
| 0:40 | Cards turning to "Ready". Open the Docs, search for something. | "A normal docs site, built with normal tools." |
| 1:00 | ColonySim. Drop food, watch trails form. | "And real apps. This one saves itself in the browser." |
| 1:20 | Cinema. Drag the playhead around. | "Nothing is streaming. The film arrived with the page." |
| 1:35 | **Turn wifi off.** Back to Start, into the Library, back to ColonySim. | Say nothing for a few seconds. Then: "The network's off." |
| 2:00 | Wifi on. Terminal: pack, upload, pointer update for the guest site. | "Publishing is three commands, and you pay once." |
| 2:30 | Start shows "A newer version is available". Reload: fifth card. Open "Earlier versions". | "The owner can update a site. The old version is still there." |
| 2:50 | "Publish your own" section. | "What would you put here?" |

The upload and pointer update take real time. In a recording, cut it. Live, start them before the wifi moment and narrate over the wait.

---

## 8. Share kit

- **The link:** the root domain (the front door), not Start's long address.
- **A 90-second screen recording** of section 7, captioned, no voice needed. It is also the fallback for people whose network blocks the connection.
- **One still image:** Start with the receipt and all cards "Ready".
- **Two sentences for a post:** "Five websites with no web server behind them. Open the link, then turn off your wifi."
- **For the Autonomi community:** the measurements, the repository, and an invitation to publish a site and have it listed on Start.

---

## 9. Checks before sharing

- [ ] Fresh-profile run of the whole journey in Chrome, Firefox and Safari on desktop, and Chrome on Android. Record what warm-up does in each.
- [ ] Ten cold opens of the front door from at least two different networks. Note the time until **Enter** enables and any failures.
- [ ] Every site opened by its `i…` link from a clean profile after publishing.
- [ ] Offline run: every page of every site, video seeking, ColonySim's saved state, Docs search.
- [ ] A network that blocks UDP (many office and guest networks): the "can't connect" page appears, with the video link.
- [ ] Start's update notice appears after a pointer update, and "Earlier versions" opens v1.
- [ ] Licence and credit lines present: Docs (MIT/Apache, source and commit, "Unofficial mirror"), Cinema (Blender Foundation, CC BY 3.0), Library (public-domain status).
- [ ] Every archive under 12 MiB; no site requests anything from outside its own archive.
- [ ] `publish/start.key` backed up somewhere other than the laptop.

---

## 10. Build order

1. **Start and one content site** (the Library is the simplest), with the receipt and Start link. Publish, and prove the link plan end to end.
2. **Hosting** on a real wildcard domain.
3. **Warm-up and the front door.** This decides how slick the demo can be, so test it early.
4. **Non-blocking updates** and the update notice.
5. **ColonySim, Cinema, Docs.**
6. **Loading screen and "can't connect" page.**
7. **Checks, recording, share.**

## 11. Open decisions

- ~~**Domain** for the demo.~~ Decided 11 November: loader root `antnet.autonomirror.com` on the user's VPS. (GitHub Pages can't serve wildcard subdomains, and autonomirror.com's own site stays on Pages.)
- ~~**Is Colony the right app?**~~ Decided: keep the simulation, named ColonySim.
- **Ask the Foundation** about the docs mirror label and about publishing autonomi.com themselves?
- **Pointer read time.** About 19 s on a new connection is the demo's slowest step. Warm-up hides it, but it is worth raising with the SDK maintainers along with the measurements in PROGRESS.md.
