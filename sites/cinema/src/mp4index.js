// Where a moment of an MP4 lives in the file: just enough of the MP4 index ("moov") to turn a
// time into the byte offset of the video keyframe at or before it. Cinema uses it to fetch the
// part of the other copy it is about to switch to, before switching (player.js, "Switching").
//
// Handles what ffmpeg writes with -movflags +faststart: the index near the start of the file,
// one video track, chunk offsets in stco or co64. Edit lists are ignored (a few frames at most).

const text = (bytes, at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);

/** The boxes in bytes[start, end): [{ type, start, body, end }], positions within bytes. */
function boxes(bytes, start, end) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let at = start;
  while (at + 8 <= end) {
    let size = view.getUint32(at);
    let body = at + 8;
    if (size === 1) {
      if (at + 16 > end) break;
      size = Number(view.getBigUint64(at + 8));
      body = at + 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < body - at) break;
    out.push({ type: text(bytes, at + 4), start: at, body, end: at + size });
    at += size;
  }
  return out;
}

/**
 * Where the moov box is, from the first bytes of the file: { start, size }, or null when it
 * doesn't start within them (an index at the end of the file).
 */
export function findMoov(head) {
  for (const box of boxes(head, 0, head.byteLength)) {
    if (box.type === "moov") return { start: box.start, size: box.end - box.start };
    if (box.type === "mdat") return null;
  }
  return null;
}

/** The video track's sample tables, from the whole moov box (its header included). */
export function parseMoov(moov) {
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const child = (box, type) => boxes(moov, box.body, Math.min(box.end, moov.byteLength)).find((b) => b.type === type);
  const [top] = boxes(moov, 0, moov.byteLength);
  if (top?.type !== "moov") throw new Error("not an MP4 index");
  for (const trak of boxes(moov, top.body, top.end).filter((b) => b.type === "trak")) {
    const mdia = child(trak, "mdia");
    const hdlr = mdia && child(mdia, "hdlr");
    if (!hdlr || text(moov, hdlr.body + 8) !== "vide") continue;
    const mdhd = child(mdia, "mdhd");
    const minf = child(mdia, "minf");
    const stbl = minf && child(minf, "stbl");
    if (!mdhd || !stbl) throw new Error("the video track has no sample tables");
    const timescale = view.getUint32(mdhd.body + (moov[mdhd.body] === 1 ? 20 : 12));
    const table = (type) => child(stbl, type);
    // A full box's entry count and where its entries start.
    const entries = (box) => ({ n: view.getUint32(box.body + 4), at: box.body + 8 });

    const sttsBox = table("stts");
    const { n: sttsN, at: sttsAt } = entries(sttsBox);
    const stts = [];
    for (let i = 0; i < sttsN; i++) stts.push([view.getUint32(sttsAt + i * 8), view.getUint32(sttsAt + i * 8 + 4)]);

    const stssBox = table("stss");
    let stss = null;
    if (stssBox) {
      const { n, at } = entries(stssBox);
      stss = new Uint32Array(n);
      for (let i = 0; i < n; i++) stss[i] = view.getUint32(at + i * 4);
    }

    const { n: stscN, at: stscAt } = entries(table("stsc"));
    const stsc = [];
    for (let i = 0; i < stscN; i++) stsc.push([view.getUint32(stscAt + i * 12), view.getUint32(stscAt + i * 12 + 4)]);

    const stszBox = table("stsz");
    const fixed = view.getUint32(stszBox.body + 4);
    const count = view.getUint32(stszBox.body + 8);
    let sizes = null;
    if (!fixed) {
      sizes = new Uint32Array(count);
      for (let i = 0; i < count; i++) sizes[i] = view.getUint32(stszBox.body + 12 + i * 4);
    }

    const co64 = table("co64");
    const stco = co64 ?? table("stco");
    const chunks = view.getUint32(stco.body + 4);
    const offsets = new Float64Array(chunks);
    for (let i = 0; i < chunks; i++) {
      offsets[i] = co64 ? Number(view.getBigUint64(stco.body + 8 + i * 8)) : view.getUint32(stco.body + 8 + i * 4);
    }
    return { timescale, stts, stss, stsc, fixed, sizes, count, offsets };
  }
  throw new Error("no video track");
}

/** The byte offset of the video keyframe at or before `seconds`. */
export function keyframeOffset(index, seconds) {
  const { timescale, stts, stss, stsc, fixed, sizes, count, offsets } = index;
  // The sample playing at that time.
  const target = Math.max(0, seconds) * timescale;
  let sample = 0;
  let time = 0;
  for (const [n, delta] of stts) {
    if (time + n * delta > target) {
      sample += Math.floor((target - time) / delta);
      break;
    }
    time += n * delta;
    sample += n;
  }
  sample = Math.min(sample, count - 1);
  // The keyframe at or before it (stss numbers samples from 1; none means every one is).
  if (stss) {
    let lo = 0;
    let hi = stss.length - 1;
    let key = stss[0];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (stss[mid] - 1 <= sample) {
        key = stss[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    sample = key - 1;
  }
  // Its chunk, from the runs of chunks with the same number of samples (chunks from 1).
  let first = 0; // the run's first sample
  for (let r = 0; r < stsc.length; r++) {
    const [chunk, perChunk] = stsc[r];
    const nextChunk = r + 1 < stsc.length ? stsc[r + 1][0] : offsets.length + 1;
    const inRun = (nextChunk - chunk) * perChunk;
    if (sample < first + inRun) {
      const c = chunk - 1 + Math.floor((sample - first) / perChunk);
      const firstInChunk = first + Math.floor((sample - first) / perChunk) * perChunk;
      let at = offsets[c];
      for (let s = firstInChunk; s < sample; s++) at += fixed || sizes[s];
      return at;
    }
    first += inRun;
  }
  return offsets[offsets.length - 1];
}
