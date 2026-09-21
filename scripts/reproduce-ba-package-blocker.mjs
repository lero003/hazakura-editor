import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
const root = mkdtempSync(join(tmpdir(), "hazakura-ba-package-repro-"));
const payload = join(root, "payload");
const manifestPath = join(root, "manifest.json");
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

// `ba-package` rejects every `-o <path>` argument, including a path that
// plainly ends in .json, when it runs inside a restricted sandbox. Record the
// indicators so a sandboxed run is never reported as a toolchain defect.
const sandboxIndicators = ["CODEX_SANDBOX", "SANDBOX_NAMED", "APP_SANDBOX_CONTAINER_ID"]
  .filter((name) => typeof process.env[name] === "string" && process.env[name].length > 0);
const sandboxed = sandboxIndicators.length > 0;

function run(id, args, expectedOutput) {
  const result = spawnSync("xcrun", ["ba-package", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  const outputPath = expectedOutput
    ? resolve(root, expectedOutput)
    : undefined;
  const outputExists = outputPath ? existsSync(outputPath) : undefined;
  return {
    id,
    command: `xcrun ba-package ${args.map((argument) => JSON.stringify(argument)).join(" ")}`,
    status: result.status,
    success: result.status === 0 && (outputPath === undefined || outputExists),
    ...(outputPath ? {
      expectedOutput: outputPath,
      outputExists,
      outputBytes: outputExists ? statSync(outputPath).size : null,
    } : {}),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const templateStdout = run("template-stdout", ["template"]);
if (templateStdout.status === 0) {
  writeFileSync(join(root, "apple-template-from-stdout.json"), templateStdout.stdout, "utf8");
}
const results = [
  templateStdout,
  run("template-relative-short", ["template", "-o", "apple-template.json"], "apple-template.json"),
  run(
    "template-relative-long",
    ["template", "--output-path", "apple-template-long.json"],
    "apple-template-long.json",
  ),
  run(
    "template-absolute-short",
    ["template", "-o", join(root, "apple-template-absolute.json")],
    join(root, "apple-template-absolute.json"),
  ),
  run(
    "official-relative-short",
    ["manifest.json", "-o", "smoke.aar"],
    "smoke.aar",
  ),
  run("evaluate-relative", ["evaluate", "manifest.json"]),
  run(
    "package-relative-short",
    ["package", "manifest.json", "-o", "smoke2.aar"],
    "smoke2.aar",
  ),
  run(
    "package-relative-long",
    ["package", "manifest.json", "--output-path", "smoke2-long.aar"],
    "smoke2-long.aar",
  ),
  run(
    "official-absolute-short",
    [manifestPath, "-o", join(root, "smoke-absolute.aar")],
    join(root, "smoke-absolute.aar"),
  ),
  run("evaluate-absolute", ["evaluate", manifestPath]),
  run(
    "package-absolute-short",
    ["package", manifestPath, "-o", join(root, "smoke3-short.aar")],
    join(root, "smoke3-short.aar"),
  ),
  run(
    "package-absolute-long",
    ["package", manifestPath, "--output-path", join(root, "smoke3.aar")],
    join(root, "smoke3.aar"),
  ),
];
const xcode = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
const baPackage = spawnSync("xcrun", ["ba-package", "--version"], { encoding: "utf8" });
const resultById = Object.fromEntries(results.map((result) => [result.id, result]));
const pathInputResults = results.filter((result) => result.id !== "template-stdout");
const allPathInputsFailWithExtension = pathInputResults.every(
  (result) => !result.success &&
    /path extension isn.t [“"]?json/iu.test(`${result.stdout}\n${result.stderr}`),
);
// A control case that must succeed in any healthy toolchain: the template
// written to an absolute .json path. When even that fails, the failure is not
// about Hazakura's manifest at all.
const templateOutputFailsWithExtension = results
  .filter((result) => result.id.startsWith("template-") && result.id !== "template-stdout")
  .every(
    (result) => !result.success &&
      /path extension isn.t [“"]?json/iu.test(`${result.stdout}\n${result.stderr}`),
  );
let classification = "requires-manual-review";
if (resultById["official-relative-short"].success) {
  classification = resultById["package-relative-short"].success
    ? "official-cli-compatible"
    : "default-package-command-required";
} else if (
  resultById["evaluate-relative"].success &&
  !resultById["evaluate-absolute"].success
) {
  classification = "absolute-path-incompatibility";
} else if (
  resultById["package-relative-short"].success &&
  !resultById["package-relative-long"].success
) {
  classification = "long-output-option-incompatibility";
} else if (allPathInputsFailWithExtension) {
  classification = sandboxed && templateOutputFailsWithExtension
    ? "restricted-execution-environment"
    : "toolchain-path-extension-validation";
}
const report = {
  schemaVersion: 1,
  workingDirectory: root,
  execution: {
    sandboxed,
    sandboxIndicators,
    sandboxValues: Object.fromEntries(
      sandboxIndicators.map((name) => [name, process.env[name]]),
    ),
    guidance: classification === "restricted-execution-environment"
      ? "ba-package rejects even a valid .json output path while it runs inside this " +
        "sandbox. Re-run the same script from Terminal.app before treating the failure " +
        "as a toolchain defect."
      : "Re-run the comparison in a normal shell if any input condition is unverified.",
  },
  toolchain: {
    xcode: (xcode.stdout || xcode.stderr || "").trim(),
    baPackage: (baPackage.stdout || baPackage.stderr || "").trim(),
  },
  fixture: {
    manifestPath,
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
    payloadBytes: readFileSync(join(payload, "asset.txt")).byteLength,
  },
  classification,
  comparisons: {
    relativeEvaluateSucceeded: resultById["evaluate-relative"].success,
    absoluteEvaluateSucceeded: resultById["evaluate-absolute"].success,
    shortOutputOptionSucceeded: resultById["package-relative-short"].success,
    longOutputOptionSucceeded: resultById["package-relative-long"].success,
    defaultPackageCommandSucceeded: resultById["official-relative-short"].success,
    explicitPackageCommandSucceeded: resultById["package-relative-short"].success,
    appleTemplateShortOutputSucceeded: resultById["template-relative-short"].success,
    appleTemplateLongOutputSucceeded: resultById["template-relative-long"].success,
    appleTemplateAbsoluteOutputSucceeded: resultById["template-absolute-short"].success,
  },
  results,
};
const reportText = `${JSON.stringify(report, null, 2)}\n`;
const reportPath = outputArgument
  ? resolve(outputArgument.slice("--output=".length))
  : join(root, "report.json");
writeFileSync(reportPath, reportText, "utf8");
process.stdout.write(reportText);
process.stderr.write(`ba-package reproduction report: ${reportPath}\n`);
