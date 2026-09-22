#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

export const E4B_V2 = Object.freeze({
  catalogVersion: "2026.09.22.1",
  sourceModel: "google/gemma-4-E4B-it-qat-q4_0-unquantized",
  sourceRevision: "476025a01dbf99361c062bbeca3d6a76bb4c4566",
  sourceWeight: Object.freeze({
    size: 15_882_477_468,
    sha256: "ad8ef515194b15ab13b6f98d54d37652b691c9a2c787cdf7ed5f951f5ed2c7fa",
  }),
  modelZooRevision: "347393ede35fd25e9e59203dba562e5ee4d268bb",
  coreAiModelsRevision: "b1cb71b8522d99408059fa0b98b8742171bcb0b8",
  toolVersions: Object.freeze({
    "coreai-core": "1.0.0b2",
    "coreai-torch": "0.4.1",
    "coreai-opt": "0.2.1",
    torch: "2.9.0",
  }),
  exportName: "gemma4_e4b_qat_decode_int4linsym",
  tableFiles: Object.freeze({
    "meta.json": Object.freeze({
      size: 390,
      sha256: "c35f5a2974d24ec75ffcf17fa35a458c88d72712f65e0a0457e6ff706537deb5",
    }),
    "embed_per_layer.i8": Object.freeze({
      size: 2_818_572_288,
      sha256: "891f77177b4ab317e5562b6684c5f7825cd5795a9c4b26f97af121ebf4bb7ccb",
    }),
    "embed_per_layer.scale.f32": Object.freeze({
      size: 1_048_576,
      sha256: "512d9d0a2b089ae37594ce80e848a08e1b5a6b3f40014a32333e6d191a9b6131",
    }),
  }),
});

