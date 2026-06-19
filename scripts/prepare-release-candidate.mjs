#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJsonPath = join(root, "package.json");
const appStoreConfigPath = join(root, "src-tauri", "tauri.conf.appstore.json");
const appStorePkgDir = join(
  root,
  "src-tauri",
  "target",
  "universal-apple-darwin",
  "release",
  "bundle",
  "pkg",
);
const internalCandidateDir = join(
  root,
  "docs",
  "internal",
  "app-store-candidates",
);

const allowedArgs = new Set([
  "--with-app-store-pkg",
  "--skip-smoke",
  "--dry-run",
  "--no-internal-note",
  "--no-prune-pkgs",
]);

function usage() {
  console.error(`Usage:
  npm run release:candidate -- --with-app-store-pkg [--skip-smoke] [--keep-pkgs=N]
  npm run release:candidate -- --with-app-store-pkg --dry-run

Options:
  --with-app-store-pkg  Build a signed App Store/TestFlight .pkg candidate.
  --skip-smoke          Skip npm run smoke:app-store-surface.
  --keep-pkgs=N         Keep the newest N generated HazakuraEditor-*-mas.pkg files.
                        Default: 5.
  --no-prune-pkgs       Do not remove older generated .pkg files.
  --no-internal-note    Do not write ignored docs/internal candidate metadata.
  --dry-run             Print the plan without running smoke, build, prune, or writes.`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    keepPkgs: Number(process.env.HAZAKURA_APP_STORE_PKG_KEEP ?? "5"),
    prunePkgs: true,
    skipSmoke: false,
    withAppStorePkg: false,
    writeInternalNote: true,
  };

  for (const arg of argv) {
    if (arg.startsWith("--keep-pkgs=")) {
      options.keepPkgs = Number(arg.slice("--keep-pkgs=".length));
      continue;
    }
    if (!allowedArgs.has(arg)) {
      usage();
      throw new Error(`Unknown option: ${arg}`);
    }
    if (arg === "--with-app-store-pkg") options.withAppStorePkg = true;
    if (arg === "--skip-smoke") options.skipSmoke = true;
    if (arg === "--dry-run") options.dryRun = true;
    if (arg === "--no-internal-note") options.writeInternalNote = false;
    if (arg === "--no-prune-pkgs") options.prunePkgs = false;
  }

  if (!options.withAppStorePkg) {
    usage();
    throw new Error(
      "--with-app-store-pkg is required for the current candidate flow",
    );
  }

  if (
    options.prunePkgs &&
    (!Number.isInteger(options.keepPkgs) || options.keepPkgs < 1)
  ) {
    throw new Error("--keep-pkgs must be a positive integer");
  }

  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

function packagePathFor(version, build) {
  return join(
    appStorePkgDir,
    `HazakuraEditor-${version}-build${build}-mas.pkg`,
  );
}

function printPlan(options) {
  console.log("Release candidate plan:");
  console.log("- App Store package: npm run build:app-store-pkg");
  console.log(
    `- App Store surface smoke: ${
      options.skipSmoke
        ? "skipped by --skip-smoke"
        : "npm run smoke:app-store-surface"
    }`,
  );
  console.log(
    `- Internal candidate note: ${
      options.writeInternalNote
        ? "docs/internal/app-store-candidates/latest.json"
        : "disabled by --no-internal-note"
    }`,
  );
  console.log(
    `- Package retention: ${
      options.prunePkgs
        ? `keep highest build numbers: ${options.keepPkgs}`
        : "disabled"
    }`,
  );
  console.log("- Tracked release docs: not updated by this command");
}

function writeInternalCandidateNote({ build, pkgPath, sha256, smoke, version }) {
  mkdirSync(internalCandidateDir, { recursive: true });

  const relativePkgPath = relative(root, pkgPath);
  const candidate = {
    generatedAt: new Date().toISOString(),
    version,
    build,
    pkgPath: relativePkgPath,
    sha256,
    sourceCommit: capture("git", ["rev-parse", "--short", "HEAD"]),
    smoke,
    trackedReleaseDocsUpdated: false,
    note:
      "Local App Store/TestFlight candidate metadata. This directory is ignored; update tracked release docs only when this package is uploaded or selected for submission.",
  };
  const fileName = `HazakuraEditor-${version}-build${build}.json`;
  const payload = `${JSON.stringify(candidate, null, 2)}\n`;

  writeFileSync(join(internalCandidateDir, fileName), payload);
  writeFileSync(join(internalCandidateDir, "latest.json"), payload);

  console.log(
    `INTERNAL_CANDIDATE_NOTE=${join(
      "docs",
      "internal",
      "app-store-candidates",
      fileName,
    )}`,
  );
}

function pruneGeneratedPackages(currentPkgPath, keepPkgs) {
  if (!existsSync(appStorePkgDir)) {
    return;
  }

  const packageNamePattern =
    /^HazakuraEditor-.+-build([1-9]\d*)-mas\.pkg$/;
  const candidates = readdirSync(appStorePkgDir)
    .map((name) => {
      const match = name.match(packageNamePattern);
      return match
        ? {
            build: Number(match[1]),
            name,
            path: join(appStorePkgDir, name),
          }
        : null;
    })
    .filter((candidate) => candidate !== null)
    .map((candidate) => {
      return {
        ...candidate,
        mtimeMs: statSync(candidate.path).mtimeMs,
      };
    })
    .sort(
      (left, right) =>
        right.build - left.build || right.mtimeMs - left.mtimeMs,
    );

  const current = resolve(currentPkgPath);
  const keep = new Set([current]);
  for (const candidate of candidates) {
    if (keep.size >= keepPkgs) break;
    keep.add(resolve(candidate.path));
  }

  const removed = [];
  for (const candidate of candidates) {
    if (keep.has(resolve(candidate.path))) continue;
    rmSync(candidate.path, { force: true });
    removed.push(candidate.name);
  }

  if (removed.length > 0) {
    console.log(
      `Pruned old App Store package candidates: ${removed.join(", ")}`,
    );
  } else {
    console.log("No old App Store package candidates pruned.");
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  printPlan(options);

  if (options.dryRun) {
    return;
  }

  if (!options.skipSmoke) {
    run("npm", ["run", "smoke:app-store-surface"]);
  }

  run("npm", ["run", "build:app-store-pkg"]);

  const packageJson = readJson(packageJsonPath);
  const appStoreConfig = readJson(appStoreConfigPath);
  const version = packageJson.version;
  const build = appStoreConfig.bundle?.macOS?.bundleVersion;

  if (!/^[1-9]\d*$/.test(String(build))) {
    throw new Error(
      `Invalid App Store bundleVersion after package build: ${build}`,
    );
  }

  const pkgPath = packagePathFor(version, build);
  if (!existsSync(pkgPath)) {
    throw new Error(`Expected package was not found: ${pkgPath}`);
  }

  const shaLine = capture("shasum", ["-a", "256", pkgPath]);
  const sha256 = shaLine.split(/\s+/)[0] ?? "";
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error(`Could not parse SHA-256 from: ${shaLine}`);
  }

  if (options.writeInternalNote) {
    writeInternalCandidateNote({
      build,
      pkgPath,
      sha256,
      smoke: options.skipSmoke ? "skipped" : "passed",
      version,
    });
  }

  if (options.prunePkgs) {
    pruneGeneratedPackages(pkgPath, options.keepPkgs);
  }

  console.log(`PKG_PATH=${relative(root, pkgPath)}`);
  console.log(`PKG_SHA256=${sha256}`);
  console.log(`APP_STORE_VERSION_BUILD=${version}/${build}`);
  console.log("Tracked release docs were not updated.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
