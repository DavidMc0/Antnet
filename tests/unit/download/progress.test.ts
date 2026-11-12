import { describe, expect, it } from "vitest";
import { chunkCountFromMessage, readProgress } from "../../../sites/download/src/lib/progress";

describe("readProgress", () => {
  it("prefers structured completed/total", () => {
    expect(readProgress({ message: "x", completed: 50, total: 200, unit: "bytes" })).toMatchObject({
      fraction: 0.25,
      unit: "bytes",
    });
  });
  it("parses 'Downloaded chunk n/N' from the message", () => {
    expect(readProgress({ message: "Downloaded chunk 2/3" })).toMatchObject({ completed: 2, total: 3, unit: "records" });
  });
  it("is indeterminate otherwise", () => {
    expect(readProgress({ message: "Fetching public DataMap" }).fraction).toBeUndefined();
    expect(readProgress({ message: "x", completed: 1, total: 0, unit: "bytes" }).fraction).toBeUndefined();
  });
});

describe("chunkCountFromMessage", () => {
  it("reads the chunk count from openFile's ready message", () => {
    expect(chunkCountFromMessage("Ready to stream public-file-52af.bin (574 bytes, 3 chunks)")).toBe(3);
    expect(chunkCountFromMessage("Opened x")).toBeUndefined();
  });
});