export function buildE4BV2ReexportPlan(root = repositoryRoot) {
  const productionRoot = join(root, ".hazakura", "coreai-production");
  const toolingRoot = join(productionRoot, "tooling");
  const modelZooRoot = join(toolingRoot, "coreai-model-zoo");
  const coreAiModelsRoot = join(toolingRoot, "coreai-models");
  const python = join(coreAiModelsRoot, ".venv", "bin", "python");
  const hfCache = join(productionRoot, "hf-cache");
  const snapshotRoot = join(
    hfCache,
    "models--google--gemma-4-E4B-it-qat-q4_0-unquantized",
    "snapshots",
    E4B_V2.sourceRevision,
  );
  const experimentRoot = join(
    productionRoot,
    "gemma4-e4b-v2",
    E4B_V2.catalogVersion,
    "experiment",
  );
  const tableRoot = join(experimentRoot, "tables");
  const reexportRoot = join(
    productionRoot,
    "reexports",
    "gemma4-e4b-v2",
    E4B_V2.catalogVersion,
  );
  const exportRoot = join(reexportRoot, "work", "exports");
  const exportedBundle = join(exportRoot, E4B_V2.exportName);
  const payloadRoot = join(reexportRoot, "payload-input");
  const exporter = join(modelZooRoot, "conversion", "export_gemma4_decode_pipelined.py");
  const tableGenerator = join(scriptDirectory, "generate-core-ai-e4b-v2-tables.py");
  const patchPath = join(scriptDirectory, "patches", "core-ai-e4b-pinned-revision.patch");
  const arguments_ = [
    exporter,
    "int4lin",
    "--hf-id", E4B_V2.sourceModel,
    "--revision", E4B_V2.sourceRevision,
    "--local-files-only",
    "--lin-sym",
    "--max-ctx", "4096",
    "--out-dir", exportRoot,
  ];
  return {
    productionRoot,
    modelZooRoot,
    coreAiModelsRoot,
    python,
    hfCache,
    snapshotRoot,
    tableRoot,
    reexportRoot,
    exportRoot,
    exportedBundle,
    payloadRoot,
    exporter,
    tableGenerator,
    patchPath,
    recordPath: join(reexportRoot, "reexport.json"),
    command: [python, ...arguments_],
    arguments: arguments_,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status}):\n` +
      `${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return (result.stdout ?? "").trim();
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyPinnedFile(path, expected, label, { allowSymlink = false } = {}) {
  const linkDetails = await lstat(path).catch(() => null);
  if (!linkDetails || (!allowSymlink && linkDetails.isSymbolicLink())) {
    throw new Error(`${label} is missing or is not a regular file: ${path}`);
  }
  const details = allowSymlink ? await stat(path).catch(() => null) : linkDetails;
  if (!details?.isFile()) throw new Error(`${label} is not a regular file: ${path}`);
  if (details.size !== expected.size) {
    throw new Error(`${label} size mismatch: expected ${expected.size}, got ${details.size}`);
  }
  const digest = await sha256(path);
  if (digest !== expected.sha256) {
    throw new Error(`${label} SHA-256 mismatch: expected ${expected.sha256}, got ${digest}`);
  }
  return { size: details.size, sha256: digest };
}

function verifyGitRevision(path, expected, label) {
  const revision = run("git", ["rev-parse", "HEAD"], { cwd: path });
  if (revision !== expected) {
    throw new Error(`${label} revision mismatch: expected ${expected}, got ${revision}`);
  }
}

function verifyConversionToolchain(python) {
  const packages = Object.keys(E4B_V2.toolVersions);
  const script =
    "import json; from importlib.metadata import version; " +
    `print(json.dumps({name: version(name) for name in ${JSON.stringify(packages)}}))`;
  const actual = JSON.parse(run(python, ["-c", script]));
  if (JSON.stringify(actual) !== JSON.stringify(E4B_V2.toolVersions)) {
    const pins = Object.entries(E4B_V2.toolVersions)
      .map(([name, version]) => `'${name}==${version}'`)
      .join(" ");
    throw new Error(
      `Core AI conversion toolchain mismatch: expected ` +
      `${JSON.stringify(E4B_V2.toolVersions)}, got ${JSON.stringify(actual)}. ` +
      `Run: uv pip install --python ${python} ${pins}`,
    );
  }
  return actual;
}

function ensureExporterPatch(plan) {
  const reverse = spawnSync("git", ["apply", "--reverse", "--check", plan.patchPath], {
    cwd: plan.modelZooRoot,
    stdio: "ignore",
  });
  if (reverse.status === 0) return;
  run("git", ["apply", "--check", plan.patchPath], { cwd: plan.modelZooRoot });
  run("git", ["apply", plan.patchPath], { cwd: plan.modelZooRoot });
}

async function copyRegularTree(source, destination) {
  const sourceDetails = await lstat(source);
  if (sourceDetails.isSymbolicLink()) {
    throw new Error(`Refusing to copy a symlink into the re-export payload: ${source}`);
  }
  if (sourceDetails.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      await copyRegularTree(join(source, entry.name), join(destination, entry.name));
    }
    return;
  }
  if (!sourceDetails.isFile()) {
    throw new Error(`Refusing to copy a non-regular re-export artifact: ${source}`);
  }
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination, constants.COPYFILE_FICLONE);
}

async function inventoryRegularFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  const inventory = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Re-export payload contains a symlink: ${path}`);
    }
    if (entry.isDirectory()) {
      inventory.push(...await inventoryRegularFiles(root, path));
    } else if (entry.isFile()) {
      const details = await lstat(path);
      inventory.push({
        path: relative(root, path),
        size: details.size,
        sha256: await sha256(path),
      });
    } else {
      throw new Error(`Re-export payload contains a non-regular entry: ${path}`);
    }
  }
  return inventory;
}

function printPlan(plan) {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    sourceModel: E4B_V2.sourceModel,
    sourceRevision: E4B_V2.sourceRevision,
    sourceWeightSha256: E4B_V2.sourceWeight.sha256,
    modelZooRevision: E4B_V2.modelZooRevision,
    coreAiModelsRevision: E4B_V2.coreAiModelsRevision,
    toolVersions: E4B_V2.toolVersions,
    quantization: "int4lin symmetric absmax per-block-32 with per-token PLE provider",
    command: plan.command,
    output: plan.payloadRoot,
  }, null, 2)}\n`);
}

