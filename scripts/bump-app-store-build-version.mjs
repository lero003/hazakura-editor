#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const appStoreConfigPath = new URL(
  "../src-tauri/tauri.conf.appstore.json",
  import.meta.url,
);

function incrementBundleVersion(version) {
  const value = String(version);

  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`Cannot increment bundle version: ${version}`);
  }

  return String(Number(value) + 1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const [command, value] = process.argv.slice(2);

if (command === "--print-next") {
  if (!value) {
    throw new Error("--print-next requires a version value");
  }
  console.log(incrementBundleVersion(value));
  process.exit(0);
}

if (command) {
  throw new Error(`Unknown argument: ${command}`);
}

const appStoreConfig = readJson(appStoreConfigPath);
const currentBundleVersion = appStoreConfig.bundle?.macOS?.bundleVersion ?? "0";

appStoreConfig.bundle ??= {};
appStoreConfig.bundle.macOS ??= {};
appStoreConfig.bundle.macOS.bundleVersion =
  incrementBundleVersion(currentBundleVersion);

writeJson(appStoreConfigPath, appStoreConfig);

console.log(
  `App Store bundleVersion: ${currentBundleVersion} -> ${appStoreConfig.bundle.macOS.bundleVersion}`,
);
