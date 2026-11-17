// Cinema's MP4 index reader (sites/cinema/src/mp4index.js). tiny.mp4 is 6 s of ffmpeg's test
// pattern with a sine tone, a keyframe every second, written with -movflags +faststart:
//   ffmpeg -f lavfi -i testsrc=size=64x36:rate=10:duration=6 -f lavfi -i sine=frequency=440:duration=6
//     -c:v libx264 -preset veryfast -g 10 -keyint_min 10 -sc_threshold 0 -pix_fmt yuv420p
//     -c:a aac -b:a 32k -movflags +faststart -shortest tiny.mp4
// The expected offsets are ffprobe's (packet=pts_time,pos,flags) for its keyframes.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error: plain JavaScript, bundled into the Cinema site
import { findMoov, keyframeOffset, parseMoov } from "../../../sites/cinema/src/mp4index.js";

const file = new Uint8Array(readFileSync(new URL("tiny.mp4", import.meta.url)));
const KEYFRAMES = [3670, 8923, 14308, 19703, 25159, 30536];

describe("mp4index", () => {
  it("finds the index at the start of the file", () => {
    const moov = findMoov(file.subarray(0, 4096));
    expect(moov.start).toBeGreaterThan(0);
    expect(moov.start + moov.size).toBeLessThan(KEYFRAMES[0]);
  });

  it("returns null when the media comes before any index", () => {
    // An 8-byte mdat header, then nothing.
    expect(findMoov(new Uint8Array([0, 0, 0, 8, 0x6d, 0x64, 0x61, 0x74]))).toBeNull();
  });

  it("gives the keyframe at or before a time", () => {
    const { start, size } = findMoov(file);
    const index = parseMoov(file.subarray(start, start + size));
    expect(keyframeOffset(index, 0)).toBe(KEYFRAMES[0]);
    expect(keyframeOffset(index, 0.95)).toBe(KEYFRAMES[0]);
    expect(keyframeOffset(index, 1)).toBe(KEYFRAMES[1]);
    expect(keyframeOffset(index, 3.5)).toBe(KEYFRAMES[3]);
    expect(keyframeOffset(index, 5.9)).toBe(KEYFRAMES[5]);
    // Past the end: the last keyframe.
    expect(keyframeOffset(index, 60)).toBe(KEYFRAMES[5]);
  });

  it("refuses bytes that aren't an index", () => {
    expect(() => parseMoov(file.subarray(0, 64))).toThrow();
  });
});
