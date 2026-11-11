// The network boundary (spec 11.2). Only the shell uses a SiteSource.

export interface FetchArchiveOptions {
  maxBytes: number;
  signal?: AbortSignal;
  /** Progress in bytes, or in records (chunks) when the source only knows that. */
  onProgress?: (done: number, total?: number, unit?: "bytes" | "records") => void;
}

export interface FetchArchiveResult {
  bytes: Uint8Array;
  /** Content hash reported by the source (BLAKE3 for Autonomi). */
  blake3: string;
  /** Content chunks, not counting the DataMap record. */
  chunks: number;
}

export interface SiteSource {
  /** Human-readable name for the info page. */
  readonly name: string;
  /** Open the network connection. Optional: other calls connect lazily. */
  connect?(signal?: AbortSignal): Promise<void>;
  /** Follow a pointer to the archive address (64 hex). Rejects unless the final target kind is "chunk". */
  resolvePointer(address: string, signal?: AbortSignal): Promise<string>;
  /** Download and verify a public file. Rejects if it is larger than maxBytes. */
  fetchArchive(address: string, opts: FetchArchiveOptions): Promise<FetchArchiveResult>;
  close(): void;
}

export type SourceErrorCode = "too-large" | "not-found" | "not-chunk" | "aborted" | "network" | "verify";

export class SourceError extends Error {
  constructor(
    message: string,
    readonly code: SourceErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SourceError";
  }
}
