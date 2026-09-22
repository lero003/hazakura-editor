#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const defaultLockPath = join(scriptDirectory, "core-ai-production-models.json");
const defaultOutputRoot = join(repositoryRoot, ".hazakura", "coreai-production");
const apacheLicensePath = join(scriptDirectory, "assets", "apache-2.0.txt");

// License-review statuses a lock entry may declare. `reviewed-apache-2.0` is
// allowed only while the conversion repository's own (conflicting) LICENSE file
// is still shipped verbatim, so the provenance stays visible in the payload.
const reviewedLicenseStatus = "reviewed-apache-2.0";
const reviewedLicenseStatuses = new Set(["manual-review-required", reviewedLicenseStatus]);

function parseArguments(argv) {
  const parsed = {
    command: "plan",
    outputRoot: defaultOutputRoot,
    lockPath: defaultLockPath,
    modelKeys: [],
  };
  for (const argument of argv) {
    if (!argument.startsWith("--") && parsed.command === "plan") {
      parsed.command = argument;
    } else if (argument.startsWith("--output=")) {
      parsed.outputRoot = resolve(argument.slice("--output=".length));
    } else if (argument.startsWith("--lock=")) {
      parsed.lockPath = resolve(argument.slice("--lock=".length));
    } else if (argument.startsWith("--model=")) {
      parsed.modelKeys.push(argument.slice("--model=".length));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!["plan", "download", "verify", "package", "all"].includes(parsed.command)) {
    throw new Error(`Unknown command: ${parsed.command}`);
  }
  return parsed;
}

function assertSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty relative path.`);
  }
  if (value.startsWith("/") || value.startsWith("\\")) {
    throw new Error(`${label} must not be absolute: ${value}`);
  }
  const parts = value.split(/[\\/]/);
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${label} contains an unsafe component: ${value}`);
  }
}

