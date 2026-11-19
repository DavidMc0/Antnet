/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOURCE?: "fixture" | "autonomi";
  readonly VITE_LOADER_ROOT?: string;
  /** "1" shows "Open in the Autonomi app" on the hosted loader (DEMO.md 5.11). */
  readonly VITE_OPEN_IN_APP?: string;
}
