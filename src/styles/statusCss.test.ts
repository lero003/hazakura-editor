/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewCss = readFileSync(
  `${process.cwd()}/src/styles/preview.css`,
  "utf8",
);

describe("status bar CSS", () => {
  /** hover / focus-within のチップ面（両テストで同じ規則を見る）。 */
  const hoverRule =
    previewCss.match(
      /\n\.status-bar-format-chip:hover,[^}]*\.status-bar-format-chip:focus-within\s*{(?<body>[^}]*)}/s,
    )?.groups?.body ?? "";

  it("keeps the normal status bar visible while shedding secondary text on narrow windows", () => {
    const statusBarRule =
      previewCss.match(/\.status-bar\s*{(?<body>[^}]*)}/s)?.groups?.body ?? "";
    const detailRule =
      previewCss.match(/\.status-bar-detail\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const directDetailRule =
      previewCss.match(/\.status-bar > \.status-bar-detail\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "";
    const formatGroupRule =
      previewCss.match(/\.status-bar-format-group\s*{(?<body>[^}]*)}/s)
        ?.groups?.body ?? "";
    const mediumRule =
      previewCss.match(
        /@media \(max-width: 860px\)\s*{(?<body>[\s\S]*?)\n}/,
      )?.groups?.body ?? "";
    const compactRule =
      previewCss.match(
        /@media \(max-width: 720px\)\s*{(?<body>[\s\S]*)\n}/,
      )?.groups?.body ?? "";

    expect(statusBarRule).toMatch(/min-height:\s*28px/);
    expect(statusBarRule).toMatch(/overflow:\s*hidden/);
    expect(detailRule).toMatch(/max-width:\s*min\(40ch,\s*38vw\)/);
    expect(directDetailRule).toMatch(/margin-left:\s*auto/);
    expect(formatGroupRule).toMatch(/margin-left:\s*auto/);
    expect(formatGroupRule).toMatch(/flex:\s*0 1 auto/);
    expect(formatGroupRule).toMatch(/max-width:\s*min\(64ch,\s*72vw\)/);
    expect(formatGroupRule).not.toMatch(/min\(58ch,\s*54vw\)/);
    expect(mediumRule).toMatch(/\.status-bar-detail\s*{[^}]*display:\s*none/s);
    expect(compactRule).toMatch(
      /\.status-bar-format-label\s*{[^}]*display:\s*none/s,
    );
  });

  it("keeps the format chips on the chrome text tokens, not the legacy dark status ink", () => {
    // チップは chrome 面（ツールバー・タブ・ステータスと同じ下地）に載る。
    // --status-text は旧・暗色ステータスバー用で light ではほぼ白になり、
    // 明るい chrome の上で文字が沈む（実機指摘）。chrome の --text /
    // --text-muted は themeContrast が全テーマで 4.5:1 を検査している。
    const chipRule =
      previewCss.match(/\n\.status-bar-format-chip\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const labelRule =
      previewCss.match(/\n\.status-bar-format-label\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const valueRule =
      previewCss.match(/\n\.status-bar-format-value\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const selectRule =
      previewCss.match(/\n\.status-bar-format-select\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";
    const detailRule =
      previewCss.match(/\n\.status-bar-detail\s*{(?<body>[^}]*)}/s)?.groups?.body ??
      "";
    expect(chipRule).toMatch(/color:\s*var\(--text\)/);
    expect(chipRule).toMatch(/background:\s*color-mix\(in srgb,\s*var\(--text\)/);
    expect(labelRule).toMatch(/color:\s*var\(--text\)/);
    // 詳細テキストも opacity で薄めない（chrome 面で 3.7:1 まで落ちていた）。
    expect(detailRule).not.toMatch(/opacity:/);
    expect(valueRule).toMatch(/color:\s*var\(--text\)/);
    expect(selectRule).toMatch(/color:\s*var\(--text\)/);
    // ネイティブのポップアップ面はテーマ側の指定に従う（light で暗いメニューを出さない）。
    expect(selectRule).toMatch(/color-scheme:\s*var\(--form-control-scheme/);

    // ラベルは opacity で薄めない（4.5:1 を割る）。
    expect(labelRule).not.toMatch(/opacity:/);
    // チップの文字に旧トークンが戻ってきたら落とす。
    for (const rule of [chipRule, labelRule, valueRule, selectRule, hoverRule]) {
      expect(rule).not.toContain("--status-text");
    }
  });

  it("keeps format hover chromatic without whitening the status chips", () => {
    const selectRule =
      previewCss.match(/\n\.status-bar-format-select\s*{(?<body>[^}]*)}/s)?.groups
        ?.body ?? "";

    expect(selectRule).toMatch(/background-color:\s*transparent/);
    expect(selectRule).toMatch(/background-image:\s*none/);
    expect(selectRule).toMatch(/height:\s*100%/);
    expect(selectRule).toMatch(/inset:\s*0/);
    expect(selectRule).toMatch(/min-width:\s*0/);
    expect(selectRule).toMatch(/opacity:\s*0/);
    expect(selectRule).toMatch(/position:\s*absolute/);
    expect(selectRule).toMatch(/width:\s*100%/);
    expect(hoverRule).toMatch(
      /background:\s*color-mix\(in srgb,\s*var\(--accent\) 24%,\s*transparent\)/,
    );
    expect(hoverRule).toMatch(
      /border-color:\s*color-mix\(in srgb,\s*var\(--accent\) 36%,\s*transparent\)/,
    );
    expect(hoverRule).toMatch(/color:\s*var\(--text\)/);
    expect(previewCss).not.toMatch(
      /\.status-bar-format-chip:hover,[\s\S]*background:\s*color-mix\(in srgb,\s*var\(--status-text\) 14%,\s*transparent\)/s,
    );
    expect(previewCss).not.toMatch(
      /:root\[data-theme="light"\] \.status-bar-format-chip:hover/,
    );
  });
});
