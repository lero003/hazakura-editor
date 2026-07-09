import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const identity = process.env.APPLE_SIGNING_IDENTITY || "-";
const appPath = resolve(
  "src-tauri/target/universal-apple-darwin/release/bundle/macos/Hazakura Editor.app",
);
const helperPaths = [
  resolve(appPath, "Contents/MacOS/hazakura-local-assist-helper"),
  resolve(appPath, "Contents/MacOS/hazakura-import-assist-helper"),
];
const appEntitlements = resolve(
  "src-tauri/entitlements/mac-app-store.entitlements",
);
const helperEntitlements = resolve(
  "src-tauri/entitlements/app-store-helper.plist",
);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

for (const path of [appPath, ...helperPaths, appEntitlements, helperEntitlements]) {
  if (!existsSync(path)) {
    throw new Error(`Required App Store signing input is missing: ${path}`);
  }
}

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
