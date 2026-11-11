// Strict ustar reader (spec section 5.1). Treats the archive as hostile input.

export const MAX_ENTRIES = 10_000;
const BLOCK = 512;

export class TarError extends Error {
  constructor(message: string, readonly entry?: string) {
    super(entry === undefined ? message : `${message}: ${JSON.stringify(entry)}`);
    this.name = "TarError";
  }
}

export interface TarFile {
  path: string;
  bytes: Uint8Array;
}

/** pax keys that carry nothing we need and may be ignored safely. */
const IGNORABLE_PAX_KEYS = new Set([
  "mtime", "atime", "ctime", "uid", "gid", "uname", "gname", "comment", "charset", "hdrcharset",
]);

const decoder = new TextDecoder("utf-8", { fatal: true });

function readString(block: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const limit = offset + length;
  while (end < limit && block[end] !== 0) end++;
  return decoder.decode(block.subarray(offset, end));
}

function readOctal(block: Uint8Array, offset: number, length: number, field: string): number {
  if (block[offset] & 0x80) throw new TarError(`Unsupported base-256 ${field} field`);
  const text = readString(block, offset, length).trim();
  if (text === "") return 0;
  if (!/^[0-7]+$/.test(text)) throw new TarError(`Malformed ${field} field`);
  const value = parseInt(text, 8);
  if (!Number.isSafeInteger(value)) throw new TarError(`Oversized ${field} field`);
  return value;
}

function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < BLOCK; i++) if (block[i] !== 0) return false;
  return true;
}

function checksumOk(block: Uint8Array): boolean {
  const stored = readOctal(block, 148, 8, "checksum");
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i];
  return sum === stored;
}

function hasUstarMagic(block: Uint8Array): boolean {
  // POSIX: "ustar\0" + "00". GNU tar writes "ustar  \0"; accept the magic but not GNU-only entry types.
  const m = String.fromCharCode(...block.subarray(257, 263));
  return m === "ustar\0" || m === "ustar ";
}

/** Parse pax extended header records ("<len> key=value\n"). */
function parsePax(data: Uint8Array, entryName: string): Map<string, string> {
  const out = new Map<string, string>();
  let pos = 0;
  while (pos < data.length) {
    let sp = pos;
    while (sp < data.length && data[sp] !== 0x20) sp++;
    const len = Number(decoder.decode(data.subarray(pos, sp)));
    if (!Number.isInteger(len) || len <= 0 || pos + len > data.length) {
      throw new TarError("Malformed extended header", entryName);
    }
    const record = decoder.decode(data.subarray(sp + 1, pos + len - 1));
    const eq = record.indexOf("=");
    if (eq < 0) throw new TarError("Malformed extended header", entryName);
    out.set(record.slice(0, eq), record.slice(eq + 1));
    pos += len;
  }
  return out;
}

/**
 * Normalise and validate an entry path. Returns the path without a leading "./" and,
 * for directories, without the trailing "/". Returns "" for the root directory entry.
 */
export function normaliseEntryPath(raw: string, isDir: boolean): string {
  if (raw.includes("\0")) throw new TarError("Path contains NUL", raw);
  if (raw.includes("\\")) throw new TarError("Path contains a backslash", raw);
  if (raw.startsWith("/")) throw new TarError("Absolute path", raw);
  let p = raw;
  while (p.startsWith("./")) p = p.slice(2);
  if (isDir && p.endsWith("/")) p = p.slice(0, -1);
  if (p === "" || p === ".") {
    if (isDir) return "";
    throw new TarError("Empty path", raw);
  }
  for (const seg of p.split("/")) {
    if (seg === "..") throw new TarError("Path contains ..", raw);
    if (seg === "" || seg === ".") throw new TarError("Path has an empty or '.' segment", raw);
  }
  return p;
}

export interface ReadTarOptions {
  maxEntries?: number;
}

/** Read a ustar archive. Returns regular files only; file bytes are views into `archive`. */
export function readTar(archive: Uint8Array, options: ReadTarOptions = {}): TarFile[] {
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  if (archive.length < BLOCK || !hasUstarMagic(archive.subarray(0, BLOCK))) {
    throw new TarError("Not a site archive (no ustar header)");
  }

  const files: TarFile[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let entries = 0;
  let pax: Map<string, string> | null = null;

  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (isZeroBlock(header)) break; // end of archive

    let name: string;
    try {
      name = readString(header, 0, 100);
      const prefix = readString(header, 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    } catch {
      throw new TarError(`Entry name is not valid UTF-8 at offset ${offset}`);
    }
    if (!hasUstarMagic(header)) throw new TarError("Missing ustar magic", name);
    if (!checksumOk(header)) throw new TarError("Bad header checksum", name);

    if (++entries > maxEntries) throw new TarError(`More than ${maxEntries} entries`);

    const type = String.fromCharCode(header[156]);
    let size = readOctal(header, 124, 12, "size");
    const dataStart = offset + BLOCK;

    if (type === "x") {
      if (size > archive.length - dataStart) throw new TarError("Entry runs past end of archive", name);
      const records = parsePax(archive.subarray(dataStart, dataStart + size), name);
      for (const key of records.keys()) {
        if (key !== "path" && key !== "size" && !IGNORABLE_PAX_KEYS.has(key)) {
          throw new TarError(`Unsupported extended header key ${JSON.stringify(key)}`, name);
        }
      }
      pax = records;
      offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
      continue;
    }

    if (pax) {
      const paxPath = pax.get("path");
      if (paxPath !== undefined) name = paxPath;
      const paxSize = pax.get("size");
      if (paxSize !== undefined) {
        if (!/^[0-9]+$/.test(paxSize)) throw new TarError("Malformed extended size", name);
        size = Number(paxSize);
      }
      pax = null;
    }

    if (size > archive.length - dataStart) throw new TarError("Entry runs past end of archive", name);

    switch (type) {
      case "0":
      case "\0": {
        const path = normaliseEntryPath(name, false);
        if (seen.has(path)) throw new TarError("Duplicate path", path);
        seen.add(path);
        files.push({ path, bytes: archive.subarray(dataStart, dataStart + size) });
        break;
      }
      case "5": {
        const path = normaliseEntryPath(name, true);
        if (path !== "") {
          if (seen.has(path)) throw new TarError("Duplicate path", path);
          seen.add(path);
        }
        break;
      }
      case "1":
        throw new TarError("Hard links are not allowed", name);
      case "2":
        throw new TarError("Symbolic links are not allowed", name);
      case "3":
      case "4":
      case "6":
        throw new TarError("Device and FIFO entries are not allowed", name);
      default:
        throw new TarError(`Unsupported entry type ${JSON.stringify(type)}`, name);
    }

    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }

  // A file and a directory with the same path is caught by `seen`; a file used as a
  // parent directory ("a" and "a/b") is also invalid.
  const filePaths = new Set(files.map((f) => f.path));
  for (const f of files) {
    let slash = f.path.indexOf("/");
    while (slash >= 0) {
      const parent = f.path.slice(0, slash);
      if (filePaths.has(parent)) throw new TarError("File used as a directory", parent);
      slash = f.path.indexOf("/", slash + 1);
    }
  }
  return files;
}
