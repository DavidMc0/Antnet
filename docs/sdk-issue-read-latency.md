# Slow reads of small files, and a slow first pointer read on a new client (0.1.5, mainnet)

Reads that succeed are much slower than the SDK audits suggest when files are small. A 4.6 kB public file (a DataMap
plus 3 chunks) takes 8–14 s to download in Chromium, and sometimes 44–50 s. The first pointer read on a newly
connected client takes 17–20 s, while later reads on the same client take 1.3–4.5 s. The audits report the first
record arriving after about 1.9 s and 64 MiB in about 29 s. So for small reads, most of the time seems to go on
per-record overhead rather than transfer.

This is separate from #10, which is about chunks a browser can't fetch at all. Here every read eventually succeeds.

## Context

I'm building a loader that opens static websites stored on Autonomi in an ordinary browser. A site is one tar archive,
uploaded as a single public file, so a typical site is just four records. Pointers give sites a "latest version" link.
Small reads and one pointer read per visit are therefore the whole workload.

The pointer delay is the bigger problem:
- WebRTC can't run in a service worker, so each update check is a new page with a new client.
- We had planned a 5 s budget for that check, but with a first read of 17–20 s it always ran out.
- We have raised it to 25 s, so a visitor waits about 20 s once an hour when a check is due.

## Environment

- `@withautonomi/ant-browser-sdk` 0.1.5, with the default `AutonomiClient.connect()` using the bundled seeds
- Chromium 158 (Playwright 1.65), headless, Windows 11
- Mainnet, 11 November 2026
- For comparison: `ant` CLI 0.3.13 on the same machine

## 1. Small file downloads

File: `9ea63625861bd3e72a31bf54af2f2e5daf9a1a1f0a04c5f5fb43d8e281a1e9e1` (public, 4,608 bytes; DataMap and 3 chunks).
These are fresh browser profiles, each with a new client, over about a dozen runs:

| Step | Time |
| --- | --- |
| `connect()` | 0.84–0.90 s, very steady |
| `download()`, typical | 8.4–14.2 s |
| `download()`, outliers | 22 s once; 44 s and 50 s in two runs |

- **Progress events:** the "Downloaded chunk N/M" events show the DataMap after about 2.2 s, then the three chunks
  1.5–3 s apart.
- **Concurrency:** passing `concurrency: 1`, `16` or leaving it on `"auto"` made no measurable difference.
- **The 44–50 s outliers** fit the documented retries for a missing record, at 15 s and 45 s.
- **One trace from a run where the chunk arrived on the retry:** in a run that first read a pointer, here are the
  `download` events relative to its start:

  | Event | Time |
  | --- | --- |
  | DataMap verified | 0.88 s |
  | chunk 1/3 | 1.82 s |
  | chunk 2/3 | 1.87 s |
  | chunk 3/3 | 34.59 s |

## 2. The first pointer read on a new client

Pointer: `ddabf062d1bbc960eaaaa01edf3cacbd3b3cbae8329cb4f48685a093032e4699` (kind chunk, counter 1). Each block below
is one page with one client. Reads run one after another in the order shown.

| Run | First read | Later reads on the same client |
| --- | --- | --- |
| 1 | `getPointer` 19,541 ms | `resolvePointer` 3,227 ms · `getPointer` 1,332 ms · `resolvePointer` 1,911 ms · `getPointer` 1,743 ms · `resolvePointer` 1,616 ms |
| 2 | `getPointer` 18,748 ms | `resolvePointer` 3,225 ms |
| 3 | `getPointer` 18,967 ms | `resolvePointer` 3,216 ms |
| 4 (idle 10 s after `connect()`) | `getPointer` 9,329 ms | `resolvePointer` 4,448 ms |
| 5 (idle 20 s after `connect()`) | `getPointer` 9,311 ms | `resolvePointer` 4,518 ms |

In the loader itself, where `resolvePointer` is the first read, it took 16.96–18.89 s across five runs.

- **The first read is slow whichever call makes it.** A later read on the same client is fast.
- **Idling after `connect()` only halves it,** from about 19 s to about 9.3 s, so the cost isn't just a warm-up
  that finishes in the background.
- **About 19 s is close to the 15 s retry plus a normal read.** That suggests the first attempt fails and the
  retry succeeds.
- **No progress events.** During the read the only event is one at the end
  (`pointer/complete succeeded: pointer started`).
- **CLI comparison:** `ant pointer get` on the same pointer takes 11.4–12.0 s, including its own connection.

## To reproduce

In a page served over `http://localhost`:

```js
import { AutonomiClient } from "@withautonomi/ant-browser-sdk";

const ptr = "ddabf062d1bbc960eaaaa01edf3cacbd3b3cbae8329cb4f48685a093032e4699";
const file = "9ea63625861bd3e72a31bf54af2f2e5daf9a1a1f0a04c5f5fb43d8e281a1e9e1";
const time = async (label, fn) => {
  const t = performance.now();
  await fn();
  console.log(label, Math.round(performance.now() - t), "ms");
};

const client = await AutonomiClient.connect();
await time("first getPointer", () => client.getPointer(ptr));
await time("second getPointer", () => client.getPointer(ptr));
client.close();

const fresh = await AutonomiClient.connect();
await time("download 4.6 kB", () => fresh.download(file));
fresh.close();
```

## Questions

1. **What is the first read on a new client waiting for?** Is it the routing table filling, the first close-group
   lookup, or a first attempt that fails and waits 15 s for the retry? Could `connect()` do that work up front,
   or could there be an option to?
2. **Can per-record lookups overlap?** On a 3-chunk file, concurrency has no visible effect, and the chunks arrive
   1.5–3 s apart.
3. **Could a missing record be retried sooner, or from other holders?** One slow record currently adds 15 s or 45 s
   to the whole read. With about half of nodes not answering browser dials (ADR-0027), it seems worth trying the
   next holders quickly before waiting.
4. **Progress events, a smaller point:**
   - Download progress gives the chunk count only in the message text, so we parse "Downloaded chunk N/M".
     Structured `done`/`total` fields for records would help.
   - Pointer reads emit no progress events while they run.

I'm happy to run builds or diagnostics against these addresses. The measuring script is in
https://github.com/DavidMc0/Antnet (`tools/pointer-timing.mjs`, `tools/probe.mjs`).
