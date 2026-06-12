import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Hook / pure-module tests for the front end. Kept separate from
// `vite.config.ts` so the production build config does not carry
// jsdom or testing-library surface. Tauri IPC, native menus, and
// the Rust runtime are NOT mocked here — tests stick to hooks /
// helpers that do not call into Tauri (or stub the small surface
// they need at the call site). The Rust layer continues to be
// covered by `cargo test --manifest-path src-tauri/Cargo.toml`.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 20_000,
  },
});
