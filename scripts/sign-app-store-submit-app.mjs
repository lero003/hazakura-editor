import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  profileScopedEntitlements,
  readAndValidateProvisioningProfile,
  validateSignedProfileEntitlements,
} from "./apple-provisioning-profile.mjs";

const identity = process.env.APPLE_SIGNING_IDENTITY;
if (!identity || identity === "-") {
  throw new Error("APPLE_SIGNING_IDENTITY is required for an App Store submit build.");
}
const appPath = resolve(
  "src-tauri/target/universal-apple-darwin/release/bundle/macos/Hazakura Editor.app",
);
const helperPaths = [
  resolve(appPath, "Contents/MacOS/hazakura-local-assist-helper"),
  resolve(appPath, "Contents/MacOS/hazakura-core-ai-helper"),
  resolve(appPath, "Contents/MacOS/hazakura-import-assist-helper"),
];
const appEntitlements = resolve(
  "src-tauri/entitlements/mac-app-store.entitlements",
);
const helperEntitlements = resolve(
  "src-tauri/entitlements/app-store-helper.plist",
);
const extensionPath = resolve(
  appPath,
  "Contents/Extensions/HazakuraBackgroundDownloader.appex",
);
const extensionEntitlements = resolve(
  "src-native/background-downloader/BackgroundDownloader/BackgroundDownloader.entitlements",
);
const mainProfile = resolve(
  process.env.HAZAKURA_APP_STORE_MAIN_PROFILE ||
    "src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile",
);
const extensionProfile = resolve(
  process.env.HAZAKURA_BACKGROUND_DOWNLOADER_PROFILE ||
    "src-tauri/profiles/Hazakura_Background_Downloader_Mac_App_Store_Profile.provisionprofile",
);
const embeddedMainProfile = resolve(
  appPath,
  "Contents/embedded.provisionprofile",
);
const embeddedExtensionProfile = resolve(
  extensionPath,
  "Contents/embedded.provisionprofile",
);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

// The embedded profile grants the application identifier, but codesign does not
// read the profile: the value has to be signed into the bundle's own
// entitlements. Apple rejects a bundle whose signature lacks it (error 90886).
function writeProfileScopedEntitlements(baseEntitlementsPath, outputPath, metadata) {
  const base = JSON.parse(
    capture("plutil", ["-convert", "json", "-o", "-", baseEntitlementsPath]),
  );
  const scoped = profileScopedEntitlements(base, metadata);
  const jsonPath = `${outputPath}.json`;
  writeFileSync(jsonPath, JSON.stringify(scoped), "utf8");
  capture("plutil", ["-convert", "xml1", "-o", outputPath, jsonPath]);
  rmSync(jsonPath, { force: true });
  return outputPath;
}

function verifySignedProfileEntitlements(targetPath, metadata) {
  const dump = capture("codesign", ["-d", "--entitlements", "-", targetPath]);
  validateSignedProfileEntitlements(dump, metadata);
  console.log(`Signed ${metadata.bundleId} carries the profile application identifier.`);
}

for (const path of [
  appPath,
  ...helperPaths,
  appEntitlements,
  helperEntitlements,
  extensionPath,
  extensionEntitlements,
  mainProfile,
  extensionProfile,
]) {
  if (!existsSync(path)) {
    throw new Error(`Required App Store signing input is missing: ${path}`);
  }
}

const mainProfileMetadata = readAndValidateProvisioningProfile(
  mainProfile,
  "dev.hazakura.editor",
  "group.dev.hazakura.editor",
);
const extensionProfileMetadata = readAndValidateProvisioningProfile(
  extensionProfile,
  "dev.hazakura.editor.background-downloader",
  "group.dev.hazakura.editor",
);

const signingRoot = mkdtempSync(join(tmpdir(), "hazakura-app-store-signing-"));
try {
  copyFileSync(mainProfile, embeddedMainProfile);
  copyFileSync(extensionProfile, embeddedExtensionProfile);
  console.log(
    `Embedded main provisioning profile: ${basename(mainProfile)} ` +
      `(expires ${mainProfileMetadata.expiresAt})`,
  );
  console.log(
    `Embedded extension provisioning profile: ${basename(extensionProfile)} ` +
      `(expires ${extensionProfileMetadata.expiresAt})`,
  );

  const scopedExtensionEntitlements = writeProfileScopedEntitlements(
    extensionEntitlements,
    join(signingRoot, "BackgroundDownloader.entitlements"),
    extensionProfileMetadata,
  );
  console.log(`Signing Background Download extension: ${extensionPath}`);
  run("codesign", [
    "--force",
    "--sign",
    identity,
    "--options",
    "runtime",
    "--entitlements",
    scopedExtensionEntitlements,
    extensionPath,
  ]);

  console.log(`App Store submit signing identity: ${identity}`);
  for (const helperPath of helperPaths) {
    console.log(
      `Re-signing nested helper with inherited sandbox entitlement: ${helperPath}`,
    );
    // --force replaces the existing Tauri signature so nested helpers carry
    // sandbox + inherit instead of an app-id signature without a nested profile.
    run("codesign", [
      "--force",
      "--sign",
      identity,
      "--options",
      "runtime",
      "--entitlements",
      helperEntitlements,
      helperPath,
    ]);
  }

  console.log("Re-signing App Store app bundle after helper update.");
  run("codesign", [
    "--force",
    "--sign",
    identity,
    "--options",
    "runtime",
    "--entitlements",
    appEntitlements,
    appPath,
  ]);

  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  verifySignedProfileEntitlements(appPath, mainProfileMetadata);
  verifySignedProfileEntitlements(extensionPath, extensionProfileMetadata);
} finally {
  rmSync(signingRoot, { recursive: true, force: true });
}
