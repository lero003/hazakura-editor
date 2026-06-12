#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url);
const packageJsonPath = new URL("../package.json", import.meta.url);
const appStoreConfigPath = new URL(
  "../src-tauri/tauri.conf.appstore.json",
  import.meta.url,
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function incrementBundleVersion(version) {
  const value = String(version);

  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`Cannot increment bundle version: ${version}`);
  }

  return String(Number(value) + 1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }

  return result.stdout.trim();
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const appSigningIdentity = requireEnv("APPLE_SIGNING_IDENTITY");
const installerSigningIdentity = requireEnv("APPLE_INSTALLER_SIGNING_IDENTITY");
const packageJson = readJson(packageJsonPath);
const appStoreConfig = readJson(appStoreConfigPath);
const version = packageJson.version;
const previousBuild = appStoreConfig.bundle?.macOS?.bundleVersion ?? "0";
const build = incrementBundleVersion(previousBuild);

if (!/^\d+$/.test(build) || build === "0") {
  throw new Error(`Invalid App Store bundleVersion: ${build}`);
}

appStoreConfig.bundle ??= {};
appStoreConfig.bundle.macOS ??= {};
appStoreConfig.bundle.macOS.bundleVersion = build;
writeJson(appStoreConfigPath, appStoreConfig);

const appPath = join(
  "src-tauri",
  "target",
  "universal-apple-darwin",
  "release",
  "bundle",
  "macos",
  "Hazakura Editor.app",
);
const pkgPath = join(
  "src-tauri",
  "target",
  "universal-apple-darwin",
  "release",
  "bundle",
  "pkg",
  `HazakuraEditor-${version}-build${build}-mas.pkg`,
);
const tmpPkgPath = `${pkgPath}.tmp.${process.pid}`;

console.log(`App Store package target: ${pkgPath}`);
console.log(`App Store bundleVersion: ${previousBuild} -> ${build}`);
console.log(`App Store version/build: ${version} / ${build}`);

run("npm", ["run", "build:app-store-submit"], {
  env: { APPLE_SIGNING_IDENTITY: appSigningIdentity },
});

run("npm", ["run", "probe:macos-distribution", "--", appPath], {
  env: { REQUIRE_APP_STORE_ENTITLEMENTS: "1" },
});

mkdirSync(dirname(pkgPath), { recursive: true });
rmSync(tmpPkgPath, { force: true });
run("productbuild", [
  "--component",
  appPath,
  "/Applications",
  "--sign",
  installerSigningIdentity,
  tmpPkgPath,
]);
renameSync(tmpPkgPath, pkgPath);

if (!existsSync(pkgPath)) {
  throw new Error(`Package was not created: ${pkgPath}`);
}

run("pkgutil", ["--check-signature", pkgPath]);

const sha256 = capture("shasum", ["-a", "256", pkgPath]);
console.log(sha256);
console.log(`PKG_PATH=${pkgPath}`);