function assertHex(value, length, label) {
  if (typeof value !== "string" || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${label} must be ${length} lowercase hexadecimal characters.`);
  }
}

export function validateLock(lock) {
  if (lock?.schemaVersion !== 1 || !Array.isArray(lock.models) || lock.models.length === 0) {
    throw new Error("Core AI model lock must use schemaVersion 1 and list at least one model.");
  }
  const keys = new Set();
  const modelIds = new Set();
  const assetPackIds = new Set();
  const storageDirectories = new Set();
  for (const [key, revision] of Object.entries(lock.tooling ?? {})) {
    assertHex(revision, 40, `tooling.${key}`);
  }
  for (const model of lock.models) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(model.key ?? "")) {
      throw new Error(`Invalid model key: ${model.key}`);
    }
    if (keys.has(model.key)) throw new Error(`Duplicate model key: ${model.key}`);
    keys.add(model.key);
    if (!/^apple:core-ai:[A-Za-z0-9:._-]+$/.test(model.modelId ?? "")) {
      throw new Error(`Invalid model id: ${model.modelId}`);
    }
    if (modelIds.has(model.modelId)) throw new Error(`Duplicate model id: ${model.modelId}`);
    modelIds.add(model.modelId);
    // App Store Connect rejects a period inside the asset pack identifier:
    // `GET /v1/apps/{id}/backgroundAssets?filter[assetPackIdentifier]=a.b`
    // answers 400 PARAMETER_ERROR, so the filter lookup can never find the
    // pack. Hyphens, digits, uppercase, and long names are accepted.
    if (!/^[A-Za-z0-9-]+$/.test(model.assetPackId ?? "")) {
      throw new Error(
        `Invalid asset pack id: ${model.assetPackId} (use letters, digits, and hyphens only)`,
      );
    }
    if (assetPackIds.has(model.assetPackId)) {
      throw new Error(`Duplicate asset pack id: ${model.assetPackId}`);
    }
    assetPackIds.add(model.assetPackId);
    assertSafeRelativePath(model.storageDirectory, `${model.key}.storageDirectory`);
    if (storageDirectories.has(model.storageDirectory)) {
      throw new Error(`Duplicate storage directory: ${model.storageDirectory}`);
    }
    storageDirectories.add(model.storageDirectory);
    if (!/^[A-Za-z0-9._-]+$/.test(model.catalogVersion ?? "")) {
      throw new Error(`Invalid catalog version: ${model.catalogVersion}`);
    }
    if (!/^[^/]+\/[^/]+$/.test(model.convertedRepository ?? "")) {
      throw new Error(`Invalid converted repository: ${model.convertedRepository}`);
    }
    assertHex(model.sourceModelRevision, 40, `${model.key}.sourceModelRevision`);
    assertHex(model.convertedRevision, 40, `${model.key}.convertedRevision`);
    if (!Array.isArray(model.files) || model.files.length === 0) {
      throw new Error(`${model.key} must contain files.`);
    }
    if (!Array.isArray(model.conversion?.commands) || model.conversion.commands.length === 0) {
      throw new Error(`${model.key} must record its conversion commands.`);
    }
    const artifactSource = model.artifactSource ?? { kind: "hugging-face" };
    if (artifactSource.kind === "hugging-face") {
      if (model.conversion.hazakuraReexported !== false) {
        throw new Error(
          `${model.key} may claim hazakuraReexported only with a local-reexport artifact source.`,
        );
      }
    } else if (artifactSource.kind === "local-reexport") {
      assertSafeRelativePath(artifactSource.root, `${model.key}.artifactSource.root`);
      if (!artifactSource.root.startsWith("reexports/")) {
        throw new Error(`${model.key}.artifactSource.root must stay under reexports/.`);
      }
      if (model.conversion.hazakuraReexported !== true) {
        throw new Error(
          `${model.key} local-reexport artifacts must set conversion.hazakuraReexported=true.`,
        );
      }
    } else {
      throw new Error(`${model.key} has an unknown artifact source kind.`);
    }
    if (model.runtimeRequirements?.environment?.COREAI_CHUNK_THRESHOLD !== "1") {
      throw new Error(`${model.key} must pin the pipelined runtime threshold.`);
    }
    if (!reviewedLicenseStatuses.has(model.licensing?.reviewStatus) ||
        !Array.isArray(model.licensing.licenseFiles) ||
        !model.licensing.licenseFiles.includes("LICENSE-APACHE-2.0.txt")) {
      throw new Error(`${model.key} must keep a known license-review status and the Apache text.`);
    }
    // A reviewed status is only allowed while the conflicting upstream file is
    // still shipped verbatim, so the provenance of the discrepancy stays visible.
    if (model.licensing.reviewStatus === reviewedLicenseStatus &&
        !model.licensing.additionalLicenseAsset) {
      throw new Error(
        `${model.key} must retain the conversion repository's LICENSE file to claim ${reviewedLicenseStatus}.`,
      );
    }
    for (const file of model.licensing.licenseFiles) {
      assertSafeRelativePath(file, `${model.key}.licensing.licenseFiles`);
    }
    if (model.licensing.additionalLicenseAsset || model.licensing.additionalLicenseDestination) {
      assertSafeRelativePath(
        model.licensing.additionalLicenseAsset,
        `${model.key}.licensing.additionalLicenseAsset`,
      );
      assertSafeRelativePath(
        model.licensing.additionalLicenseDestination,
        `${model.key}.licensing.additionalLicenseDestination`,
      );
      assertHex(
        model.licensing.additionalLicenseSha256,
        64,
        `${model.key}.licensing.additionalLicenseSha256`,
      );
      if (!model.licensing.licenseFiles.includes(model.licensing.additionalLicenseDestination)) {
        throw new Error(`${model.key} must require its additional license destination.`);
      }
    }
    const destinations = new Set();
    for (const file of model.files) {
      assertSafeRelativePath(file.source, `${model.key}.source`);
      assertSafeRelativePath(file.destination, `${model.key}.destination`);
      if (!Number.isSafeInteger(file.size) || file.size < 0) {
        throw new Error(`${model.key}:${file.destination} has an invalid size.`);
      }
      assertHex(file.sha256, 64, `${model.key}:${file.destination}.sha256`);
      if (destinations.has(file.destination)) {
        throw new Error(`${model.key} has duplicate destination ${file.destination}.`);
      }
      destinations.add(file.destination);
    }
  }
  return lock;
}

