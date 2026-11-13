# Antnet

A loader for websites hosted on the [Autonomi](https://autonomi.com) network. It opens a site published on
Autonomi from an ordinary link, in an ordinary browser, with nothing to install and no gateway server in the data
path.

The loader's host serves only a small, fixed shell page. That page runs the Autonomi browser client
([`@withautonomi/ant-browser-sdk`](https://www.npmjs.com/package/@withautonomi/ant-browser-sdk)) over WebRTC. It
downloads the site straight from Autonomi nodes and verifies every byte in the visitor's browser. Then it hands over
to a service worker, which serves the site as a normal top-level website on its own origin.

This is a proof of concept. [PROGRESS.md](PROGRESS.md) records each milestone's status and the measurements taken on
mainnet.

## How it works

- **A site is one tar archive.** It is uploaded to Autonomi as a single public file, and that file's address is the
  site's address. One archive of up to about 12 MiB is only four network records. That matters because a small
  share of records can't currently be reached from browsers, so fewer records means a site is more likely to open.
- **Install, then hand over.** On a first visit the shell downloads and checks the archive. It stores the files in
  the browser's Cache Storage and reloads. From then on the service worker serves the site from the cache, so return
  visits are instant and work offline.
- **One origin per site.** The address is in the hostname, so sites can't read each other's storage:
  - `i<address>.<loader root>` is an immutable link to one version, fixed forever.
  - `p<address>.<loader root>` is a pointer link. It follows an Autonomi pointer that the publisher can move to new
    versions, and the loader checks for a new version at most once an hour.
- **Short names.** The loader carries a small public directory, [names.json](names.json), that maps a name to an
  address, so a site can be `library.<loader root>`. The directory decides which site a name leads to. It can't
  change what a site contains, which is still fetched by address and verified. Each site's info page shows the
  whole chain.
- **Links between sites are ordinary links.** One site links to another by its loader URL, or portably with
  `/_autonomi/go/name/<name>/` or `/_autonomi/go/ant/<address>/`, which work on whichever loader the visitor is
  using.
- **Every info page is at `/_autonomi/`.** It shows the address in use, the content hash, sizes and timings. It also
  has actions to check for a new version and to clear the site's data.

Not in scope for now: server-side code, uploading or paying from the loader, private sites, files streamed from
outside the archive, and sites that register their own service worker.

## Site format

A site is an uncompressed POSIX ustar archive:

- **Allowed entries:** regular files and directories, with relative `/`-separated paths. Symlinks, hard links, `..`,
  absolute paths and duplicate paths are rejected.
- **Index file:** an `index.html` at the root is required. That is what makes an archive a site.
- **Size:** up to 64 MiB. Aim for under about 10 MB.

An optional `.autonomi-site.json` at the root holds settings. Every field is optional:

```json
{
  "format": "autonomi-site/1",
  "index": "index.html",
  "notFound": "404.html",
  "spa": false,
  "title": "Example app",
  "headers": {
    "/*": { "Content-Security-Policy": "default-src 'self'" }
  }
}
```

- **`spa: true`** serves the root index for any page path not found in the archive, as single-page apps need.
- **`headers`** applies response headers to path patterns: an exact path, `/*` or `/dir/*`. Only these headers are
  accepted:
  - `Content-Security-Policy`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Embedder-Policy`
  - `Cross-Origin-Resource-Policy`

## Publishing a site

1. Build the site into a folder with `index.html` at its root.
2. Pack it into an archive with `node tools/pack.mjs site/ site.tar`. The same folder always gives the same bytes,
   and so the same address.
3. Upload it with the `ant` CLI: `ant file upload site.tar --public`. This prints the archive's address.
4. Optionally, for a link that can be updated, create a pointer to that address with `ant pointer create`.
   Run `ant pointer update` for each later version.
5. Turn an address into a link with `node tools/link.mjs i <address>` (or `p` for a pointer).

The `ant` commands that pay need the wallet key in the `SECRET_KEY` environment variable. In Windows PowerShell,
set it with `$env:SECRET_KEY = "0x..."`. In bash, put `SECRET_KEY=0x...` in front of the command.

## Development

Requires Node 24.

```sh
npm install
npm run dev            # local dev server using built-in fixture sites instead of the network
npm run dev:autonomi   # dev server against Autonomi mainnet
npm test               # unit tests
npm run test:e2e       # browser tests against the fixture sites (Playwright)
npm run test:mainnet   # browser tests against mainnet; set the addresses listed in tests/e2e-mainnet/m2.spec.ts
npm run build          # production build in dist/
```

Open `http://localhost:5173/` and enter an address, or use the fixture links on the landing page. Site hostnames
are subdomains of `localhost`, which browsers resolve without any setup.

### Tools

| Script | Use |
| --- | --- |
| `node tools/pack.mjs <folder> <out.tar>` | Pack a site folder into a deterministic archive |
| `node tools/link.mjs i\|p <address>` | Turn an address into a site link, or a link back into an address |
| `node tools/probe.mjs <url>` | Open a link in a fresh browser and log each loading step with timings |
| `node tools/pointer-timing.mjs <pointer>` | Time the SDK's pointer reads in a browser |
| `node tools/prepare-publish.mjs` | Build the mainnet test archives into `publish/` |

`publish/` is gitignored, because it also holds pointer owner keys.

## Licence

Antnet's code is licensed under either of

- the Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE)), or
- the MIT licence ([LICENSE-MIT](LICENSE-MIT)),

at your option. Unless you say otherwise, any contribution you submit for inclusion is licensed
the same way, without any additional terms.

The demo sites include work by others, which keeps its own licence:

- **Fonts:** each is under the SIL Open Font License; its licence file sits beside it in the site's
  `fonts/` folder.
- **Big Buck Bunny** (Cinema): © 2008 Blender Foundation, [bigbuckbunny.org](https://www.bigbuckbunny.org/),
  under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- **The Library's books:** the [Standard Ebooks](https://standardebooks.org/) editions, which their
  editors dedicate to the public domain.
- **The Autonomi browser SDK** (`@withautonomi/ant-browser-sdk`), bundled into the loader, Cinema and
  the Download Button: © 2026 Autonomi, under MIT or Apache-2.0.
