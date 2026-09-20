import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const root = mkdtempSync(join(tmpdir(), "hazakura-ba-package-repro-"));
const payload = join(root, "payload");
const manifestPath = join(root, "manifest.json");
const templatePath = join(root, "apple-template.json");
const archivePath = join(root, "dev.hazakura.editor.coreai.smoke.v1.aar");
mkdirSync(payload);
writeFileSync(join(payload, "asset.txt"), "Hazakura Background Assets smoke fixture\n", "utf8");
writeFileSync(manifestPath, `${JSON.stringify({
  assetPackID: "dev.hazakura.editor.coreai.smoke.v1",
  downloadPolicy: { onDemand: {} },
  fileSelectors: [{
    directorySource: "payload",
    directoryDestination: "SmokeAsset",
  }],
  platforms: ["macOS"],
  sourceRoot: ".",
}, null, 2)}\n`, "utf8");

function run(args) {
  const result = spawnSync("xcrun", ["ba-package", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    command: `xcrun ba-package ${args.join(" ")}`,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const templateStdout = run(["template"]);
if (templateStdout.status === 0) writeFileSync(templatePath, templateStdout.stdout, "utf8");
const results = [
  templateStdout,
  run(["template", "--output-path", templatePath]),
  run(["evaluate", manifestPath]),
  run(["package", manifestPath, "--output-path", archivePath, "--verbose"]),
];
const xcode = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
const baPackage = spawnSync("xcrun", ["ba-package", "--version"], { encoding: "utf8" });
const extensionFailures = results
  .filter((result) => result.status !== 0)
  .every((result) => /path extension isn.t [“"]?json/iu.test(`${result.stdout}\n${result.stderr}`));
const report = {
  schemaVersion: 1,
  workingDirectory: root,
  toolchain: {
    xcode: (xcode.stdout || xcode.stderr || "").trim(),
    baPackage: (baPackage.stdout || baPackage.stderr || "").trim(),
  },
  fixture: {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
    payloadBytes: readFileSync(join(payload, "asset.txt")).byteLength,
  },
  classification: extensionFailures
    ? "toolchain-path-extension-validation"
    : "requires-manual-review",
  results,
};
const reportText = `${JSON.stringify(report, null, 2)}\n`;
const reportPath = outputArgument
  ? resolve(outputArgument.slice("--output=".length))
  : join(root, "report.json");
writeFileSync(reportPath, reportText, "utf8");
process.stdout.write(reportText);
process.stderr.write(`ba-package reproduction report: ${reportPath}\n`);
