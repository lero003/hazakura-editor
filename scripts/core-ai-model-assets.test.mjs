import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  buildBackgroundAssetsManifest,
  buildBaPackageCommands,
  buildDownloadCommand,
  buildModelMetadata,
  buildResourceManifest,
  formatPackagingBlocker,
  selectedModels,
  sourceDownloadUrl,
  validateLock,
} from "./prepare-core-ai-model-assets.mjs";

const lock = validateLock(JSON.parse(await readFile(
  new URL("./core-ai-production-models.json", import.meta.url),
  "utf8",
)));

test("production model lock pins both selected Gemma candidates", () => {
  assert.deepEqual(lock.models.map((model) => model.key), ["gemma4-e4b", "gemma4-12b"]);
  for (const model of lock.models) {
    assert.equal(model.convertedRevision.length, 40);
    assert.equal(model.releaseEligible, false);
    assert.equal(model.conversion.hazakuraReexported, false);
    assert.equal(model.runtimeRequirements.environment.COREAI_CHUNK_THRESHOLD, "1");
    assert.equal(model.licensing.reviewStatus, "manual-review-required");
    assert.ok(model.licensing.licenseFiles.includes("LICENSE-APACHE-2.0.txt"));
    assert.ok(model.releaseBlockers.length >= 3);
    assert.ok(model.files.every((file) => file.sha256.length === 64));
  }
});

test("12B preserves the conflicting conversion-repository license statement", () => {
  const model = lock.models.find((candidate) => candidate.key === "gemma4-12b");
  assert.equal(model.licensing.additionalLicenseAsset, "gemma-4-12b-conversion-license.txt");
  assert.equal(model.licensing.additionalLicenseSha256.length, 64);
  assert.ok(model.licensing.licenseFiles.includes("UPSTREAM-CONVERSION-LICENSE.txt"));
  assert.match(model.licensing.convertedArtifactStatement, /standalone LICENSE/);
});

test("unsafe and duplicate destinations are rejected", () => {
  const invalid = structuredClone(lock);
  invalid.models[0].files[0].destination = "../outside";
  assert.throws(() => validateLock(invalid), /unsafe component/);

  const duplicate = structuredClone(lock);
  duplicate.models[0].files[1].destination = duplicate.models[0].files[0].destination;
  assert.throws(() => validateLock(duplicate), /duplicate destination/i);

  const movingSource = structuredClone(lock);
  movingSource.models[0].sourceModelRevision = "main";
  assert.throws(() => validateLock(movingSource), /sourceModelRevision/);

  const duplicateStorage = structuredClone(lock);
  duplicateStorage.models[1].storageDirectory = duplicateStorage.models[0].storageDirectory;
  assert.throws(() => validateLock(duplicateStorage), /duplicate storage directory/i);
});

test("selection fails closed for unknown model keys", () => {
  assert.deepEqual(selectedModels(lock, ["gemma4-e4b"]).map((model) => model.key), [
    "gemma4-e4b",
  ]);
  assert.throws(() => selectedModels(lock, ["unknown"]), /Unknown model key/);
});

test("asset pack identifiers reject periods that App Store Connect refuses", () => {
  // Verified against the live API on 2026-09-21: a dotted identifier answers
  // 400 PARAMETER_ERROR for filter[assetPackIdentifier], while a hyphenated one
  // is accepted. Keep the lock free of identifiers App Store Connect cannot
  // look up.
  const dotted = structuredClone(lock);
  dotted.models[0].assetPackId = "dev.hazakura.editor.coreai.gemma4-e4b.v1";
  assert.throws(() => validateLock(dotted), /Invalid asset pack id/);

  const hyphenated = structuredClone(lock);
  hyphenated.models[0].assetPackId = "hazakura-coreai-gemma4-e4b-v1";
  assert.equal(validateLock(hyphenated).models[0].assetPackId, "hazakura-coreai-gemma4-e4b-v1");
});

