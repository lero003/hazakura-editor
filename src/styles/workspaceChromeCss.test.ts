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
