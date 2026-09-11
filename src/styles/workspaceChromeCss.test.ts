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
    // 実機指摘: 信号機と文書名の距離が詰まりすぎ（11px）。モックの文書名は左から127pxで、
    // ネイティブの信号機は x=20・12px玉×3＋8px間隔＝右端72px。
    // 数字を2箇所に書かないよう、CSSはトークン経由・Tauriは config を読み、右端と比較する。
    expect(ruleBody(".v3-shell")).toMatch(/--toolbar-document-inset:\s*127px/);
    expect(ruleBody(".app-primary-toolbar")).toMatch(
      /padding:\s*8px 20px 8px var\(--toolbar-document-inset\)/,
    );
    const conf = readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, "utf8");
    const x = Number(/"trafficLightPosition"\s*:\s*\{\s*"x"\s*:\s*(\d+)/.exec(conf)?.[1]);
    const y = Number(/"trafficLightPosition"[^}]*"y"\s*:\s*(\d+)/.exec(conf)?.[1]);
    expect(x).toBe(20);
    expect(y).toBe(27);
    // 信号機の右端（x+12*3+8*2）が文書名の位置より十分左にあること。
    expect(x + 12 * 3 + 8 * 2).toBeLessThan(127);
  });

  it("fixes the primary toolbar height so the native traffic lights stay centered", () => {
    // 実機指摘: 起動直後と操作後で信号機との相対位置が変わって見える。
    // ネイティブの玉は絶対位置なので、バーが伸びると中身だけがずれる。
    // → バーの高さを固定し、y が「バー高さの縦中央（12px玉）」であることを両方読んで検査する。
    const toolbar = ruleBody(".app-primary-toolbar");
    expect(toolbar).toMatch(/height:\s*66px/);
    expect(toolbar).not.toMatch(/min-height:\s*66px/);
    // 中身が2行に折り返してバーを押し広げないこと（折り返すと固定高さの中で溢れる）。
    expect(chromeCss).toMatch(
      /\.primary-document-actions\s*{[^}]*flex-wrap:\s*nowrap/,
    );
    expect(chromeCss).not.toMatch(/\.primary-document-actions\s*{[^}]*flex-wrap:\s*wrap/);
    const conf = readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, "utf8");
    const y = Number(/"trafficLightPosition"[^}]*"y"\s*:\s*(\d+)/.exec(conf)?.[1]);
    // 玉は12px。バーの縦中央 = (66 - 12) / 2 = 27。
    expect(y).toBe((66 - 12) / 2);
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
