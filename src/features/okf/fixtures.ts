/**
 * Public-safe OKF v0.1 Draft fixtures for v1.11 S0/S1.
 * Spec pin: commit ee67a5c — do not silently follow main.
 */

export const OKF_FIXTURE_SPEC_COMMIT = "ee67a5c" as const;

export type OkfFixtureFile = {
  relativePath: string;
  content: string | null;
  /** When content is null, discovery-layer unreadability reason. */
  unreadableReason?: "non-utf8" | "io-error" | "over-budget";
  /** Optional explicit byte length (defaults to UTF-8 byte length of content). */
  byteLength?: number;
};

export type OkfFixtureBundle = {
  name: string;
  description: string;
  files: OkfFixtureFile[];
};

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

function file(
  relativePath: string,
  content: string,
): OkfFixtureFile {
  return {
    relativePath,
    content,
    byteLength: utf8Bytes(content),
  };
}

const VALID_ORDERS = `---
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

export function buildOkfFixtureBundle(name: string): OkfFixtureBundle {
  const builder = FIXTURE_BUILDERS[name];
  if (!builder) {
    throw new Error(`Unknown OKF fixture bundle: ${name}`);
  }
  return builder();
}

export function listOkfFixtureNames(): string[] {
  return Object.keys(FIXTURE_BUILDERS);
}

const FIXTURE_BUILDERS: Record<string, () => OkfFixtureBundle> = {
  "valid-root-versioned": () => ({
    name: "valid-root-versioned",
    description:
      "Valid root-versioned Japanese multi-file essay/novel-style bundle.",
    files: [
      file("index.md", VALID_ROOT_INDEX),
      file("log.md", VALID_LOG),
      file("chapters/index.md", VALID_CHAPTERS_INDEX),
      file("chapters/01-morning.md", VALID_ORDERS),
      file("chapters/02-afternoon.md", VALID_AFTERNOON),
      file("notes/characters.md", VALID_CHARACTERS),
    ],
  }),

  "versionless-root-index": () => ({
    name: "versionless-root-index",
    description: "Root index without okf_version frontmatter.",
    files: [
      file(
        "index.md",
        `# Bundle\n\n* [Concept](concept.md) - a concept\n`,
      ),
      file(
        "concept.md",
        `---\ntype: Note\ntitle: Concept\n---\n\nBody.\n`,
      ),
    ],
  }),

  "nested-index-frontmatter": () => ({
    name: "nested-index-frontmatter",
    description: "Nested index.md incorrectly carries frontmatter.",
    files: [
      file(
        "index.md",
        `---\nokf_version: "0.1"\n---\n\n# Root\n\n* [Sub](sub/)\n`,
      ),
      file(
        "sub/index.md",
        `---\ntitle: Nested\ntype: ShouldNotBeConcept\n---\n\n# Nested\n\n* [Item](item.md)\n`,
      ),
      file(
        "sub/item.md",
        `---\ntype: Note\ntitle: Item\n---\n\nNested item.\n`,
      ),
    ],
  }),

  "reserved-with-type": () => ({
    name: "reserved-with-type",
    description: "index.md and log.md include type but stay reserved.",
    files: [
      file(
        "index.md",
        `---\nokf_version: "0.1"\ntype: NotAConcept\n---\n\n# Index\n\n* [A](a.md)\n`,
      ),
      file(
        "log.md",
        `---\ntype: NotAConcept\n---\n\n# Log\n\n## 2026-07-01\n* Init\n`,
      ),
      file("a.md", `---\ntype: Note\ntitle: A\n---\n\nA.\n`),
    ],
  }),

  "empty-index": () => ({
    name: "empty-index",
    description: "Present but empty index.md (advice only).",
    files: [
      file("index.md", ""),
      file("a.md", `---\ntype: Note\n---\n\nA.\n`),
    ],
  }),

  "log-order-advice": () => ({
    name: "log-order-advice",
    description: "log.md dates not newest-first.",
    files: [
      file(
        "log.md",
        `# Log\n\n## 2026-07-01\n* Older first\n\n## 2026-07-03\n* Newer later (wrong order)\n`,
      ),
      file("a.md", `---\ntype: Note\n---\n\nA.\n`),
    ],
  }),

  "invalid-yaml": () => ({
    name: "invalid-yaml",
    description: "Concept with truly unparseable YAML (unclosed quote).",
    files: [
      file(
        "broken.md",
        `---\ntype: "Note\ntitle: Broken\n---\n\nBody.\n`,
      ),
    ],
  }),

  "nested-yaml-valid": () => ({
    name: "nested-yaml-valid",
    description: "Valid nested YAML mapping is accepted (not a failure).",
    files: [
      file(
        "nested.md",
        `---\ntype: Note\ntitle: Nested\nmeta:\n  nested: true\n  score: 2\n---\n\nBody.\n`,
      ),
    ],
  }),

  "cyclic-yaml-alias": () => ({
    name: "cyclic-yaml-alias",
    description:
      "Parser-accepted cyclic alias must not crash conversion or force failure when type is valid.",
    files: [
      file(
        "cycle.md",
        `---\ntype: Note\ntitle: Cycle\nmeta: &meta\n  nested: true\n  again: *meta\n---\n\nBody.\n`,
      ),
    ],
  }),

  "unclosed-yaml": () => ({
    name: "unclosed-yaml",
    description: "Concept with unclosed frontmatter fence.",
    files: [
      file(
        "unclosed.md",
        `---\ntype: Note\ntitle: Unclosed\n\n# Body without closing fence\n`,
      ),
    ],
  }),

  "missing-type": () => ({
    name: "missing-type",
    description: "Concept frontmatter without type.",
    files: [
      file("no-type.md", `---\ntitle: No Type\n---\n\nBody.\n`),
    ],
  }),

  "empty-type": () => ({
    name: "empty-type",
    description: "Concept with empty type string.",
    files: [
      file("empty-type.md", `---\ntype: ""\ntitle: Empty\n---\n\nBody.\n`),
    ],
  }),

  "numeric-type": () => ({
    name: "numeric-type",
    description: "Concept with numeric type (must fail).",
    files: [
      file("numeric-type.md", `---\ntype: 42\ntitle: Numeric\n---\n\nBody.\n`),
    ],
  }),

  "list-type": () => ({
    name: "list-type",
    description: "Concept with sequence type (must fail).",
    files: [
      file(
        "list-type.md",
        `---\ntype: [Note, Draft]\ntitle: List\n---\n\nBody.\n`,
      ),
    ],
  }),

  "unknown-type-fields": () => ({
    name: "unknown-type-fields",
    description: "Unknown type and producer-defined fields are tolerated.",
    files: [
      file(
        "custom.md",
        `---\ntype: AcmeWidget\ntitle: Widget\nx_custom_score: 9\nproducer: hazakura-fixture\n---\n\nBody with unknown fields.\n`,
      ),
    ],
  }),

  "broken-links": () => ({
    name: "broken-links",
    description: "Broken inline local links (advice only).",
    files: [
      file(
        "source.md",
        `---\ntype: Note\ntitle: Source\n---\n\nSee [missing](./missing.md) and [also gone](/other/gone.md).\n`,
      ),
    ],
  }),

  "external-links": () => ({
    name: "external-links",
    description: "External http/https/mailto/tel links are not broken.",
    files: [
      file(
        "source.md",
        `---\ntype: Note\ntitle: External\n---\n\n- [Web](https://example.com/a)\n- [Mail](mailto:dev@example.com)\n- [Tel](tel:+810000000000)\n`,
      ),
    ],
  }),

  "root-relative-links": () => ({
    name: "root-relative-links",
    description: "Bundle-root absolute /links resolve from selected root.",
    files: [
      file(
        "index.md",
        `---\nokf_version: "0.1"\n---\n\n# Root\n\n* [Deep](dir/nested.md)\n`,
      ),
      file(
        "dir/nested.md",
        `---\ntype: Note\ntitle: Nested\n---\n\nBack to [peer](/peer.md).\n`,
      ),
      file("peer.md", `---\ntype: Note\ntitle: Peer\n---\n\nPeer body.\n`),
    ],
  }),

  "extensionless-dir": () => ({
    name: "extensionless-dir",
    description: "Extensionless and directory targets with index.md.",
    files: [
      file(
        "source.md",
        `---\ntype: Note\ntitle: Source\n---\n\nSee [dir](./section/) and [id](./section/item).\n`,
      ),
      file(
        "section/index.md",
        `# Section\n\n* [Item](item.md)\n`,
      ),
      file(
        "section/item.md",
        `---\ntype: Note\ntitle: Item\n---\n\nItem.\n`,
      ),
    ],
  }),

  "escape-parent": () => ({
    name: "escape-parent",
    description: "../ escape outside selected bundle root is out-of-scope.",
    files: [
      file(
        "inner/note.md",
        `---\ntype: Note\ntitle: Inner\n---\n\nEscape [out](../../outside.md) and [up](../secrets.md).\n`,
      ),
    ],
  }),

  "missing-frontmatter": () => ({
    name: "missing-frontmatter",
    description: "Concept without any frontmatter.",
    files: [file("plain.md", `# Just Markdown\n\nNo frontmatter.\n`)],
  }),

  "missing-root-index": () => ({
    name: "missing-root-index",
    description: "Bundle with concepts but no root index.md.",
    files: [
      file("a.md", `---\ntype: Note\ntitle: A\n---\n\nA.\n`),
      file("b.md", `---\ntype: Note\ntitle: B\n---\n\nB.\n`),
    ],
  }),

  "unreadable-non-utf8": () => ({
    name: "unreadable-non-utf8",
    description: "Discovery reports non-UTF-8 Markdown as unreadable.",
    files: [
      {
        relativePath: "binary-looking.md",
        content: null,
        unreadableReason: "non-utf8",
        byteLength: 64,
      },
      file("ok.md", `---\ntype: Note\ntitle: OK\n---\n\nReadable.\n`),
    ],
  }),

  "unknown-okf-version": () => ({
    name: "unknown-okf-version",
    description: "Root declares an unknown okf_version (best-effort advice).",
    files: [
      file(
        "index.md",
        `---\nokf_version: "9.9"\n---\n\n# Root\n\n* [A](a.md)\n`,
      ),
      file("a.md", `---\ntype: Note\ntitle: A\n---\n\nA.\n`),
    ],
  }),

  "japanese-essay": () => ({
    name: "japanese-essay",
    description:
      "UTF-8 Japanese multi-file essay reflecting Hazakura writing use.",
    files: [
      file(
        "index.md",
        `---\nokf_version: "0.1"\n---\n\n# 随筆集\n\n* [序](essays/preface.md) - はじめに\n* [本編](essays/body.md) - 本文\n`,
      ),
      file(
        "essays/preface.md",
        `---\ntype: Essay\ntitle: 序\ndescription: はじめに\ntags: [随筆]\n---\n\nこれは日本語の随筆バンドルです。\n\n本編は [本文](./body.md) へ。\n`,
      ),
      file(
        "essays/body.md",
        `---\ntype: Essay\ntitle: 本編\ndescription: 本文\ntags: [随筆]\n---\n\n桜の季節に、古いノートをひらいた。\n\n序は [序](./preface.md)。\n`,
      ),
    ],
  }),
};

/** Flatten a fixture into pure-model inputs. */
export function fixtureToMarkdownInputs(
  bundle: OkfFixtureBundle,
): Array<{
  relativePath: string;
  content: string | null;
  byteLength: number;
  unreadableReason?: "non-utf8" | "io-error" | "over-budget";
}> {
  return bundle.files.map((entry) => ({
    relativePath: entry.relativePath,
    content: entry.content,
    byteLength:
      entry.byteLength ??
      (entry.content === null ? 0 : utf8Bytes(entry.content)),
    unreadableReason: entry.unreadableReason,
  }));
}