export async function executeE4BV2Reexport(plan, { replace = false } = {}) {
  verifyGitRevision(plan.modelZooRoot, E4B_V2.modelZooRevision, "coreai-model-zoo");
  verifyGitRevision(plan.coreAiModelsRoot, E4B_V2.coreAiModelsRevision, "coreai-models");
  const toolVersions = verifyConversionToolchain(plan.python);
  ensureExporterPatch(plan);

  run(plan.python, [join(plan.modelZooRoot, "conversion", "zoo_convert.py"), "doctor"], {
    cwd: plan.modelZooRoot,
    inherit: true,
  });

  const sourceWeightPath = join(plan.snapshotRoot, "model.safetensors");
  const sourceWeight = await verifyPinnedFile(
    sourceWeightPath,
    E4B_V2.sourceWeight,
    "source checkpoint",
    { allowSymlink: true },
  );
  const tablePresence = await Promise.all(Object.keys(E4B_V2.tableFiles).map(
    (name) => lstat(join(plan.tableRoot, name)).catch(() => null),
  ));
  if (tablePresence.every((entry) => entry === null)) {
    run(plan.python, [
      plan.tableGenerator,
      sourceWeightPath,
      plan.tableRoot,
      "--source-model", E4B_V2.sourceModel,
      "--source-revision", E4B_V2.sourceRevision,
    ], { inherit: true });
  }
  const tables = {};
  for (const [name, expected] of Object.entries(E4B_V2.tableFiles)) {
    tables[name] = await verifyPinnedFile(join(plan.tableRoot, name), expected, `PLE ${name}`);
  }

  const existing = await lstat(plan.reexportRoot).catch(() => null);
  if (existing && !replace) {
    throw new Error(`Re-export root already exists; pass --replace to rebuild: ${plan.reexportRoot}`);
  }
  if (existing) await rm(plan.reexportRoot, { recursive: true, force: true });
  await mkdir(plan.exportRoot, { recursive: true });

  run(plan.python, plan.arguments, {
    cwd: join(plan.modelZooRoot, "conversion"),
    env: {
      ...process.env,
      HF_HUB_CACHE: plan.hfCache,
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
    },
    inherit: true,
  });

  await copyRegularTree(plan.exportedBundle, join(plan.payloadRoot, "decoder"));
  for (const name of Object.keys(E4B_V2.tableFiles)) {
    await copyRegularTree(join(plan.tableRoot, name), join(plan.payloadRoot, "tables", name));
  }
  const files = await inventoryRegularFiles(plan.payloadRoot);
  const record = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    source: {
      model: E4B_V2.sourceModel,
      revision: E4B_V2.sourceRevision,
      modelWeight: sourceWeight,
    },
    tooling: {
      modelZooRevision: E4B_V2.modelZooRevision,
      coreAiModelsRevision: E4B_V2.coreAiModelsRevision,
      versions: toolVersions,
      exporterPatchSha256: await sha256(plan.patchPath),
    },
    conversion: {
      mode: "int4lin",
      qscheme: "symmetric",
      blockSize: 32,
      pleMode: "per-token-provider",
      maxContextTokens: 4096,
      command: plan.command,
    },
    tables,
    payloadRoot: relative(repositoryRoot, plan.payloadRoot),
    files,
  };
  await writeFile(plan.recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  process.stdout.write(`Re-export ready: ${plan.payloadRoot}\nRecord: ${plan.recordPath}\n`);
  return record;
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "Usage: npm run coreai:e4b-v2:reexport -- [--execute] [--replace]\n" +
      "Without --execute, prints the pinned offline conversion plan.\n",
    );
    return;
  }
  const execute = process.argv.includes("--execute");
  const replace = process.argv.includes("--replace");
  for (const argument of process.argv.slice(2)) {
    if (!["--execute", "--replace", "--help"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  const plan = buildE4BV2ReexportPlan();
  printPlan(plan);
  if (execute) await executeE4BV2Reexport(plan, { replace });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
