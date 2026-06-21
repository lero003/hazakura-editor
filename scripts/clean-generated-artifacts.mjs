#!/usr/bin/env node
import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const targetOnly = args.has("--target-only");

const allTargets = [
  {
    path: "src-tauri/target",
    label: "Rust / Tauri build cache and bundled app output",
  },
  {
    path: "src-helpers/apple-assist/.build",
    label: "SwiftPM Apple Assist helper build cache",
  },
  {
    path: "dist",
    label: "Vite web build output",
  },
  {
    path: "src-tauri/gen",
    label: "Generated Tauri files",
  },
  {
    path: "binaries",
    label: "Generated external helper binaries",
  },
];

const targets = targetOnly
  ? allTargets.filter((target) => target.path === "src-tauri/target")
  : allTargets;

let totalBytes = 0;
let existingCount = 0;

console.log(
  `Generated artifact cleanup (${apply ? "apply" : "dry-run"}${targetOnly ? ", target-only" : ""})`,
);

for (const target of targets) {
  const absolutePath = path.resolve(repoRoot, target.path);
  assertInsideRepo(absolutePath);
  const bytes = await directorySize(absolutePath);
  if (bytes === null) {
    console.log(`- missing ${target.path}`);
    continue;
  }

  existingCount += 1;
  totalBytes += bytes;
  console.log(`- ${formatBytes(bytes)} ${target.path} — ${target.label}`);

  if (apply) {
    await rm(absolutePath, { recursive: true, force: true });
    console.log(`  removed ${target.path}`);
  }
}

if (existingCount === 0) {
  console.log("No generated artifact directories found.");
} else if (!apply) {
  console.log(
    `Dry run only. Re-run with --apply to remove ${formatBytes(totalBytes)} of generated artifacts.`,
  );
}

function assertInsideRepo(absolutePath) {
  const relativePath = path.relative(repoRoot, absolutePath);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing to clean path outside repo: ${absolutePath}`);
  }
}

async function directorySize(absolutePath) {
  let stat;
  try {
    stat = await lstat(absolutePath);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
  if (!stat.isDirectory()) return stat.size;

  let total = 0;
  const entries = await readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(absolutePath, entry.name);
    if (entry.isSymbolicLink()) {
      const linkStat = await lstat(entryPath);
      total += linkStat.size;
    } else if (entry.isDirectory()) {
      total += (await directorySize(entryPath)) ?? 0;
    } else {
      const fileStat = await lstat(entryPath);
      total += fileStat.size;
    }
  }
  return total;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
