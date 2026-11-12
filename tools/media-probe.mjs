#!/usr/bin/env node
// Check a public file on Autonomi before streaming it (DEMO.md 3.4): what the SDK says it is,
// how long it takes to open and read, and for an MP4, where its index ("moov") sits and
// which codecs it uses. Reads only the head and tail, never the whole file.
// Needs the dev server: npx vite --port 5180 --strictPort
//   node tools/media-probe.mjs <address>

import { chromium } from "@playwright/test";

const address = process.argv[2]?.toLowerCase().replace(/^0x/, "");
if (!/^[0-9a-f]{64}$/.test(address ?? "")) {
  console.error("Usage: node tools/media-probe.mjs <address>");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log(`  ${m.text()}`));
await page.goto("http://localhost:5180/_autonomi/");
await page.evaluate(async (address) => {
  const { AutonomiClient } = await import("/@id/@withautonomi/ant-browser-sdk");
  const ms = (t) => `${((performance.now() - t) / 1000).toFixed(1)} s`;
  const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
  const fourcc = (b, i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
  const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

  let t = performance.now();
  const client = await AutonomiClient.connect();
  console.log(`connect      ${ms(t)}`);
  t = performance.now();
  const reader = await client.openFile(address);
  console.log(`openFile     ${ms(t)}`);
  console.log(`name         ${JSON.stringify(reader.name)}`);
  console.log(`size         ${reader.size} bytes (${mb(reader.size)})`);
  console.log(`contentType  ${JSON.stringify(reader.contentType)}`);

  // Matroska / WebM: EBML signature 1A 45 DF A3. Read the head and pick out the facts that
  // matter for playback: DocType, codecs, frame size, duration, and where the index (Cues) is.
  const magic = await reader.read(0, 4);
  const boxes = [];
  if (u32(magic, 0) === 0x1a45dfa3) {
    t = performance.now();
    const head = await reader.read(0, 256 * 1024);
    console.log(`head read    ${ms(t)} (256 KiB)`);
    // EBML variable-length ints: the leading zero bits give the length.
    const vint = (i, keepMarker) => {
      const first = head[i];
      let len = 1;
      while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
      let v = keepMarker ? first : first & (0xff >> len);
      for (let k = 1; k < len; k++) v = v * 256 + head[i + k];
      return { v, len };
    };
    const ascii = (i, n) => String.fromCharCode(...head.subarray(i, i + n));
    const uint = (i, n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + head[i + k]; return v; };
    // Element IDs whose children we walk into, and ones whose values we report.
    const MASTER = new Set([0x1a45dfa3, 0x18538067, 0x114d9b74, 0x4dbb, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0xe1]);
    const names = { 0x4282: "DocType", 0x86: "CodecID", 0xb0: "PixelWidth", 0xba: "PixelHeight", 0x4489: "Duration", 0x2ad7b1: "TimecodeScale", 0x53ab: "SeekID", 0x53ac: "SeekPosition", 0x9f: "Channels", 0xb5: "SamplingFrequency" };
    const facts = [];
    let segmentData = 0;
    const walk = (start, end, depth) => {
      let i = start;
      while (i < end && i < head.length - 12) {
        const id = vint(i, true);
        const size = vint(i + id.len, false);
        const data = i + id.len + size.len;
        if (id.v === 0x18538067) segmentData = data;
        if (id.v === 0x1f43b675) { facts.push(["Cluster (media starts)", data]); return; }
        if (MASTER.has(id.v)) walk(data, id.v === 0x18538067 ? head.length : data + size.v, depth + 1);
        else if (names[id.v]) {
          const n = names[id.v];
          let val;
          if (n === "DocType" || n === "CodecID") val = ascii(data, size.v);
          else if (n === "Duration" || n === "SamplingFrequency") val = size.v === 8 ? new DataView(head.buffer, head.byteOffset + data, 8).getFloat64(0) : new DataView(head.buffer, head.byteOffset + data, 4).getFloat32(0);
          else if (n === "SeekID") val = uint(data, size.v).toString(16);
          else val = uint(data, size.v);
          facts.push([n, val]);
        }
        if (id.v === 0x18538067) return;
        i = data + size.v;
      }
    };
    walk(0, head.length, 0);
    let scale = 1e6;
    let seekId = "";
    for (const [n, v] of facts) {
      if (n === "TimecodeScale") scale = v;
      if (n === "SeekID") { seekId = v; continue; }
      if (n === "SeekPosition") {
        const what = { "1c53bb6b": "Cues (index)", "1549a966": "Info", "1654ae6b": "Tracks", "1254c367": "Tags", "1043a770": "Chapters" }[seekId] ?? seekId;
        const at = segmentData + v;
        console.log(`seek entry   ${what.padEnd(13)} at ${at} (${((at / reader.size) * 100).toFixed(1)}% through the file)`);
        continue;
      }
      if (n === "Duration") {
        const s = (v * scale) / 1e9;
        console.log(`duration     ${Math.floor(s / 60)} min ${Math.round(s % 60)} s, so about ${((reader.size * 8) / s / 1e6).toFixed(1)} Mbit/s`);
        continue;
      }
      console.log(`${n.padEnd(12)} ${v}`);
    }
  }

  // Walk the top-level boxes. Each read is at most 4 MiB; a box header is 8 or 16 bytes.
  let pos = 0;
  while (u32(magic, 0) !== 0x1a45dfa3 && pos < reader.size && boxes.length < 50) {
    t = performance.now();
    const head = await reader.read(pos, 16);
    let size = u32(head, 0);
    const type = fourcc(head, 4);
    if (size === 1) size = Number((BigInt(u32(head, 8)) << 32n) | BigInt(u32(head, 12)));
    else if (size === 0) size = reader.size - pos;
    boxes.push({ type, pos, size });
    console.log(`box ${type.padEnd(4)} at ${String(pos).padStart(10)}  size ${String(size).padStart(10)}  (read ${ms(t)})`);
    if (!/^[\x20-\x7e]{4}$/.test(type) || size < 8) {
      console.log("  not an MP4 box structure; stopping");
      break;
    }
    pos += size;
  }

  const moov = boxes.find((b) => b.type === "moov");
  const mdat = boxes.find((b) => b.type === "mdat");
  if (moov && mdat) {
    console.log(`index        moov is at the ${moov.pos < mdat.pos ? "START (fast start)" : "END"} of the file, ${mb(moov.size)}`);
    t = performance.now();
    const body = await reader.read(moov.pos, Math.min(moov.size, 4 * 1024 * 1024));
    console.log(`moov read    ${ms(t)}`);
    const text = new TextDecoder("latin1").decode(body);
    const found = ["avc1", "avc3", "hvc1", "hev1", "av01", "vp09", "mp4a", "ac-3", "ec-3", "Opus"].filter((c) => text.includes(c));
    console.log(`codecs       ${found.join(", ") || "none recognised"}`);
    // mvhd: timescale and duration give the length of the film.
    const i = text.indexOf("mvhd");
    if (i > 0) {
      const v = body[i + 4];
      const ts = v === 1 ? u32(body, i + 24) : u32(body, i + 16);
      const dur = v === 1 ? Number((BigInt(u32(body, i + 28)) << 32n) | BigInt(u32(body, i + 32))) : u32(body, i + 20);
      const s = dur / ts;
      console.log(`duration     ${Math.floor(s / 60)} min ${Math.round(s % 60)} s, so about ${((reader.size * 8) / s / 1e6).toFixed(1)} Mbit/s`);
    }
    const tk = [...text.matchAll(/tkhd/g)].map((m) => m.index);
    for (const k of tk) {
      const v = body[k + 4];
      const off = k + 4 + (v === 1 ? 88 : 76);
      const w = u32(body, off) / 65536;
      const h = u32(body, off + 4) / 65536;
      if (w && h) console.log(`video track  ${w} x ${h}`);
    }
  }

  // A read from the middle, as a seek would.
  t = performance.now();
  await reader.read(Math.floor(reader.size * 0.5), 1024 * 1024);
  console.log(`1 MiB at 50% ${ms(t)}`);
  t = performance.now();
  await reader.read(Math.floor(reader.size * 0.85), 1024 * 1024);
  console.log(`1 MiB at 85% ${ms(t)}`);
  reader.close();
  client.close();
}, address);
await browser.close();
