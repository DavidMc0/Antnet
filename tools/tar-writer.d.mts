export interface TarEntry {
  path: string;
  bytes?: Uint8Array;
  type?: string;
  linkname?: string;
  pax?: Record<string, string>;
}
export interface HeaderFields {
  name?: string;
  prefix?: string;
  type?: string;
  size?: number;
  linkname?: string;
  mode?: number;
  mtime?: number;
  magic?: string;
}
export function header(fields: HeaderFields): Uint8Array;
export function writeTar(entries: TarEntry[]): Uint8Array;
export function concat(parts: Uint8Array[]): Uint8Array;
export function listFiles(dir: string, base?: string): Promise<string[]>;
export function packDir(dir: string, options?: { nonce?: string }): Promise<Uint8Array>;
export function readDir(dir: string): Promise<Map<string, Uint8Array>>;
export function packFiles(files: Map<string, Uint8Array>, options?: { nonce?: string }): Uint8Array;
