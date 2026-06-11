import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
) as { scripts: Record<string, string> };

const macosLanesScript = readFileSync(
  "scripts/build-macos-lanes.sh",
  "utf8",
);
const appStorePreviewConfig = readFileSync(
  "src-tauri/tauri.conf.appstore-preview.json",
  "utf8",
);
const appStoreSubmitConfig = readFileSync(
  "src-tauri/tauri.conf.appstore.json",
  "utf8",
);
const viteConfig = readFileSync("vite.config.ts", "utf8");

describe("macOS build scripts", () => {
  it("keeps npm run build on the normal App Store preview lane", () => {
    expect(packageJson.scripts["build:tauri"]).toBe("tauri build");
    expect(packageJson.scripts.build).toBe("npm run build:app-store-preview");
    expect(packageJson.scripts["build:app-store-preview"]).toContain(
      "HAZAKURA_DISTRIBUTION_LANE=app-store",
    );
    expect(packageJson.scripts["build:app-store-preview"]).toContain(
      "VITE_HAZAKURA_DISTRIBUTION_LANE=app-store",
    );
    expect(packageJson.scripts["build:app-store-preview"]).toContain(
      "npm run build:tauri:app-store-preview",
    );
    expect(packageJson.scripts["build:tauri:app-store-preview"]).toContain(
      "env -u APPLE_SIGNING_IDENTITY",
    );
    expect(packageJson.scripts["build:tauri:app-store-preview"]).toContain(
      "--config src-tauri/tauri.conf.appstore-preview.json",
    );
    expect(appStorePreviewConfig).toContain(
      '"beforeBuildCommand": "npm run build:vite"',
    );
    expect(appStorePreviewConfig).toContain('"externalBin": []');
    expect(appStorePreviewConfig).toContain(
      '"entitlements": "./entitlements/mac-app-store.entitlements"',
    );
    expect(viteConfig).toContain(
      'process.env.VITE_HAZAKURA_DISTRIBUTION_LANE === "app-store"',
    );
    expect(viteConfig).toContain(
      '"apple-assist": resolve(__dirname, "apple-assist.html")',
    );
  });

  it("keeps the App Store submission command on a provisioning-profile config", () => {
    expect(packageJson.scripts["build:app-store-submit"]).toContain(
      "HAZAKURA_DISTRIBUTION_LANE=app-store",
    );
    expect(packageJson.scripts["build:app-store-submit"]).toContain(
      "VITE_HAZAKURA_DISTRIBUTION_LANE=app-store",
    );
    expect(packageJson.scripts["build:app-store-submit"]).toContain(
      "npm run build:tauri:app-store-submit",
    );
    expect(packageJson.scripts["build:tauri:app-store-submit"]).toContain(
      "--config src-tauri/tauri.conf.appstore.json",
    );
    expect(appStoreSubmitConfig).toContain(
      '"embedded.provisionprofile": "./profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile"',
    );
    expect(appStoreSubmitConfig).toContain('"externalBin": []');
  });

  it("uses the dedicated Developer lane script before copying the Dev bundle", () => {
    expect(packageJson.scripts["build:developer-preview"]).toContain(
      "HAZAKURA_DISTRIBUTION_LANE=developer",
    );
    expect(packageJson.scripts["build:developer-preview"]).toContain(
      "VITE_HAZAKURA_DISTRIBUTION_LANE=developer",
    );
    expect(packageJson.scripts["build:developer-preview"]).toContain(
      "npm run build:tauri:developer-preview",
    );
    expect(packageJson.scripts["build:tauri:developer-preview"]).toContain(
      "env -u APPLE_SIGNING_IDENTITY tauri build",
    );
    expect(macosLanesScript).toContain("npm run build:developer-preview");
    expect(macosLanesScript).not.toContain(
      "HAZAKURA_DISTRIBUTION_LANE=developer VITE_HAZAKURA_DISTRIBUTION_LANE=developer npm run build",
    );
  });
});
