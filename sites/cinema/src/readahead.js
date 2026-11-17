// Cinema's page side of the media bridge, with read-ahead (PROGRESS.md, "Cinema read-ahead").
//
// The loader's worker carries the SDK's media bridge. It turns the <video>'s byte-range
// requests into messages to this page, one 1 MiB block at a time, each waiting for the last.
// The SDK's own page side (createMediaSource) answers each with a read that reaches only about
// one record ahead, so playback depends on one record at a time arriving promptly. One slow
// record, or one the core must retry after 15 s, stalls the video on any connection.
//
// This answers the same messages from its own cache instead, and keeps a window of blocks ahead
// of the player's position being fetched several at a time, the way AntTP serves video. A slow
// record then delays a block the player won't need for a while yet.
//
// The protocol is the SDK's (internal/media.js in 0.1.5; fixtures/stream/stream.js tests it):
//   worker -> page  { type: "autonomi-file-range", sessionId, start, length }, with a port
//   page -> worker  { ok: true, bytes: ArrayBuffer } on that port, or { ok: false, error }
//   page -> worker  { type: "autonomi-stream-awake" } every 10 s while a stream is open

const BLOCK = 1024 * 1024;
const KEEP_AWAKE_MS = 10_000;
/** A block that failed isn't fetched ahead again for this long; the player can still ask. */
const RETRY_AFTER_MS = 5_000;
/** Blocks kept behind the player's position, for a small seek back. */
const KEEP_BEHIND = 2;

export class ReadAhead {
  #reader;
  #blocks = new Map(); // index -> { promise, bytes }
  #failed = new Map(); // index -> time of the last failure
  #inFlight = 0;
  #position = 0;
  #closed = false;
  #keepAwake;
  #onMessage;
  #lastBlock;
  // Throughput, measured only while every slot is busy: then the network, not the player, sets
  // the pace. Recent busy spells as [ms, bytes, ended], newest last.
  #busySince = 0;
  #busyBytes = 0;
  #spells = [];

  /**
   * @param reader   a PublicFileReader from client.openFile()
   * @param options  { type, name, ahead, parallel, onFetched(start, length) }
   *   ahead     blocks fetched ahead of the player's position; setAhead() changes it
   *   parallel  blocks fetched at once, at most (the player's own requests may add to this)
   */
  constructor(reader, { type, name, ahead, parallel, onFetched }) {
    this.#reader = reader;
    this.size = reader.size;
    this.ahead = ahead;
    this.parallel = parallel;
    this.onFetched = onFetched;
    this.#lastBlock = Math.floor((this.size - 1) / BLOCK);

    const session = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    const url = new URL(`/__autonomi_stream/${session}/file`, location.origin);
    url.searchParams.set("size", String(this.size));
    url.searchParams.set("type", type);
    url.searchParams.set("name", name);
    this.url = url.href;

    this.#onMessage = (event) => {
      const d = event.data;
      if (d?.type !== "autonomi-file-range" || d.sessionId !== session) return;
      const port = event.ports[0];
      if (!port) return;
      if (!Number.isSafeInteger(d.start) || !Number.isSafeInteger(d.length) || d.start < 0 || d.length <= 0) {
        port.postMessage({ ok: false, error: "The service worker requested an invalid file range" });
        return;
      }
      this.#answer(d.start, d.length).then(
        (bytes) => port.postMessage({ ok: true, bytes: bytes.buffer }, [bytes.buffer]),
        (e) => port.postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
    };
    navigator.serviceWorker.addEventListener("message", this.#onMessage);
    this.#keepAwake = setInterval(() => navigator.serviceWorker.controller?.postMessage({ type: "autonomi-stream-awake" }), KEEP_AWAKE_MS);
    this.#pump();
  }

  /** Change how far ahead to fetch, for example once play is pressed. */
  setAhead(blocks) {
    this.ahead = blocks;
    this.#pump();
  }

