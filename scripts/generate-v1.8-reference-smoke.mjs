import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_TEXT_REFERENCE_CHARS = 1_500_000;
export const MAX_TEXT_REFERENCE_LINES = 50_000;

const LONG_LINE =
  "日本語の長い参照行です。狭いペインで自然に折り返し、横スクロールを要求しないことを確認します。";

export function buildReferenceSmokeFixtures() {
  const longReferenceLines = Array.from(
    { length: 5_000 },
    (_, index) =>
      `${String(index + 1).padStart(4, "0")}: ${LONG_LINE}${
        index === 2_499 ? " WRAP-SELECTION-MARKER-2500" : ""
      }`,
  );
  longReferenceLines[4_999] += " END-MARKER-5000";

  return {
    "editor.md": [
      "# v1.8 Reference Budget Smoke",
      "",
      "このMarkdown bufferはbudget超過後も変更されないことを確認します。",
      "",
      "EDITOR-BUFFER-MARKER",
      "",
    ].join("\n"),
    "reference-5000-lines.txt": longReferenceLines.join("\n"),
    "reference-over-chars.txt": "字".repeat(MAX_TEXT_REFERENCE_CHARS + 1),
    "reference-over-lines.txt": "\n".repeat(MAX_TEXT_REFERENCE_LINES),
  };
}

export async function generateReferenceSmokeFixtures(outputDirectory) {
  const output = resolve(outputDirectory);
  const fixtures = buildReferenceSmokeFixtures();
  await mkdir(output, { recursive: true });
  await Promise.all(
    Object.entries(fixtures).map(([name, contents]) =>
      writeFile(join(output, name), contents, "utf8"),
    ),
  );
  return {
    output,
    files: Object.entries(fixtures).map(([name, contents]) => ({
      name,
      chars: contents.length,
      lines: contents.split("\n").length,
    })),
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const outputDirectory =
    process.argv[2] ?? join(tmpdir(), "hazakura-v1.8-reference-smoke");
  const result = await generateReferenceSmokeFixtures(outputDirectory);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
