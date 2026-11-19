// A stand-in for antd's REST API (health, pointer resolve, public stream with one range),
// serving the fixture archives, for checking Antnet Gateway without the network.
// Usage: node tools/fake-antd.mjs public/_autonomi/fixtures 47199
//   then: antnet-gateway --loader dist-local --antd http://127.0.0.1:47199
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [dir, port] = process.argv.slice(2);
const log = [];
createServer((req, res) => {
  log.push(req.url);
  console.log("antd", req.method, req.url, req.headers.range ?? "");
  let m;
  if (req.url === "/health") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ status: "ok", version: "fake", network: "fixture", connected_peers: 5 }));
  }
  if ((m = /^\/v1\/pointers\/([0-9a-f]{64})\/resolve$/.exec(req.url))) {
    const f = join(dir, "pointers", `${m[1]}.json`);
    if (!existsSync(f)) return (res.statusCode = 404), res.end("pointer not found");
    const p = JSON.parse(readFileSync(f, "utf8"));
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ kind: p.kind, kind_tag: p.kind === "chunk" ? 0 : 1, target: p.target }));
  }
  if ((m = /^\/v1\/data\/public\/([0-9a-f]{64})\/stream$/.exec(req.url))) {
    const f = join(dir, `${m[1]}.tar`);
    if (!existsSync(f)) return (res.statusCode = 404), res.end("not found");
    const data = readFileSync(f);
    res.setHeader("content-type", "application/octet-stream");
    res.setHeader("accept-ranges", "bytes");
    const r = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    if (r) {
      const a = Number(r[1]);
      const b = r[2] ? Number(r[2]) : data.length - 1;
      res.statusCode = 206;
      res.setHeader("content-range", `bytes ${a}-${b}/${data.length}`);
      res.setHeader("content-length", b - a + 1);
      return res.end(data.subarray(a, b + 1));
    }
    res.setHeader("content-length", data.length);
    return res.end(data);
  }
  res.statusCode = 404;
  res.end("no route");
}).listen(Number(port), "127.0.0.1", () => console.log("fake antd on", port));
