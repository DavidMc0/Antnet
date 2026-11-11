/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Plugin, build, defineConfig, loadEnv } from "vite";

const NAMES_FILE = fileURLToPath(new URL("./names.json", import.meta.url));
const NAMES_OUT = "_autonomi/names.json";
const SW_FILE = "autonomi-loader-sw.js";
const SW_ENTRY = fileURLToPath(new URL("./src/sw.ts", import.meta.url));

/**
 * CSP for the shell page in production builds. Dev injects inline styles, so it is build-only.
 * frame-src allows the loader's own sites, for warm-up frames (DEMO.md 5.2). Without a
 * configured root the build runs on localhost (tests, local preview).
 */
function shellCsp(loaderRoot: string): string {
  const sites = loaderRoot ? `https://*.${loaderRoot}` : "http://*.localhost:*";
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self' https: wss:",
    `frame-src 'self' ${sites}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Bundles src/sw.ts into one self-contained classic script with no runtime imports
 * (spec 11.1). Served from memory in dev and emitted at the output root in the build.
 */
function serviceWorker(loaderRoot: string): Plugin {
  let isDev = false;

  async function bundle(): Promise<string> {
    const result = await build({
      configFile: false,
      logLevel: "warn",
      publicDir: false,
      define: {
        __LOADER_ROOT__: JSON.stringify(loaderRoot),
        __DEV_PASSTHROUGH__: JSON.stringify(isDev),
      },
      build: {
        write: false,
        emptyOutDir: false,
        minify: !isDev,
        sourcemap: false,
        lib: { entry: SW_ENTRY, formats: ["iife"], name: "AutonomiLoaderSW", fileName: () => SW_FILE },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    for (const out of outputs) {
      if (!("output" in out)) continue;
      for (const item of out.output) if (item.type === "chunk") return item.code;
    }
    throw new Error("Service worker bundle produced no code");
  }

  return {
    name: "autonomi-loader-sw",
    configResolved(config) {
      isDev = config.command === "serve";
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (path !== "/" + SW_FILE) return next();
        try {
          const code = await bundle();
          res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(code);
        } catch (e) {
          next(e);
        }
      });
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: SW_FILE, source: await bundle() });
    },
  };
}

/**
 * The short-name directory (DEMO.md 5.9): names.json at the repository root, served at
 * /_autonomi/names.json. Fixture builds use the test directory in public/ instead.
 */
function nameDirectory(enabled: boolean): Plugin {
  const read = () => {
    try {
      return readFileSync(NAMES_FILE, "utf8");
    } catch {
      return JSON.stringify({ v: 1, names: {} }) + "\n";
    }
  };
  return {
    name: "autonomi-loader-names",
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? "").split("?")[0] !== "/" + NAMES_OUT) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(read());
      });
    },
    generateBundle() {
      if (enabled) this.emitFile({ type: "asset", fileName: NAMES_OUT, source: read() });
    },
  };
}

/** index.html and the worker must always be revalidated (spec 11.1). */
function noCacheShell(): Plugin {
  const isShellPath = (url: string | undefined) => {
    const path = (url ?? "/").split("?")[0];
    return path === "/" + SW_FILE || !/\.[a-z0-9]+$/i.test(path) || path.endsWith(".html");
  };
  return {
    name: "autonomi-loader-no-cache",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (isShellPath(req.url)) res.setHeader("Cache-Control", "no-cache");
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (isShellPath(req.url)) res.setHeader("Cache-Control", "no-cache");
        next();
      });
    },
  };
}

function shellCspMeta(loaderRoot: string): Plugin {
  const csp = shellCsp(loaderRoot);
  return {
    name: "autonomi-loader-shell-csp",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const meta = ctx.server ? "" : `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
        return html.replace("<!--shell-csp-->", meta);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const loaderRoot = process.env.VITE_LOADER_ROOT ?? env.VITE_LOADER_ROOT ?? "";
  const fixtureSource = (process.env.VITE_SOURCE ?? env.VITE_SOURCE) === "fixture";
  return {
    appType: "spa",
    // public/ holds only the generated test fixtures; keep them out of mainnet builds.
    publicDir: fixtureSource ? "public" : false,
    plugins: [serviceWorker(loaderRoot), nameDirectory(!fixtureSource), noCacheShell(), shellCspMeta(loaderRoot)],
    server: { allowedHosts: [".localhost"] },
    preview: { allowedHosts: [".localhost"] },
    build: {
      assetsDir: "_autonomi/assets",
      outDir: fixtureSource ? "dist-fixture" : "dist",
      emptyOutDir: true,
    },
    // The SDK loads its WASM with new URL(..., import.meta.url); pre-bundling would break that.
    optimizeDeps: { exclude: ["@withautonomi/ant-browser-sdk"] },
    test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
  };
});