export function selectedModels(lock, modelKeys) {
  if (modelKeys.length === 0) return lock.models;
  const requested = new Set(modelKeys);
  const selected = lock.models.filter((model) => requested.has(model.key));
  const missing = [...requested].filter((key) => !selected.some((model) => model.key === key));
  if (missing.length > 0) throw new Error(`Unknown model key(s): ${missing.join(", ")}`);
  return selected;
}

export function sourceDownloadUrl(model, file) {
  if (model.artifactSource?.kind === "local-reexport") {
    throw new Error(`${model.key} uses a local re-export and has no download URL.`);
  }
  const repo = model.convertedRepository.split("/").map(encodeURIComponent).join("/");
  const source = file.source.split("/").map(encodeURIComponent).join("/");
  return `https://huggingface.co/${repo}/resolve/${model.convertedRevision}/${source}?download=true`;
}

export function localArtifactPath(outputRoot, model, file) {
  if (model.artifactSource?.kind !== "local-reexport") {
    throw new Error(`${model.key} does not use a local re-export.`);
  }
  const root = resolve(outputRoot, model.artifactSource.root);
  const path = resolve(root, file.source);
  if (path === root || !path.startsWith(`${root}${sep}`)) {
    throw new Error(`${model.key} local artifact escapes its source root.`);
  }
  return path;
}

export async function assertNoSymlinkComponents(boundary, target) {
  const resolvedBoundary = resolve(boundary);
  const resolvedTarget = resolve(target);
  if (resolvedTarget !== resolvedBoundary &&
      !resolvedTarget.startsWith(`${resolvedBoundary}${sep}`)) {
    throw new Error(`Local artifact path escapes its boundary: ${resolvedTarget}`);
  }
  const components = resolvedTarget === resolvedBoundary
    ? []
    : resolvedTarget.slice(resolvedBoundary.length + 1).split(sep);
  let current = resolvedBoundary;
  for (const component of [null, ...components]) {
    if (component !== null) current = join(current, component);
    const details = await lstat(current).catch(() => null);
    if (!details) throw new Error(`Missing local artifact component: ${current}`);
    if (details.isSymbolicLink()) {
      throw new Error(`Local re-export artifacts may not contain symlinks: ${current}`);
    }
  }
}

export function modelPayloadRoot(outputRoot, model) {
  return join(outputRoot, model.key, model.catalogVersion, "stage", "CoreAIModels", model.storageDirectory);
}

