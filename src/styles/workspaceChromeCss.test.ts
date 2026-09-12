/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chromeCss = readFileSync(
  `${process.cwd()}/src/styles/workspace-chrome.css`,
  "utf8",
);

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    chromeCss.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))
      ?.groups?.body ?? ""
  );
}

describe("workspace-chrome.css", () => {
  it("keeps the primary toolbar's document inset clear of the native traffic lights", () => {
    // 実機指摘: 信号機と文書名の距離が詰まりすぎ（11px）。モックの文書名は左から127px。
    expect(ruleBody(".v3-shell")).toMatch(/--toolbar-document-inset:\s*96px/);
    expect(ruleBody(".app-primary-toolbar")).toMatch(
      /padding:\s*8px 20px 8px var\(--toolbar-document-inset\)/,
    );
    // 実機判断: 信号機の位置は**指定しない**（macOS標準）。指定するとテーマ切替で窓の外観が
    // 変わったときに組み直しで失われ、ボタンが動いて見えた。標準なら常に同じ場所へ戻る。
    const conf = readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, "utf8");
    expect(conf).not.toMatch(/"trafficLightPosition"/);
    // macOS標準の信号機は左から約20px・12px玉×3＋8px間隔＝右端 約72px。
    // 文書名の 96px はそこから約24px空ける（モックの「次の要素まで24px」と同じリズム）。
    expect(20 + 12 * 3 + 8 * 2).toBeLessThan(96);
    expect(96 - (20 + 12 * 3 + 8 * 2)).toBeGreaterThanOrEqual(16);
  });

  it("fixes the primary toolbar height so the chrome can not shift under the native controls", () => {
    // 実機指摘: 起動直後と操作後で信号機との相対位置が変わって見える。
    // ネイティブのボタンは窓の絶対位置なので、バーが伸びると中身だけがずれる。
    const toolbar = ruleBody(".app-primary-toolbar");
    expect(toolbar).toMatch(/height:\s*66px/);
    expect(toolbar).not.toMatch(/min-height:\s*66px/);
    // 中身が2行に折り返してバーを押し広げないこと（折り返すと固定高さの中で溢れる）。
    expect(chromeCss).toMatch(
      /\.primary-document-actions\s*{[^}]*flex-wrap:\s*nowrap/,
    );
    expect(chromeCss).not.toMatch(/\.primary-document-actions\s*{[^}]*flex-wrap:\s*wrap/);
  });

  it("keeps the font-size control at the right end of the display toolbar row", () => {
    // 実機指摘: 左端に孤立して見えたため右端へ。行は3列（先頭の字下げ / 文書列 / 右端の設定）。
    const tabsRow = ruleBody(':root:not([data-l-mode="on"]) .v3-shell .tabs-row');
    const quickSettings = ruleBody(
      ':root:not([data-l-mode="on"]) .v3-shell .editor-quick-settings',
    );

    expect(tabsRow).toMatch(/grid-template-columns:\s*42px\s+minmax\(0,\s*1fr\)\s+auto/);
    expect(quickSettings).toMatch(/grid-column:\s*3/);
    expect(quickSettings).toMatch(/justify-self:\s*end/);
  });

  it("spreads the display toolbar row across the whole document column", () => {
    // タブ行・表示ツールバー行は文書カラム全幅。プレビュー列の上の帯を空にしない。
    const meta = ruleBody(':root:not([data-l-mode="on"]) .v3-shell .document-meta');
    expect(meta).toMatch(/grid-column:\s*2/);
    expect(meta).toMatch(/justify-self:\s*stretch/);
    expect(
      ruleBody(
        ':root:not([data-l-mode="on"]) .v3-shell .document-meta > .chrome-section:has(.pane-control-cluster.reading-controls)',
      ),
    ).toMatch(/margin-left:\s*auto/);
  });

  it("keeps the CodeMirror gutter border on the border token for every theme", () => {
    // ガターだけ以前の弱い線が残らないよう、テーマ側の上書きも含めて var(--border) に一本化する。
    const declarations = ["tokens.css", "themes.css", "edohigan-theme.css", "shinkai-theme.css", "crt-theme.css", "lMode.css"]
      .flatMap((file) => readFileSync(`${process.cwd()}/src/styles/${file}`, "utf8").match(/--cm-gutter-border:\s*[^;]+;/g) ?? []);
    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) {
      expect(declaration.replace(/\s+/g, " ").trim()).toBe("--cm-gutter-border: var(--border);");
    }
  });

  it("keeps only the region boundaries on the strong border", () => {
    const strong = 'border-bottom: 1px solid var(--border-strong);';
    expect(ruleBody(':root:not([data-l-mode="on"]) .v3-shell .tabs-row')).toContain(strong);
    expect(ruleBody(':root:not([data-l-mode="on"]) .v3-shell .status-bar')).toMatch(/border-top: 1px solid var\(--border-strong\)/);
    // ツールバー下・サイドバー右・ガター右は通常の border のまま（画面全体をグリッド化しない）。
    expect(ruleBody(".app-primary-toolbar")).toMatch(/border-bottom: 1px solid var\(--border\)/);
    expect(ruleBody(':root:not([data-l-mode="on"]) .v3-shell .file-tree-pane')).toMatch(/border-right: 1px solid var\(--border\)/);
  });

  it("keeps the chrome bars on the chrome surface and the sidebar on the nav surface", () => {
    expect(chromeCss).toContain("--workspace-chrome-bar: var(--chrome-surface)");
    expect(chromeCss).toContain(".v3-shell .file-tree-pane { background: var(--workspace-chrome-surface)");
  });
});