test("download URLs and model metadata stay pinned to the lock", () => {
  const model = lock.models[0];
  const url = sourceDownloadUrl(model, model.files[0]);
  assert.match(url, new RegExp(model.convertedRevision));
  assert.doesNotMatch(url, /\/resolve\/main\//);
  assert.equal(buildModelMetadata(model).runtimeKind, "coreai-kit-gemma4-ple");
});

test("resource manifest fixes expanded limits to the verified file set", () => {
  const model = lock.models[0];
  const entries = [
    { path: "a", size: 10, sha256: "a".repeat(64) },
    { path: "b", size: 20, sha256: "b".repeat(64) },
  ];
  const manifest = buildResourceManifest(model, entries);
  assert.equal(manifest.expandedBytes, 30);
  assert.equal(manifest.maxEntries, 2);
  assert.equal(manifest.maxExpandedBytes, 30 + 16 * 1024 * 1024);
  assert.deepEqual(manifest.files, entries);
});

test("runtime pins the E4B resource manifest used after Apple-hosted materialization", async () => {
  const runtimeManifest = JSON.parse(await readFile(
    new URL("../src-tauri/resources/core-ai/gemma4-e4b-resource-manifest.json", import.meta.url),
    "utf8",
  ));
  assert.equal(runtimeManifest.modelId, lock.models[0].modelId);
  assert.equal(runtimeManifest.catalogVersion, lock.models[0].catalogVersion);
  assert.equal(runtimeManifest.storageDirectory, lock.models[0].storageDirectory);
  assert.equal(runtimeManifest.files.length, runtimeManifest.maxEntries);
  assert.equal(runtimeManifest.expandedBytes, 6807926119);
});

test("Background Assets manifests are on-demand, macOS-only, and contain no network URL", () => {
  const manifest = buildBackgroundAssetsManifest(lock.models[1]);
  assert.deepEqual(manifest.downloadPolicy, { onDemand: {} });
  assert.deepEqual(manifest.platforms, ["macOS"]);
  assert.equal(JSON.stringify(manifest).includes("http"), false);
  assert.equal(manifest.fileSelectors[0].directoryDestination.startsWith("CoreAIModels/"), true);
});

test("ba-package gets absolute paths because it chdirs to the manifest sourceRoot", () => {
  const commands = buildBaPackageCommands(
    "/tmp/hazakura/manifests/background-assets-manifest.json",
    "/tmp/hazakura/archives/model.aar",
  );
  assert.deepEqual(commands, {
    cwd: "/tmp/hazakura",
    evaluate: ["evaluate", "/tmp/hazakura/manifests/background-assets-manifest.json"],
    package: [
      "/tmp/hazakura/manifests/background-assets-manifest.json",
      "-o",
      "/tmp/hazakura/archives/model.aar",
      "--verbose",
    ],
  });
});

test("ba-package arguments may not escape the version root", () => {
  assert.throws(
    () => buildBaPackageCommands(
      "/tmp/hazakura/manifests/background-assets-manifest.json",
      "/tmp/outside/model.aar",
    ),
    /must stay inside/,
  );
  assert.throws(
    () => buildBaPackageCommands(
      "/tmp/outside/version/manifests/background-assets-manifest.json",
      "/tmp/hazakura/archives/model.aar",
    ),
    /must stay inside/,
  );
});

test("packaging blocker records the exact toolchain failure without claiming an archive", () => {
  const text = formatPackagingBlocker(
    lock.models[0],
    "Xcode 27.0\nBuild version 27A266a",
    "Error: path extension isn’t json",
  );
  assert.match(text, /hazakura-coreai-gemma4-e4b-v1/);
  assert.match(text, /27A266a/);
  assert.match(text, /path extension isn’t json/);
  assert.match(text, /No \.aar was created/);
});

test("download command uses aria2 when available and keeps curl as the portable fallback", () => {
  const url = "https://example.invalid/model";
  const partialPath = "/private/tmp/model.partial";
  const aria = buildDownloadCommand(true, url, partialPath);
  assert.equal(aria.command, "aria2c");
  assert.ok(aria.args.includes("--continue=true"));
  assert.ok(aria.args.includes("--split=8"));
  assert.ok(aria.args.includes("model.partial"));

  const curl = buildDownloadCommand(false, url, partialPath);
  assert.equal(curl.command, "curl");
  assert.ok(curl.args.includes("--continue-at"));
  assert.ok(curl.args.includes(partialPath));
});
