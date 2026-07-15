import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Deterministic on-disk OKF fixtures for packaged / discovery smoke.
 * Spec pin: OKF v0.1 Draft commit ee67a5c (docs/okf-spec-pin.md).
 * When the pin moves, update this script together with the pure model,
 * scaffold assets, and living docs — do not drift alone.
 *
 * Usage:
 *   node scripts/generate-v1.11-okf-smoke.mjs [outputDirectory]
 */

export const OKF_FIXTURE_SPEC_COMMIT = "ee67a5c";

const VALID_ROOT_INDEX = `---
okf_version: "0.1"
---

# 作品

* [第一章 朝の光](chapters/01-morning.md) - 物語の導入部。
* [第二章 午後の風](chapters/02-afternoon.md) - 中盤の転換。
* [ノート](notes/) - 設定メモ
`;

const VALID_CHAPTERS_INDEX = `# 章

* [第一章](01-morning.md)
* [第二章](02-afternoon.md)
`;

const VALID_LOG = `# Directory Update Log

## 2026-07-02
* **Update**: 第二章を追加。

## 2026-07-01
* **Creation**: 作品バンドルを開始。
`;

const VALID_MORNING = `---
type: Chapter
title: 第一章 朝の光
description: 物語の導入部。
tags: [novel, chapter]
timestamp: 2026-07-01T09:00:00Z
---

春の朝、主人公は駅前の坂をのぼった。

続きは [第二章](/chapters/02-afternoon.md) と
[登場人物メモ](../notes/characters.md) を参照。
`;

const VALID_AFTERNOON = `---
type: Chapter
title: 第二章 午後の風
description: 中盤の転換。
tags: [novel, chapter]
timestamp: 2026-07-01T12:00:00Z
---

午後、風向きが変わった。朝の出来事は [第一章](/chapters/01-morning.md) にある。
`;

const VALID_CHARACTERS = `---
type: Note
title: 登場人物
description: 主要人物の覚え書き。
tags: [novel, note]
---

- 主人公: まだ名前を決めていない
- 参照: [外部資料](https://example.com/docs)
`;

export function buildOkfSmokeFixtureTrees() {
  return {
    "valid-root-versioned": {
      "index.md": VALID_ROOT_INDEX,
      "log.md": VALID_LOG,
      "chapters/index.md": VALID_CHAPTERS_INDEX,
      "chapters/01-morning.md": VALID_MORNING,
      "chapters/02-afternoon.md": VALID_AFTERNOON,
      "notes/characters.md": VALID_CHARACTERS,
    },
    "broken-and-invalid": {
      "plain.md": "# No frontmatter\n",
      "bad-type.md": "---\ntype: 1\n---\n\nBody.\n",
      "broken-link.md":
        "---\ntype: Note\n---\n\nSee [missing](./nope.md).\n",
      "escape.md":
        "---\ntype: Note\n---\n\nOut [x](../../outside.md).\n",
    },
    "japanese-essay": {
      "index.md": `---
okf_version: "0.1"
---

# 随筆集

* [序](essays/preface.md) - はじめに
* [本編](essays/body.md) - 本文
`,
      "essays/preface.md": `---
type: Essay
title: 序
description: はじめに
tags: [随筆]
---

これは日本語の随筆バンドルです。

本編は [本文](./body.md) へ。
`,
      "essays/body.md": `---
type: Essay
title: 本編
description: 本文
tags: [随筆]
---

桜の季節に、古いノートをひらいた。

序は [序](./preface.md)。
`,
    },
  };
}

export async function generateOkfSmokeFixtures(outputDirectory) {
  const output = resolve(outputDirectory);
  const trees = buildOkfSmokeFixtureTrees();
  const written = [];

  await mkdir(output, { recursive: true });
  for (const [bundleName, files] of Object.entries(trees)) {
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = join(output, bundleName, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents, "utf8");
      written.push({
        bundle: bundleName,
        path: `${bundleName}/${relativePath}`,
        chars: contents.length,
        lines: contents.split("\n").length,
      });
    }
  }

  const manifest = {
    specCommit: OKF_FIXTURE_SPEC_COMMIT,
    specLabel: "OKF v0.1 Draft",
    output,
    bundles: Object.keys(trees),
    files: written,
  };
  await writeFile(
    join(output, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return manifest;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  const outputDirectory =
    process.argv[2] ?? join(tmpdir(), "hazakura-v1.11-okf-smoke");
  const result = await generateOkfSmokeFixtures(outputDirectory);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
