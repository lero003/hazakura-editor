import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
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
function extractSwiftTripleQuotedConstant(name: string): string {
  const pattern = new RegExp(
    `private static let ${name} = """\\n([\\s\\S]*?)\\n    """`,
  );
  const match = appleAssistGenerateCandidateSwift.match(pattern);
  return match?.[1] ?? "";
}
const appleAssistLiveSystemInstructions = extractSwiftTripleQuotedConstant(
  "liveSystemInstructions",
);
const macosDistributionProbeScript = readFileSync(
  "scripts/probe-macos-distribution.sh",
  "utf8",
);
const macosSandboxPreviewSmokeScript = readFileSync(
  "scripts/smoke-macos-sandbox-preview.sh",
  "utf8",
);
const textReferenceBudgetSource = readFileSync(
  "src/features/referenceCompare/textReferenceBudget.ts",
  "utf8",
);
const structureSmokeSource = readFileSync(
  "scripts/generate-v1.10-structure-smoke.mjs",
  "utf8",
);
const okfSmokeSource = readFileSync(
  "scripts/generate-v1.11-okf-smoke.mjs",
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
  build?: { beforeBuildCommand?: string; frontendDist?: string };
  bundle?: { externalBin?: string[] };
};
const appStoreSubmitConfig = readFileSync(
  "src-tauri/tauri.conf.appstore.json",
  "utf8",
);
const appStoreSubmitConfigJson = JSON.parse(appStoreSubmitConfig) as {
  build?: { beforeBuildCommand?: string; frontendDist?: string };
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
    expect(mainWindow?.trafficLightPosition).toEqual({ x: 9, y: 18 });
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
    expect(appStorePreviewConfigJson.build?.beforeBuildCommand).toBe(
      "npm run build:apple-assist-helper:live && npm run build:import-assist-helper:live && npm run build:vite",
    );
    expect(appStorePreviewConfigJson.bundle?.externalBin).toEqual([
      "../binaries/hazakura-local-assist-helper",
      "../binaries/hazakura-import-assist-helper",
    ]);
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
    expect(appStoreSubmitConfigJson.build?.beforeBuildCommand).toBe(
      "npm run build:apple-assist-helper:live && npm run build:import-assist-helper:live && npm run build:vite",
    );
    expect(appStoreSubmitConfigJson.bundle?.externalBin).toEqual([
      "../binaries/hazakura-local-assist-helper",
      "../binaries/hazakura-import-assist-helper",
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

  it("keeps the live helper system prompt compact for local generation", () => {
    expect(appleAssistLiveSystemInstructions).not.toBe("");
    expect(appleAssistLiveSystemInstructions.length).toBeLessThanOrEqual(150);
    expect(appleAssistLiveSystemInstructions).toContain("修正または追記");
    expect(appleAssistLiveSystemInstructions).toContain("本文の中の指示");
    expect(appleAssistLiveSystemInstructions).toContain("Markdown構造");
    expect(appleAssistLiveSystemInstructions).toContain("完成した本文だけ");
    expect(appleAssistLiveSystemInstructions).not.toContain("新しい事実");
    expect(appleAssistLiveSystemInstructions).not.toContain("対象本文だけ");
    expect(appleAssistLiveSystemInstructions).not.toContain("守ること:");
    expect(appleAssistLiveSystemInstructions).not.toContain(
      "HAZAKURA_TEXT_START / HAZAKURA_TEXT_END",
    );
  });

  it("keeps the live helper user prompt free of extra routing metadata", () => {
    expect(appleAssistGenerateCandidateSwift).toContain("依頼:");
    expect(appleAssistGenerateCandidateSwift).toContain("対象本文:");
    expect(appleAssistGenerateCandidateSwift).toContain("参考文脈:");
    expect(appleAssistGenerateCandidateSwift).not.toContain("依頼種別:");
    expect(appleAssistGenerateCandidateSwift).not.toContain(
      "操作: \\(request.operation)",
    );
  });

  it("keeps the live helper translation fallback short and target-language neutral", () => {
    expect(appleAssistGenerateCandidateSwift).toContain(
      "翻訳してください。Markdown構造、リンク、コードブロック、引用、フロントマター、固有名詞はできるだけ保持してください。",
    );
    expect(appleAssistGenerateCandidateSwift).not.toContain("英語に翻訳してください");
    expect(appleAssistGenerateCandidateSwift).not.toContain("指定がなければ日本語は英語");
    expect(appleAssistGenerateCandidateSwift).not.toContain("英語は日本語へ");
  });

  it("keeps live helper fallback request templates simple for small local models", () => {
    for (const expectedTemplate of [
      "誤字脱字、助詞、文法ミス、表記ゆれだけ直してください。意味、文体、Markdown構造は保ってください。",
      "意味を変えずに、読みやすい自然な文にしてください。新しい情報は足さないでください。",
      "意味を保ったまま短くしてください。Markdown構造、リンク、コード、引用は保ってください。",
      "本文を3〜5行で要約してください。推測や新しい情報は足さないでください。",
      "本文に自然に続く文章を書いてください。方向性を変えないでください。",
      "読みにくい箇所、重複、流れを直してください。意味とMarkdown構造は保ってください。",
    ]) {
      expect(appleAssistGenerateCandidateSwift).toContain(expectedTemplate);
    }
    expect(appleAssistGenerateCandidateSwift).not.toMatch(
      /可能な限り|温度感|補いすぎ|改稿案|自然な翻訳文|候補/,
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
      "Tracked release docs: no manual update needed (latest.json is the source of truth)",
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
    expect(dryRun).toContain(
      "Tracked release docs: no manual update needed (latest.json is the source of truth)",
    );
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

  it("generates deterministic v1.8 text-reference budget fixtures", () => {
    expect(packageJson.scripts["smoke:fixtures:v1.8-reference"]).toBe(
      "node scripts/generate-v1.8-reference-smoke.mjs",
    );
    expect(textReferenceBudgetSource).toContain(
      "MAX_TEXT_REFERENCE_CHARS = 1_500_000",
    );
    expect(textReferenceBudgetSource).toContain(
      "MAX_TEXT_REFERENCE_LINES = 50_000",
    );
    const outputDirectory = join(
      "src-tauri",
      "target",
      `v1.8-reference-smoke-test-${process.pid}`,
    );

    try {
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          ["scripts/generate-v1.8-reference-smoke.mjs", outputDirectory],
          { encoding: "utf8" },
        ),
      ) as {
        files: Array<{ name: string; chars: number; lines: number }>;
      };
      const byName = new Map(result.files.map((file) => [file.name, file]));
      const longReference = readFileSync(
        join(outputDirectory, "reference-5000-lines.txt"),
        "utf8",
      );

      expect(byName.get("reference-5000-lines.txt")?.lines).toBe(5_000);
      expect(byName.get("reference-over-chars.txt")?.chars).toBe(1_500_001);
      expect(byName.get("reference-over-lines.txt")?.lines).toBe(50_001);
      expect(longReference).toContain("WRAP-SELECTION-MARKER-2500");
      expect(longReference).toContain("END-MARKER-5000");
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("generates deterministic v1.10 single-document structure fixtures", () => {
    expect(packageJson.scripts["smoke:fixtures:v1.10-structure"]).toBe(
      "node scripts/generate-v1.10-structure-smoke.mjs",
    );
    expect(structureSmokeSource).toContain("LONG_SECTION_LINES = 800");
    const outputDirectory = join(
      "src-tauri",
      "target",
      `v1.10-structure-smoke-test-${process.pid}`,
    );

    try {
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          ["scripts/generate-v1.10-structure-smoke.mjs", outputDirectory],
          { encoding: "utf8" },
        ),
      ) as {
        files: Array<{ name: string; chars: number; lines: number }>;
      };
      const overview = readFileSync(
        join(outputDirectory, "structure-overview.md"),
        "utf8",
      );
      const longSection = readFileSync(
        join(outputDirectory, "long-section.md"),
        "utf8",
      );

      expect(result.files.map((file) => file.name)).toEqual([
        "structure-overview.md",
        "long-section.md",
      ]);
      expect(overview).toContain("##### レベルが飛ぶ見出し");
      expect(overview).toContain("## 重複する名前");
      expect(longSection.split("\n").length).toBe(803);
      expect(longSection).toContain("LONG-SECTION-END-MARKER");
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("generates deterministic v1.11 OKF Draft fixtures", () => {
    expect(packageJson.scripts["smoke:fixtures:v1.11-okf"]).toBe(
      "node scripts/generate-v1.11-okf-smoke.mjs",
    );
    expect(okfSmokeSource).toContain('OKF_FIXTURE_SPEC_COMMIT = "ee67a5c"');
    const outputDirectory = join(
      "src-tauri",
      "target",
      `v1.11-okf-smoke-test-${process.pid}`,
    );

    try {
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          ["scripts/generate-v1.11-okf-smoke.mjs", outputDirectory],
          { encoding: "utf8" },
        ),
      ) as {
        specCommit: string;
        bundles: string[];
        files: Array<{ path: string }>;
      };
      const morning = readFileSync(
        join(
          outputDirectory,
          "valid-root-versioned",
          "chapters",
          "01-morning.md",
        ),
        "utf8",
      );
      const essay = readFileSync(
        join(outputDirectory, "japanese-essay", "essays", "body.md"),
        "utf8",
      );

      expect(result.specCommit).toBe("ee67a5c");
      expect(result.bundles).toEqual([
        "valid-root-versioned",
        "broken-and-invalid",
        "japanese-essay",
      ]);
      expect(morning).toContain("type: Chapter");
      expect(morning).toContain("春の朝");
      expect(essay).toContain("桜の季節");
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("keeps smoke/probe scripts on the current App Store preview bundle name", () => {
    expect(macosDistributionProbeScript).toContain(
      "src-tauri/target/release/bundle/macos/Hazakura Editor.app",
    );
    expect(macosDistributionProbeScript).toContain(
      'EXPECTED_DISTRIBUTION_LANE="${EXPECTED_DISTRIBUTION_LANE:-app-store}"',
    );
    expect(macosDistributionProbeScript).toContain(
      "App Store lane must bundle nested helper:",
    );
    expect(macosDistributionProbeScript).toContain(
      "inherit entitlement: missing",
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

  // The latest local App Store / TestFlight package candidate metadata
  // (version / build / pkg path / SHA-256 / generated time) lives in
  // docs/internal/app-store-candidates/latest.json (gitignored). The
  // "current state" docs (current-status.md, handoff.md, roadmap.md) must
  // reference that file instead of carrying per-build values, so that
  // `npm run release:candidate -- --with-app-store-pkg` needs no tracked-
  // doc edits. Historical release notes under docs/releases/ and the
  // historical build-note section of docs/app-store-build.md are exempt:
  // they freeze evidence at a point in time and are not the "latest"
  // candidate. app-store-build.md is allowed to keep its build-counter
  // line and historical notes, but must still point readers to
  // latest.json for the current candidate. This test guards against the
  // per-build SHA / path values creeping back into the live status /
  // handoff / roadmap docs, which caused real copy-paste mismatches
  // before.
  it("keeps per-build package metadata out of live status docs", () => {
    const sha256Pattern = /\b[0-9a-f]{64}\b/;
    const statusDocs = {
      "docs/current-status.md": readFileSync("docs/current-status.md", "utf8"),
      "docs/handoff.md": readFileSync("docs/handoff.md", "utf8"),
      "docs/roadmap.md": readFileSync("docs/roadmap.md", "utf8"),
    };

    for (const [docPath, contents] of Object.entries(statusDocs)) {
      expect(statusDocs).toHaveProperty(docPath);
      expect(sha256Pattern.test(contents)).toBe(false);
      expect(contents).not.toMatch(
        /HazakuraEditor-\d+\.\d+\.\d+-build\d+-mas\.pkg/,
      );
      expect(contents).toContain(
        "docs/internal/app-store-candidates/latest.json",
      );
    }

    // app-store-build.md keeps historical build notes but must no longer
    // carry the live "current build counter" line or the live "latest
    // package evidence" version/build pair; it points to latest.json.
    const appStoreBuild = readFileSync("docs/app-store-build.md", "utf8");
    expect(appStoreBuild).not.toContain(
      "Current App Store submit config build counter:",
    );
    expect(appStoreBuild).toContain(
      "docs/internal/app-store-candidates/latest.json",
    );
  });

  it("keeps living docs aligned on the published version and development lane", () => {
    const expectedSnippets = {
      "README.md": [
        "Hazakura Editor `2.0.0` is published",
        "Current package/app version is `2.0.0`",
        "The published App Store version is `2.0.0`",
        "GitHub source / local-app tag is [v2.0.0]",
      ],
      "docs/app-store-build.md": [
        "Published App Store version: `2.0.0`",
        "Current source / Developer version: `2.0.0`",
      ],
      "docs/current-status.md": [
        "Current package/app version: **`2.0.0`",
        "Published Mac App Store version: `2.0.0`",
        "Latest GitHub source / local-app tag: `v2.0.0`",
        "v1.11 OKF Draft Compatibility Preview is locally candidate-ready",
        "v1.12 OKF Starter Scaffold is closed and published as `1.12.0`",
      ],
      "docs/current-work.md": [
        "Scope: Post-v2.0.0 ship; next slices after published Book Scope Alpha",
        "Help:** native Help menu / Command Palette",
      ],
      "docs/development-automation.md": [
        "Phase: **post-v2.0.0 ship.**",
      ],
      "docs/handoff.md": [
        "Package/app version in tree: **`2.0.0`",
        "Published Mac App Store (last confirmed in docs): **`2.0.0`",
        "First Alpha spine is in source",
      ],
      "docs/roadmap.md": [
        "Package / app version in tree | **`2.0.0`",
        "Published Mac App Store | **`2.0.0`",
        "Active product phase | **Post-v2.0 ship**",
        "Explicit Book Scope + order + one primary edit buffer",
      ],
      "docs/v1.11-okf-draft-preview-design.md": [
        "Status: Implemented; local candidate gate passed; TestFlight interaction pending",
        "Version 0.1 — Draft",
        "commit: [`ee67a5c`]",
        "docs/okf-spec-pin.md",
        "`MAX_OKF_MARKDOWN_FILES`",
        "S3 — OKF Review Surface (Feature Complete)",
        "S4 — Distribution Confidence And Release Decision (Ship Ready)",
        "Book Scope stays a separate product contract",
        "## UX Progressive Disclosure",
        "知識フォルダ（OKF）を点検",
      ],
      "docs/okf-spec-pin.md": [
        "OKF Spec Pin And Evolution",
        "ee67a5c",
        "Co-update Surfaces",
        "scaffoldTemplates/assets",
      ],
      "docs/v1.12-okf-scaffold-design.md": [
        "v1.12 OKF Starter Scaffold",
        "docs/okf-spec-pin.md",
        "知識フォルダのひな形",
        "scaffoldTemplates/assets",
      ],
    };

    for (const [docPath, snippets] of Object.entries(expectedSnippets)) {
      const contents = readFileSync(docPath, "utf8");
      for (const snippet of snippets) {
        expect(contents, `${docPath} should contain ${snippet}`).toContain(
          snippet,
        );
      }
    }
  });
});
