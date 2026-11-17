// Bundle a site's own script, with the Autonomi browser client, into files for its archive.
// Used by sites that run the client themselves (Cinema, the Download Button).
//
// Vite and the SDK are pinned, so the same inputs give the same bytes every time, and an
// unchanged site rebuilds to the same archive. Everything lands under `dir`. The client's
// upload worker, with a second copy of its WebAssembly, is emitted outside it and left out:
// these sites only read from the network, and leaving it out halves the archive.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";

/**
 * @param {object} o
 * @param {URL} o.entry   the script to bundle (JavaScript or TypeScript)
 * @param {URL} o.root    the site's folder (Vite's root)
 * @param {string} o.dir  the folder in the archive, such as "player"; the entry becomes <dir>/<name>.js
 * @param {string} [o.name] the entry file's name, without ".js"; defaults to `dir`
 * @param {boolean} [o.licences] also put the SDK's licence files (MIT and Apache-2.0, both of
 *   which ask for the notice wherever it is redistributed) in `dir`, as LICENSE-SDK-MIT.txt and
 *   LICENSE-SDK-APACHE.txt. Off by default only so that sites already uploaded rebuild unchanged.
 * @returns {Promise<Map<string, string | Uint8Array>>} archive path -> contents
 */
export async function bundleScript({ entry, root, dir, name = dir, licences = false }) {
  const result = await build({
    configFile: false,
    logLevel: "warn",
    publicDir: false,
    root: fileURLToPath(root),
    base: "/",
    build: {
      write: false,
      target: "es2022",
      modulePreload: false,
      assetsInlineLimit: 0,
      rollupOptions: {
        input: fileURLToPath(entry),
        output: {
          entryFileNames: `${dir}/${name}.js`,
          chunkFileNames: `${dir}/[name]-[hash].js`,
          assetFileNames: `${dir}/[name]-[hash][extname]`,
        },
      },
    },
  });
  const files = new Map();
  for (const out of Array.isArray(result) ? result : [result]) {
    for (const item of out.output) {
      if (!item.fileName.startsWith(`${dir}/`)) continue;
      files.set(item.fileName, item.type === "chunk" ? item.code : item.source);
    }
  }
  if (licences) {
    const sdk = new URL("../../node_modules/@withautonomi/ant-browser-sdk/", import.meta.url);
    files.set(`${dir}/LICENSE-SDK-MIT.txt`, readFileSync(new URL("LICENSE-MIT", sdk), "utf8"));
    files.set(`${dir}/LICENSE-SDK-APACHE.txt`, readFileSync(new URL("LICENSE-APACHE", sdk), "utf8"));
  }
  return files;
}
