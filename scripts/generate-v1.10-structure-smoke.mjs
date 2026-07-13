import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LONG_SECTION_LINES = 800;

export function buildStructureSmokeFixtures() {
  return {
    "structure-overview.md": [
      "---",
      "title: v1.10 構造テスト",
      "language: ja",
      "---",
      "# v1.10 構造テスト",
      "",
      "Outlineの階層、ページ区切り、助言、見出しレベル変更を確認します。",
      "",
      "## 第一章",
      "",
      "### 第一場面",
      "",
      "---",
      "",
      "## 重複する名前",
      "",
      "本文。",
      "",
      "## 重複する名前",
      "",
      "##",
      "",
      "##### レベルが飛ぶ見出し",
      "",
      "末尾の区切りは読書表示では除外されます。",
      "",
      "---",
      "",
    ].join("\n"),
    "long-section.md": [
      "# 極端に長いセクション",
      ...Array.from(
        { length: LONG_SECTION_LINES },
        (_, index) => `${String(index + 1).padStart(3, "0")}: 長さ助言の確認行`,
      ),
      "LONG-SECTION-END-MARKER",
      "",
    ].join("\n"),
  };
}

export async function generateStructureSmokeFixtures(outputDirectory) {
  const output = resolve(outputDirectory);
  const fixtures = buildStructureSmokeFixtures();
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

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  const outputDirectory =
    process.argv[2] ?? join(tmpdir(), "hazakura-v1.10-structure-smoke");
  const result = await generateStructureSmokeFixtures(outputDirectory);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