export function buildModelMetadata(model) {
  return {
    schemaVersion: 1,
    modelId: model.modelId,
    catalogVersion: model.catalogVersion,
    displayName: model.displayName,
    runtimeKind: model.runtimeKind,
    sourceModel: model.sourceModel,
    sourceModelRevision: model.sourceModelRevision,
    convertedRepository: model.convertedRepository,
    convertedRevision: model.convertedRevision,
    quantization: model.quantization,
    licensing: model.licensing,
    conversion: model.conversion,
    runtimeRequirements: model.runtimeRequirements,
    contextTokens: model.contextTokens,
    minimumMacOS: model.minimumMacOS,
    acceptanceMemoryGB: model.acceptanceMemoryGB,
    releaseEligible: model.releaseEligible,
    releaseBlockers: model.releaseBlockers,
    layout: model.layout,
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyFile(path, expected) {
  const details = await stat(path).catch(() => null);
  if (!details?.isFile()) throw new Error(`Missing file: ${path}`);
  if (details.size !== expected.size) {
    throw new Error(`Size mismatch for ${path}: expected ${expected.size}, got ${details.size}`);
  }
  const digest = await sha256(path);
  if (digest !== expected.sha256) {
    throw new Error(`SHA-256 mismatch for ${path}: expected ${expected.sha256}, got ${digest}`);
  }
  return { size: details.size, sha256: digest };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

export function formatPackagingBlocker(model, toolchain, details) {
  return `# Background Assets packaging blocked\n\n` +
    `- Model ID: \`${model.modelId}\`\n` +
    `- Asset pack ID: \`${model.assetPackId}\`\n` +
    `- Toolchain: \`${toolchain.replaceAll("\n", " / ")}\`\n\n` +
    `The staged model and manifests remain available and verified. No .aar was created.\n\n` +
    `\`\`\`text\n${details.trim()}\n\`\`\`\n\n` +
    `Run \`npm run coreai:ba-package:reproduce\` to compare the sandboxed and unsandboxed ` +
    `contexts, then re-run \`npm run coreai:models:package -- --model=${model.key}\` from ` +
    `Terminal.app so \`ba-package\` runs outside the restricted sandbox.\n`;
}

function runBaPackage(args, options) {
  try {
    const output = run("xcrun", ["ba-package", ...args], options);
    if (output) process.stdout.write(output);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (/path extension isn.t [“\"]?json/i.test(details)) {
      throw new Error(
        `ba-package rejected a path that plainly ends in .json. This reproduces only ` +
        `inside a restricted execution sandbox (for example the Codex seatbelt sandbox ` +
        `that sets CODEX_SANDBOX), never from a normal shell. Re-run the packaging step ` +
        `from Terminal.app, or run npm run coreai:ba-package:reproduce to compare the ` +
        `sandboxed and unsandboxed contexts.\n${details}`,
      );
    }
    throw error;
  }
}

function commandAvailable(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

export function buildDownloadCommand(hasAria2, url, partialPath) {
  if (hasAria2) {
    return {
      command: "aria2c",
      args: [
        "--continue=true",
        "--allow-overwrite=true",
        "--auto-file-renaming=false",
        "--file-allocation=none",
        "--max-connection-per-server=8",
        "--split=8",
        "--min-split-size=16M",
        "--console-log-level=warn",
        "--show-console-readout=false",
        "--summary-interval=0",
        "--download-result=hide",
        "--dir", dirname(partialPath),
        "--out", basename(partialPath),
        url,
      ],
    };
  }
  return {
    command: "curl",
    args: [
      "--location",
      "--fail",
      "--silent",
      "--show-error",
      "--retry", "5",
      "--retry-delay", "2",
      "--continue-at", "-",
      "--output", partialPath,
      url,
    ],
  };
}

async function downloadFile(model, file, outputRoot) {
  if (model.artifactSource?.kind === "local-reexport") {
    const path = localArtifactPath(outputRoot, model, file);
    await assertNoSymlinkComponents(outputRoot, path);
    await verifyFile(path, file);
    return path;
  }
  const cachePath = join(outputRoot, "downloads", model.key, model.convertedRevision, file.source);
  await mkdir(dirname(cachePath), { recursive: true });
  const existing = await stat(cachePath).catch(() => null);
  if (existing?.isFile() && existing.size === file.size) {
    try {
      await verifyFile(cachePath, file);
      return cachePath;
    } catch {
      await rm(cachePath, { force: true });
    }
  }
  const partialPath = `${cachePath}.partial`;
  process.stdout.write(`Downloading ${model.key}: ${file.source}\n`);
  const download = buildDownloadCommand(
    commandAvailable("aria2c"),
    sourceDownloadUrl(model, file),
    partialPath,
  );
  run(download.command, download.args, { inherit: true });
  try {
    await verifyFile(partialPath, file);
  } catch (error) {
    await rm(partialPath, { force: true });
    await rm(`${partialPath}.aria2`, { force: true });
    throw error;
  }
  await rm(`${partialPath}.aria2`, { force: true });
  await rename(partialPath, cachePath);
  return cachePath;
}

function thirdPartyNotice(model) {
  const convertedArtifact = model.artifactSource?.kind === "local-reexport"
    ? "Hazakura local re-export (file identities are pinned in the model lock)"
    : `${model.convertedRepository}@${model.convertedRevision}`;
  const conversionCode = model.artifactSource?.kind === "local-reexport"
    ? `Conversion code: ${model.convertedRepository}@${model.convertedRevision}\n`
    : "";
  return `# Third-party model notice\n\n` +
    `${model.displayName} is an Apple Core AI format conversion of ${model.sourceModel}.\n\n` +
    `Source model revision: ${model.sourceModelRevision}\n` +
    `Converted artifact: ${convertedArtifact}\n` +
    conversionCode +
    `Conversion recipe: coreai-model-zoo@347393ede35fd25e9e59203dba562e5ee4d268bb\n` +
    `Runtime integration: coreai-kit@bebe09a050c144034c169af2074fda47fb7ba326\n\n` +
    `Source-model license metadata: ${model.licensing.sourceModelLicense}\n` +
    `Source-model license URL: ${model.licensing.sourceModelLicenseUrl}\n` +
    `Converted-artifact statement: ${model.licensing.convertedArtifactStatement}\n\n` +
    (model.licensing.reviewStatus === reviewedLicenseStatus
      ? `License review: the Gemma 4 weights are Apache-2.0 (Google's Gemma 4 license). The conversion\n` +
        `repository ships its own LICENSE file that still carries the Gemma Terms of Use text; it is\n` +
        `included verbatim as ${model.licensing.additionalLicenseDestination} for provenance and is not\n` +
        `relied on as the license of the weights.\n\n`
      : "") +
    `The model files remain subject to their upstream terms. The included license files preserve\n` +
    `the statements observed at the pinned revisions; they are not a Hazakura legal conclusion.\n` +
    `Manual review remains required before external TestFlight or App Store distribution. The\n` +
    `Core AI conversion and community runtime projects are not affiliated with or endorsed by\n` +
    `Apple or Google.\n`;
}

async function generatedPayloadFiles(model, payloadRoot) {
  const metadataPath = join(payloadRoot, "hazakura-model.json");
  const licensePath = join(payloadRoot, "LICENSE-APACHE-2.0.txt");
  const noticePath = join(payloadRoot, "THIRD_PARTY_MODEL_NOTICE.md");
  await mkdir(payloadRoot, { recursive: true });
  await writeFile(metadataPath, stableJson(buildModelMetadata(model)), "utf8");
  await copyFile(apacheLicensePath, licensePath);
  if (model.licensing.additionalLicenseAsset) {
    const additionalLicenseSource = join(
      scriptDirectory,
      "assets",
      model.licensing.additionalLicenseAsset,
    );
    const additionalLicenseDigest = await sha256(additionalLicenseSource);
    if (additionalLicenseDigest !== model.licensing.additionalLicenseSha256) {
      throw new Error(`${model.key} additional license snapshot does not match its lock.`);
    }
    await copyFile(
      additionalLicenseSource,
      join(payloadRoot, model.licensing.additionalLicenseDestination),
    );
  }
  await writeFile(noticePath, thirdPartyNotice(model), "utf8");
  return [
    metadataPath,
    ...model.licensing.licenseFiles.map((file) => join(payloadRoot, file)),
    noticePath,
  ];
}

async function stageModel(model, outputRoot) {
  const payloadRoot = modelPayloadRoot(outputRoot, model);
  await rm(payloadRoot, { recursive: true, force: true });
  await mkdir(payloadRoot, { recursive: true });
  for (const file of model.files) {
    const cachePath = await downloadFile(model, file, outputRoot);
    const destination = join(payloadRoot, file.destination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(cachePath, destination);
  }
  await generatedPayloadFiles(model, payloadRoot);
  return writeManifests(model, outputRoot);
}

async function collectManifestEntries(model, outputRoot) {
  const payloadRoot = modelPayloadRoot(outputRoot, model);
  const entries = [];
  for (const file of model.files) {
    const path = join(payloadRoot, file.destination);
    const verified = await verifyFile(path, file);
    entries.push({ path: file.destination, ...verified });
  }
  for (const relativePath of [
    "hazakura-model.json",
    ...model.licensing.licenseFiles,
    "THIRD_PARTY_MODEL_NOTICE.md",
  ]) {
    const path = join(payloadRoot, relativePath);
    const details = await stat(path);
    entries.push({ path: relativePath, size: details.size, sha256: await sha256(path) });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return entries;
}

export function buildResourceManifest(model, entries) {
  const expandedBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  return {
    schemaVersion: 1,
    modelId: model.modelId,
    catalogVersion: model.catalogVersion,
    storageDirectory: model.storageDirectory,
    expandedBytes,
    maxExpandedBytes: expandedBytes + 16 * 1024 * 1024,
    maxEntries: entries.length,
    files: entries,
  };
}

export function buildBackgroundAssetsManifest(model) {
  return {
    assetPackID: model.assetPackId,
    downloadPolicy: { onDemand: {} },
    fileSelectors: [
      {
        directorySource: `CoreAIModels/${model.storageDirectory}`,
        directoryDestination: `CoreAIModels/${model.storageDirectory}`,
      },
    ],
    platforms: ["macOS"],
    sourceRoot: "../stage",
  };
}

export function buildBaPackageCommands(manifestPath, archivePath) {
  const cwd = dirname(dirname(manifestPath));
  // ba-package changes its working directory to the manifest's `sourceRoot`
  // before resolving paths, so a relative output argument would land inside
  // the payload stage instead of the version root. Hand it absolute paths and
  // keep the containment guard on both of them.
  const manifestArgument = resolve(manifestPath);
  const archiveArgument = resolve(archivePath);
  for (const [label, argument] of [
    ["manifest", manifestArgument],
    ["archive", archiveArgument],
  ]) {
    if (argument === cwd || !argument.startsWith(`${cwd}${sep}`)) {
      throw new Error(`ba-package ${label} path must stay inside ${cwd}.`);
    }
  }
  return {
    cwd,
    evaluate: ["evaluate", manifestArgument],
    package: [manifestArgument, "-o", archiveArgument, "--verbose"],
  };
}

async function writeManifests(model, outputRoot) {
  const versionRoot = join(outputRoot, model.key, model.catalogVersion);
  const manifestRoot = join(versionRoot, "manifests");
  const payloadRoot = modelPayloadRoot(outputRoot, model);
  await mkdir(manifestRoot, { recursive: true });
  const entries = await collectManifestEntries(model, outputRoot);
  const resourceManifest = buildResourceManifest(model, entries);
  const backgroundAssetsManifest = buildBackgroundAssetsManifest(model);
  await writeFile(
    join(manifestRoot, "resource-manifest.json"),
    stableJson(resourceManifest),
    "utf8",
  );
  // The app validates the Apple-hosted materialization against the same
  // signed catalog manifest. Keep this file outside its own `files` list so
  // the manifest remains deterministic and cannot recursively hash itself.
  await writeFile(
    join(payloadRoot, "hazakura-resource-manifest.json"),
    stableJson(resourceManifest),
    "utf8",
  );
  await writeFile(
    join(manifestRoot, "background-assets-manifest.json"),
    stableJson(backgroundAssetsManifest),
    "utf8",
  );
  return { resourceManifest, backgroundAssetsManifest };
}

async function verifyModel(model, outputRoot) {
  const payloadRoot = modelPayloadRoot(outputRoot, model);
  const metadata = JSON.parse(await readFile(join(payloadRoot, "hazakura-model.json"), "utf8"));
  if (metadata.modelId !== model.modelId || metadata.runtimeKind !== model.runtimeKind) {
    throw new Error(`${model.key} metadata does not match the lock.`);
  }
  const { resourceManifest } = await writeManifests(model, outputRoot);
  process.stdout.write(
    `Verified ${model.key}: ${resourceManifest.files.length} files, ` +
    `${resourceManifest.expandedBytes} bytes.\n`,
  );
  return resourceManifest;
}

async function packageModel(model, outputRoot) {
  const versionRoot = join(outputRoot, model.key, model.catalogVersion);
  const manifestPath = join(versionRoot, "manifests", "background-assets-manifest.json");
  const archiveRoot = join(versionRoot, "archives");
  const archivePath = join(archiveRoot, `${model.assetPackId}.aar`);
  const blockerPath = join(archiveRoot, "PACKAGING-BLOCKED.md");
  await mkdir(archiveRoot, { recursive: true });
  await rm(blockerPath, { force: true });
  // Rebuild and verify the expanded-file manifest before handing any payload
  // to the external packaging tool. A toolchain failure must not mask a
  // corrupt or incomplete stage.
  const resourceManifest = await verifyModel(model, outputRoot);
  const commands = buildBaPackageCommands(manifestPath, archivePath);
  try {
    runBaPackage(commands.evaluate, { cwd: commands.cwd });
    await rm(archivePath, { force: true });
    runBaPackage(commands.package, { cwd: commands.cwd });
  } catch (error) {
    const toolchain = run("xcodebuild", ["-version"]).trim();
    const details = error instanceof Error ? error.message : String(error);
    await rm(archivePath, { force: true });
    await writeFile(blockerPath, formatPackagingBlocker(model, toolchain, details), "utf8");
    throw error;
  }
  const archive = await stat(archivePath);
  const archiveSha256 = await sha256(archivePath);
  const archiveRecord = {
    schemaVersion: 1,
    modelId: model.modelId,
    assetPackId: model.assetPackId,
    file: archivePath.split(sep).at(-1),
    size: archive.size,
    sha256: archiveSha256,
    releaseEligible: model.releaseEligible,
    releaseBlockers: model.releaseBlockers,
  };
  await writeFile(join(archiveRoot, "archive.json"), stableJson(archiveRecord), "utf8");
  await writeFile(
    join(archiveRoot, "UPLOAD-INSTRUCTIONS.md"),
    `# ${model.displayName} Apple-hosted asset pack\n\n` +
      `- Model ID: \`${model.modelId}\`\n` +
      `- Asset pack ID: \`${model.assetPackId}\`\n` +
      `- Archive: \`${archiveRecord.file}\`\n` +
      `- Archive bytes: \`${archiveRecord.size}\`\n` +
      `- Archive SHA-256: \`${archiveRecord.sha256}\`\n` +
      `- Expanded bytes: \`${resourceManifest.expandedBytes}\`\n` +
      `- Release eligible: \`${model.releaseEligible}\`\n\n` +
      `Upload this .aar only to the App Store Connect asset-pack record whose identifier ` +
      `exactly matches the value above. Wait for Apple processing before linking it to a ` +
      `TestFlight build. Keep archive.json and resource-manifest.json with the candidate evidence.\n\n` +
      `This archive is a preparation artifact. It does not close the release blockers listed ` +
      `in archive.json and does not authorize production catalog activation.\n`,
    "utf8",
  );
  process.stdout.write(`Created ${archivePath}\nSHA-256 ${archiveSha256}\n`);
}

function printPlan(models, outputRoot) {
  for (const model of models) {
    const sourceBytes = model.files.reduce((sum, file) => sum + file.size, 0);
    process.stdout.write(
      `${model.key}\n` +
      `  model id: ${model.modelId}\n` +
      `  source: ${model.artifactSource?.kind === "local-reexport"
        ? model.artifactSource.root
        : `${model.convertedRepository}@${model.convertedRevision}`}\n` +
      `  locked files: ${model.files.length}\n` +
      `  locked bytes: ${sourceBytes}\n` +
      `  asset pack: ${model.assetPackId}\n` +
      `  release eligible: ${model.releaseEligible}\n`,
    );
  }
  process.stdout.write(`Output root: ${outputRoot}\n`);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const lock = validateLock(JSON.parse(await readFile(args.lockPath, "utf8")));
  const models = selectedModels(lock, args.modelKeys);
  printPlan(models, args.outputRoot);
  if (args.command === "plan") return;
  for (const model of models) {
    if (args.command === "download" || args.command === "all") {
      await stageModel(model, args.outputRoot);
    }
    if (args.command === "verify") await verifyModel(model, args.outputRoot);
    if (args.command === "package" || args.command === "all") {
      await packageModel(model, args.outputRoot);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
