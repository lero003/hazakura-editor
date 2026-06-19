import { execFileSync } from "node:child_process";
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
const appStorePreviewConfigJson = JSON.parse(appStorePreviewConfig) as {
  build?: { frontendDist?: string };
};
const appStoreSubmitConfig = readFileSync(
  "src-tauri/tauri.conf.appstore.json",
  "utf8",
);
const appStoreSubmitConfigJson = JSON.parse(appStoreSubmitConfig) as {
  build?: { frontendDist?: string };
  bundle?: { macOS?: { bundleVersion?: string } };
};
const tauriConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")) as {
  app?: {
    windows?: Array<{
      hiddenTitle?: boolean;
      titleBarStyle?: string;
      trafficLightPosition?: { x?: number; y?: number };
      transparent?: boolean;
    }>;
  };
};
const defaultCapability = JSON.parse(
  readFileSync("src-tauri/capabilities/default.json", "utf8"),
) as {
  permissions?: string[];
  windows?: string[];
};
const appStoreEntitlements = readFileSync(
  "src-tauri/entitlements/mac-app-store.entitlements",
  "utf8",
);
const viteConfig = readFileSync("vite.config.ts", "utf8");

describe("macOS build scripts", () => {
  it("uses an overlay macOS titlebar so the web chrome owns the top material", () => {
    const mainWindow = tauriConfig.app?.windows?.[0];

    expect(mainWindow?.titleBarStyle).toBe("Overlay");
    expect(mainWindow?.hiddenTitle).toBe(true);
    expect(mainWindow?.transparent).toBe(true);
    expect(mainWindow?.trafficLightPosition).toEqual({ x: 18, y: 18 });
  });

  it("allows the main window to start native dragging from custom chrome", () => {
    expect(defaultCapability.windows).toEqual(["main"]);
    expect(defaultCapability.permissions).toContain(
      "core:window:allow-start-dragging",
    );
  });

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
    expect(appStorePreviewConfigJson.build?.frontendDist).toBe("../dist");
    expect(appStorePreviewConfig).toContain('"externalBin": []');
    expect(appStorePreviewConfig).not.toContain(
      '"entitlements": "./entitlements/mac-app-store.entitlements"',
    );
    expect(appStoreEntitlements).toContain(
      "<key>com.apple.security.network.client</key>",
    );
    expect(appStoreEntitlements).not.toContain(
      "<key>com.apple.security.network.server</key>",
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
    expect(appStoreSubmitConfigJson.build?.frontendDist).toBe("../dist");
    expect(appStoreSubmitConfig).toContain('"externalBin": []');
    expect(appStoreSubmitConfig).toContain(
      '"entitlements": "./entitlements/mac-app-store.entitlements"',
    );
  });

  it("provides an App Store build-version bump helper for repeated TestFlight uploads", () => {
    expect(packageJson.scripts["bump:app-store-build"]).toBe(
      "node scripts/bump-app-store-build-version.mjs",
    );
    const currentBundleVersion =
      appStoreSubmitConfigJson.bundle?.macOS?.bundleVersion;
    expect(currentBundleVersion).toMatch(/^[1-9]\d*$/);

    const nextFromOne = execFileSync(
      process.execPath,
      ["scripts/bump-app-store-build-version.mjs", "--print-next", "1"],
      { encoding: "utf8" },
    ).trim();
    const nextFromCurrent = execFileSync(
      process.execPath,
      [
        "scripts/bump-app-store-build-version.mjs",
        "--print-next",
        currentBundleVersion ?? "",
      ],
      { encoding: "utf8" },
    ).trim();

    expect(nextFromOne).toBe("2");
    expect(nextFromCurrent).toBe(String(Number(currentBundleVersion) + 1));
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
    expect(macosLanesScript).toContain('app_name="Hazakura Editor"');
    expect(macosLanesScript).toContain(
      'dev_app_name="Hazakura Editor Dev"',
    );
    expect(macosLanesScript).not.toContain(
      "HAZAKURA_DISTRIBUTION_LANE=developer VITE_HAZAKURA_DISTRIBUTION_LANE=developer npm run build",
    );
  });

  it("keeps smoke/probe scripts on the current App Store preview bundle name", () => {
    const probeScript = readFileSync(
      "scripts/probe-macos-distribution.sh",
      "utf8",
    );
    const smokeScript = readFileSync(
      "scripts/smoke-macos-sandbox-preview.sh",
      "utf8",
    );

    expect(probeScript).toContain(
      "src-tauri/target/release/bundle/macos/Hazakura Editor.app",
    );
    expect(probeScript).toContain(
      'EXPECTED_DISTRIBUTION_LANE="${EXPECTED_DISTRIBUTION_LANE:-app-store}"',
    );
    expect(probeScript).toContain(
      "App Store lane must not bundle Apple Assist helper",
    );
    expect(smokeScript).toContain(
      "src-tauri/target/release/bundle/macos/Hazakura Editor.app",
    );
    expect(probeScript).not.toContain(
      "src-tauri/target/release/bundle/macos/hazakura editor.app",
    );
    expect(smokeScript).not.toContain(
      "src-tauri/target/release/bundle/macos/hazakura editor.app",
    );
  });
});
