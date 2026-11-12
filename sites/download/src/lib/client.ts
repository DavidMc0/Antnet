import { AutonomiClient, AutonomiError, getBrowserCapabilities, SDK_LIMITS, type ProgressListener } from "@withautonomi/ant-browser-sdk";

/** Uploads above this are refused by the Rust core. */
export const MAX_UPLOAD_BYTES: number = SDK_LIMITS.maxUploadBytes;

/** Browsers that can't stream to disk hold the whole file in memory, and the SDK refuses downloads above this. */
export const MAX_BUFFERED_DOWNLOAD_BYTES: number = SDK_LIMITS.defaultDownloadMemoryBytes;

/** True when the save picker lets downloads stream straight to disk, at any size (desktop Chromium). */
export function canStreamToDisk(): boolean {
  return getBrowserCapabilities().operations.streamAndSave.available;
}

/** True when this browser can't download a file of this size. */
export function tooLargeHere(size: number): boolean {
  return size > MAX_BUFFERED_DOWNLOAD_BYTES && !canStreamToDisk();
}

let pending: Promise<AutonomiClient> | null = null;
let current: AutonomiClient | null = null;

/** One client per page. A failed attempt is forgotten so the next call retries. */
export function getClient(onProgress?: ProgressListener): Promise<AutonomiClient> {
  if (current && !current.closed) return Promise.resolve(current);
  if (!pending) {
    pending = AutonomiClient.connect({ onProgress }).then(
      (client) => {
        current = client;
        return client;
      },
      (err) => {
        pending = null;
        throw err;
      },
    );
  }
  return pending;
}

/** The connected client, or null. Lets click handlers avoid awaiting before the SDK opens the save picker. */
export function connectedClient(): AutonomiClient | null {
  return current && !current.closed ? current : null;
}

export function closeClient(): void {
  current?.close();
  current = null;
  pending = null;
}

export interface FriendlyError {
  code: string;
  message: string;
  /** The network couldn't be reached (so suggest another network). */
  connection: boolean;
  cancelled: boolean;
}

export function describeError(err: unknown): FriendlyError {
  // A cancelled save picker rejects with a bare AbortError, not an AutonomiError.
  if (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError") {
    return { code: "ABORTED", message: "Cancelled.", connection: false, cancelled: true };
  }
  if (err instanceof AutonomiError) {
    return {
      code: err.code,
      message: err.message,
      connection: err.code === "CONNECTION_FAILED" || err.code === "INITIALIZATION_FAILED",
      cancelled: false,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "UNKNOWN", message, connection: false, cancelled: false };
}
