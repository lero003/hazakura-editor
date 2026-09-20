import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const mode = process.argv[2];
if (mode !== "preview" && mode !== "submit") {
  throw new Error("Usage: node scripts/embed-background-downloader-extension.mjs <preview|submit>");
}

const project = resolve("src-native/background-downloader/BackgroundDownloader.xcodeproj");
const derivedData = resolve("src-tauri/target/background-downloader-derived");
const builtExtension = resolve(
  derivedData,
  "Build/Products/Release/HazakuraBackgroundDownloader.appex",
);
const appPath = mode === "submit"
  ? resolve("src-tauri/target/universal-apple-darwin/release/bundle/macos/Hazakura Editor.app")
  : resolve("src-tauri/target/release/bundle/macos/Hazakura Editor.app");
const embeddedExtension = resolve(
  appPath,
  "Contents/Extensions/HazakuraBackgroundDownloader.appex",
);
const extensionEntitlements = resolve(
  "src-native/background-downloader/BackgroundDownloader/BackgroundDownloader.entitlements",
);
const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const submitConfig = JSON.parse(readFileSync("src-tauri/tauri.conf.appstore.json", "utf8"));
const buildVersion = String(submitConfig.bundle?.macOS?.bundleVersion ?? "");
if (!/^\d+$/.test(buildVersion)) {
  throw new Error("App Store bundleVersion must be numeric before building the extension.");
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

if (!existsSync(appPath)) throw new Error(`Tauri app bundle is missing: ${appPath}`);

run("xcodebuild", [
  "-project", project,
  "-scheme", "HazakuraBackgroundDownloader",
  "-configuration", "Release",
  "-derivedDataPath", derivedData,
  "CODE_SIGNING_ALLOWED=NO",
  "CODE_SIGNING_REQUIRED=NO",
  `CURRENT_PROJECT_VERSION=${buildVersion}`,
  `MARKETING_VERSION=${packageVersion}`,
  "build",
]);

if (!existsSync(builtExtension)) {
  throw new Error(`Background Download extension build output is missing: ${builtExtension}`);
}

mkdirSync(resolve(appPath, "Contents/Extensions"), { recursive: true });
rmSync(embeddedExtension, { recursive: true, force: true });
cpSync(builtExtension, embeddedExtension, { recursive: true });

if (mode === "preview") {
  run("codesign", [
    "--force", "--sign", "-", "--entitlements", extensionEntitlements,
    embeddedExtension,
  ]);
  // Embedding changes the containing bundle seal after Tauri's signing step.
  run("codesign", ["--force", "--sign", "-", appPath]);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
}

console.log(`Embedded Background Download extension: ${embeddedExtension}`);