  /**
   * Bytes per second the network delivered over the last 30 s or so of busy time in the last
   * two minutes, or null with under 3 s of it. A full window fetches only as fast as the video
   * plays, so this is the rate while fetching flat out: before play, after a seek, or while the
   * window refills.
   */
  get rate() {
    const now = performance.now();
    let ms = this.#busySince ? now - this.#busySince : 0;
    let bytes = this.#busyBytes;
    for (let i = this.#spells.length - 1; i >= 0 && ms < 30_000 && now - this.#spells[i][2] < 120_000; i--) {
      ms += this.#spells[i][0];
      bytes += this.#spells[i][1];
    }
    return ms >= 3_000 ? (bytes * 1000) / ms : null;
  }

  /** Bytes held, in an unbroken run, from the player's position onwards. */
  get bytesAhead() {
    let i = Math.floor(this.#position / BLOCK);
    let n = 0;
    while (i <= this.#lastBlock && this.#blocks.get(i)?.bytes) {
      n += this.#blocks.get(i).bytes.byteLength;
      i++;
    }
    return Math.max(0, n - (this.#position % BLOCK));
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    clearInterval(this.#keepAwake);
    navigator.serviceWorker.removeEventListener("message", this.#onMessage);
    this.#blocks.clear();
    this.#reader.close();
  }

  // The player asked for [start, start + length): answer from the blocks that cover it.
  async #answer(start, length) {
    if (this.#closed) throw new Error("The video was closed");
    const end = Math.min(start + length, this.size);
    this.#position = end;
    const first = Math.floor(start / BLOCK);
    const last = Math.floor((end - 1) / BLOCK);
    const wanted = [];
    for (let i = first; i <= last; i++) wanted.push(this.#block(i));
    this.#pump();
    const parts = await Promise.all(wanted);
    const out = new Uint8Array(end - start);
    let at = 0;
    for (let k = 0; k < parts.length; k++) {
      const blockStart = (first + k) * BLOCK;
      const from = Math.max(start, blockStart) - blockStart;
      const to = Math.min(end, blockStart + parts[k].byteLength) - blockStart;
      out.set(parts[k].subarray(from, to), at);
      at += to - from;
    }
    return out;
  }

  // One block, from the cache or the network. Reads of the same record share one fetch in the
  // client, so several blocks of one record cost one network fetch.
  #block(i) {
    const held = this.#blocks.get(i);
    if (held) return held.promise;
    const entry = { bytes: null, promise: null };
    const start = i * BLOCK;
    const length = Math.min(BLOCK, this.size - start);
    this.#inFlight++;
    if (this.#inFlight >= this.parallel && !this.#busySince) this.#busySince = performance.now();
    entry.promise = this.#reader
      .read(start, length)
      .then(
        (bytes) => {
          entry.bytes = bytes;
          if (this.#busySince) this.#busyBytes += bytes.byteLength;
          this.#failed.delete(i);
          this.onFetched?.(start, bytes.byteLength);
          return bytes;
        },
        (e) => {
          if (this.#blocks.get(i) === entry) this.#blocks.delete(i);
          this.#failed.set(i, performance.now());
          throw e;
        },
      )
      .finally(() => {
        this.#inFlight--;
        if (this.#busySince && this.#inFlight < this.parallel) {
          this.#spells.push([performance.now() - this.#busySince, this.#busyBytes, performance.now()]);
          if (this.#spells.length > 50) this.#spells.shift();
          this.#busySince = 0;
          this.#busyBytes = 0;
        }
        this.#pump();
      });
    // A prefetch that fails is only retried later; nobody is waiting on it.
    entry.promise.catch(() => {});
    this.#blocks.set(i, entry);
    return entry.promise;
  }

  // Fetch the nearest missing blocks in the window, and let go of those outside it.
  #pump() {
    if (this.#closed) return;
    const from = Math.floor(this.#position / BLOCK);
    const to = Math.min(this.#lastBlock, from + this.ahead);
    const now = performance.now();
    for (let i = from; i <= to && this.#inFlight < this.parallel; i++) {
      if (this.#blocks.has(i)) continue;
      const failedAt = this.#failed.get(i);
      if (failedAt !== undefined && now - failedAt < RETRY_AFTER_MS) continue;
      this.#block(i);
    }
    // Keep the first block: players go back to the file's header after a seek.
    for (const [i, entry] of this.#blocks) {
      if (entry.bytes && i !== 0 && (i < from - KEEP_BEHIND || i > to)) this.#blocks.delete(i);
    }
  }
}
