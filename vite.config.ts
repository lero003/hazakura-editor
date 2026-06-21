import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appStoreLane =
  process.env.VITE_HAZAKURA_DISTRIBUTION_LANE === "app-store" ||
  process.env.HAZAKURA_DISTRIBUTION_LANE === "app-store";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: 1420,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "apple-assist": resolve(__dirname, "apple-assist.html"),
        ...(appStoreLane
          ? {}
          : {
              agent: resolve(__dirname, "agent.html"),
            }),
      },
    },
  },
});
