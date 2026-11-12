import type { ProgressEvent } from "@withautonomi/ant-browser-sdk";

export interface ProgressView {
  /** 0–1 when measurable, otherwise undefined (indeterminate). */
  fraction?: number;
  completed?: number;
  total?: number;
  unit?: "bytes" | "records";
  message: string;
}

/**
 * Normalise an SDK progress event. Prefers structured completed/total; falls
 * back to "Downloaded chunk n/N" in the message, which is how the 0.1.0 core
 * reports per-chunk progress.
 */
export function readProgress(e: Pick<ProgressEvent, "message" | "completed" | "total" | "unit">): ProgressView {
  if (e.total && e.total > 0 && e.completed !== undefined && (e.unit === "bytes" || e.unit === "records")) {
    return { fraction: clamp(e.completed / e.total), completed: e.completed, total: e.total, unit: e.unit, message: e.message };
  }
  const m = /chunk (\d+)\s*\/\s*(\d+)/i.exec(e.message);
  if (m) {
    const completed = Number(m[1]);
    const total = Number(m[2]);
    if (total > 0) return { fraction: clamp(completed / total), completed, total, unit: "records", message: e.message };
  }
  return { message: e.message };
}

/** "Ready to stream x.bin (574 bytes, 3 chunks)" → 3. */
export function chunkCountFromMessage(message: string): number | undefined {
  const m = /(\d+) chunks?\)/.exec(message);
  return m ? Number(m[1]) : undefined;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
