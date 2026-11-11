import { describe, expect, it } from "vitest";
import { isLoaderOrigin } from "../../src/warm";

describe("isLoaderOrigin", () => {
  const ok = (origin: string) => isLoaderOrigin(origin, "antnet.example", "https:", "");

  it("accepts the loader root and any site under it", () => {
    expect(ok("https://antnet.example")).toBe(true);
    expect(ok("https://start.antnet.example")).toBe(true);
    expect(ok("https://iaaaa.antnet.example")).toBe(true);
  });

  it("rejects other hosts, lookalikes, other schemes and other ports", () => {
    expect(ok("https://evil.example")).toBe(false);
    expect(ok("https://antnet.example.evil.example")).toBe(false);
    expect(ok("https://notantnet.example")).toBe(false);
    expect(ok("http://start.antnet.example")).toBe(false);
    expect(ok("https://start.antnet.example:8443")).toBe(false);
    expect(ok("null")).toBe(false);
    expect(ok("")).toBe(false);
  });

  it("matches the port in local development", () => {
    expect(isLoaderOrigin("http://start.localhost:4173", "localhost", "http:", "4173")).toBe(true);
    expect(isLoaderOrigin("http://start.localhost:5173", "localhost", "http:", "4173")).toBe(false);
  });
});
