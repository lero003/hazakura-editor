import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const appStoreLane =
  process.env.VITE_HAZAKURA_DISTRIBUTION_LANE === "app-store" ||
  process.env.HAZAKURA_DISTRIBUTION_LANE === "app-store";

const appStoreStyles: Plugin = {
  name: "hazakura-app-store-styles",
  enforce: "pre",
  apply: "build",
  transform(source, id) {
    if (!appStoreLane || id !== resolve(import.meta.dirname, "src/styles/index.css")) return;
    // Omit Agent-only rules before CSS imports are expanded. Developer keeps
    // the original import order, including the later accessibility overrides.
    // Keep these import lines aligned with index.css; validate generated output
    // with scripts/check-frontend-bundle-boundary.mjs for both lanes.
    return source.replace(/^@import "\.\/(?:agent-window|editor-extras)\.css";\r?\n/gm, "");
  },
};

export default defineConfig({
  plugins: [react(), appStoreStyles],
  clearScreen: false,
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: 1420,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        "apple-assist": resolve(import.meta.dirname, "apple-assist.html"),
        ...(appStoreLane
          ? {}
          : {
              agent: resolve(import.meta.dirname, "agent.html"),
            }),
      },
    },
  },
});
