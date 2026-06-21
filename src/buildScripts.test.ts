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
const macosWindowSmokeScript = readFileSync(
  "scripts/smoke-macos-window.sh",
  "utf8",
);
const appStorePkgScript = readFileSync(
  "scripts/build-app-store-pkg.mjs",
  "utf8",
);
const appStoreSubmitSignScript = readFileSync(
  "scripts/sign-app-store-submit-app.mjs",
  "utf8",
);
const appleAssistHelperLiveScript = readFileSync(
  "scripts/build-apple-assist-helper-live.sh",
  "utf8",
);
const appleAssistHelperFixtureScript = readFileSync(
  "scripts/build-apple-assist-helper-fixture.sh",
  "utf8",
);
const appleAssistGenerateCandidateSwift = readFileSync(
  "src-helpers/apple-assist/Sources/HazakuraAppleAssist/GenerateCandidate.swift",
  "utf8",
);
const macosDistributionProbeScript = readFileSync(
  "scripts/probe-macos-distribution.sh",
  "utf8",
);
const macosSandboxPreviewSmokeScript = readFileSync(
  "scripts/smoke-macos-sandbox-preview.sh",
  "utf8",
);
const releaseCandidateScript = readFileSync(
  "scripts/prepare-release-candidate.mjs",
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
  bundle?: { externalBin?: string[]; macOS?: { bundleVersion?: string } };
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
    expect(appStorePreviewConfigJson.build?.frontendDist).toBe("../dist");
    expect(appStorePreviewConfig).toContain(
      '"beforeBuildCommand": "npm run build:apple-assist-helper:live && npm run build:vite"',
    );
    expect(appStorePreviewConfig).toContain(
      '"externalBin": ["../binaries/hazakura-local-assist-helper"]',
    );
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
    expect(viteConfig.indexOf('"apple-assist":')).toBeLessThan(
      viteConfig.indexOf("...(appStoreLane"),
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
    expect(packageJson.scripts["build:app-store-submit"]).toContain(
      "node scripts/sign-app-store-submit-app.mjs",
    );
    expect(packageJson.scripts["build:tauri:app-store-submit"]).toContain(
      "--config src-tauri/tauri.conf.appstore.json",
    );
    expect(appStoreSubmitConfig).toContain(
      '"embedded.provisionprofile": "./profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile"',
    );
    expect(appStoreSubmitConfigJson.build?.frontendDist).toBe("../dist");
    expect(appStoreSubmitConfig).toContain(
      '"beforeBuildCommand": "npm run build:apple-assist-helper:live && npm run build:vite"',
    );
    expect(appStoreSubmitConfigJson.bundle?.externalBin).toEqual([
      "../binaries/hazakura-local-assist-helper",
    ]);
    expect(appStoreSubmitConfig).toContain(
      '"entitlements": "./entitlements/mac-app-store.entitlements"',
    );
    expect(appStoreSubmitSignScript).toContain("app-store-helper.plist");
    expect(appStoreSubmitSignScript).toContain(
      "mac-app-store.entitlements",
    );
    expect(appleAssistHelperLiveScript).toContain(
      "hazakura-local-assist-helper-universal-apple-darwin",
    );
    expect(appleAssistHelperLiveScript).toContain("lipo -create");
  });

  it("uses a review-neutral Local Assist helper executable name in shipping scripts", () => {
    const shippingSurfaces = [
      appStorePreviewConfig,
      appStoreSubmitConfig,
      appStoreSubmitSignScript,
      appleAssistHelperLiveScript,
      appleAssistHelperFixtureScript,
      macosDistributionProbeScript,
      macosSandboxPreviewSmokeScript,
      macosLanesScript,
    ].join("\n");

    expect(shippingSurfaces).toContain("hazakura-local-assist-helper");
    expect(shippingSurfaces).not.toContain("hazakura-apple-assist-helper");
  });

  it("keeps live helper errors free of Foundation Models debug descriptions", () => {
    expect(appleAssistGenerateCandidateSwift).not.toContain(
      "context.debugDescription",
    );
  });

  it("tells the live helper not to echo Hazakura prompt boundary markers", () => {
    expect(appleAssistGenerateCandidateSwift).toContain(
      "HAZAKURA_TEXT_START / HAZAKURA_TEXT_END",
    );
    expect(appleAssistGenerateCandidateSwift).toContain(
      "区切り文字",
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

  it("wraps App Store pkg candidates without tracked release-doc updates", () => {
    expect(packageJson.scripts["release:candidate"]).toBe(
      "node scripts/prepare-release-candidate.mjs",
    );
    expect(packageJson.scripts["candidate:app-store-pkg"]).toBe(
      "node scripts/prepare-release-candidate.mjs --with-app-store-pkg",
    );
    expect(appStorePkgScript).toContain("App Store bundleVersion:");
    expect(appStorePkgScript).toContain(
      "Restored App Store bundleVersion after failed package build.",
    );
    expect(appStorePkgScript).toContain("PKG_PATH=");
    expect(releaseCandidateScript).toContain("npm run smoke:app-store-surface");
    expect(releaseCandidateScript).toContain("npm run build:app-store-pkg");
    expect(releaseCandidateScript).toContain(
      "docs/internal/app-store-candidates/latest.json",
    );
    expect(releaseCandidateScript).toContain(
      "Tracked release docs were not updated.",
    );

    const dryRun = execFileSync(
      process.execPath,
      [
        "scripts/prepare-release-candidate.mjs",
        "--with-app-store-pkg",
        "--keep-pkgs=3",
        "--dry-run",
      ],
      { encoding: "utf8" },
    );

    expect(dryRun).toContain("Release candidate plan:");
    expect(dryRun).toContain("npm run smoke:app-store-surface");
    expect(dryRun).toContain("npm run build:app-store-pkg");
    expect(dryRun).toContain("keep highest build numbers: 3");
    expect(dryRun).toContain("Tracked release docs: not updated");
  });

  it("keeps the App Store surface smoke covering Hazakura Local Assist exposure and retired Review Desk exposure", () => {
    const appStoreSurfaceSmoke = packageJson.scripts["smoke:app-store-surface"];

    expect(appStoreSurfaceSmoke).toContain(
      "src/lib/distributionLane.test.ts",
    );
    expect(appStoreSurfaceSmoke).toContain(
      "src/hooks/commandPalette/useCommandPaletteController.test.ts",
    );
    expect(appStoreSurfaceSmoke).toContain(
      "src/components/app/RightPaneToggleControls.test.tsx",
    );
    expect(appStoreSurfaceSmoke).toContain(
      "src/components/app/DocumentMetaBar.test.tsx",
    );
    expect(appStoreSurfaceSmoke).toContain(
      "src/hooks/review/useReviewDeskState.test.ts",
    );
    expect(appStoreSurfaceSmoke).not.toContain("ReviewSurface.test.tsx");
    expect(appStoreSurfaceSmoke).not.toContain("CandidateEditor.test.tsx");
    expect(appStoreSurfaceSmoke).not.toContain("useCandidateFileImport.test.ts");
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

  it("keeps macOS lane ad-hoc signing compatible with nounset shells", () => {
    expect(macosLanesScript).toContain("sign_codesign_target");
    expect(macosLanesScript).not.toContain('"${timestamp_args[@]}"');
  });

  it("provides a built-app window smoke for the Developer preview bundle", () => {
    expect(packageJson.scripts["smoke:macos-window"]).toBe(
      "bash scripts/smoke-macos-window.sh",
    );
    expect(macosWindowSmokeScript).toContain(
      "Hazakura Editor Dev.app",
    );
    expect(macosWindowSmokeScript).toContain("CGWindowListCopyWindowInfo");
    expect(macosWindowSmokeScript).toContain("npm run build:macos-lanes");
    expect(macosWindowSmokeScript).toContain("kCGWindowIsOnscreen");
  });

  it("keeps smoke/probe scripts on the current App Store preview bundle name", () => {
    expect(macosDistributionProbeScript).toContain(
      "src-tauri/target/release/bundle/macos/Hazakura Editor.app",
    );
    expect(macosDistributionProbeScript).toContain(
      'EXPECTED_DISTRIBUTION_LANE="${EXPECTED_DISTRIBUTION_LANE:-app-store}"',
    );
    expect(macosDistributionProbeScript).toContain(
      "App Store lane must bundle Hazakura Local Assist helper",
    );
    expect(macosDistributionProbeScript).toContain(
      "helper inherit entitlement: missing",
    );
    expect(macosSandboxPreviewSmokeScript).toContain(
      "helper-enabled App Store preview",
    );
    expect(macosSandboxPreviewSmokeScript).toContain(
      "App Store preview helper must carry com.apple.security.inherit",
    );
    expect(macosSandboxPreviewSmokeScript).toContain(
      "src-tauri/target/release/bundle/macos/Hazakura Editor.app",
    );
    expect(macosDistributionProbeScript).not.toContain(
      "src-tauri/target/release/bundle/macos/hazakura editor.app",
    );
    expect(macosSandboxPreviewSmokeScript).not.toContain(
      "src-tauri/target/release/bundle/macos/hazakura editor.app",
    );
  });
});
