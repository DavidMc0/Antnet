/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOURCE?: "fixture" | "autonomi";
  readonly VITE_LOADER_ROOT?: string;
}
