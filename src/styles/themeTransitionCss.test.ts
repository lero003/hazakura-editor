import { describe, expect, it } from "vitest";
import { THEME_SWITCH_MS } from "../hooks/app/useThemeTransition";
import { readProjectFile } from "../test-support/source";

const themes = readProjectFile("src/styles/themes.css");

/** 切替ルールの宣言部を取り出す（セレクタが複数行の `:is(...)` のため）。 */
function transitionRule(css: string): string {
  const start = css.indexOf(':root[data-theme-switching="true"]');
  expect(start).toBeGreaterThanOrEqual(0);
  const close = css.indexOf("\n}", start);
  return css.slice(start, close);
}

describe("theme switch crossfade", () => {
  const body = transitionRule(themes);

  it("animates the surface, ink, border and shadow together", () => {
    // 面だけ先に色が変わると、切り替えの途中で文字が読めない瞬間ができる。
    // 4つを同じ長さで動かす。
    for (const property of [
      "background-color",
      "color",
      "border-color",
      "box-shadow",
    ]) {
      expect(body).toContain(`${property} 200ms var(--ease-standard)`);
    }
  });

  it("covers chrome, panes, paper and the editor", () => {
    for (const selector of [
      ".app-shell",
      ".app-primary-toolbar",
      ".tabs-row",
      ".file-tree-pane",
      ".preview-pane",
      ".markdown-preview",
      ".status-bar",
      ".cm-editor",
      ".preferences-dialog",
    ]) {
      expect(body, selector).toContain(selector);
    }
  });

  it("keeps the hook window as the single source of timing", () => {
    // CSS の 200ms と hook の属性保持時間がずれると、途中で transition が
    // 消えて色が飛ぶ。数値は hook 側の定数から読む。
    expect(THEME_SWITCH_MS).toBe(200);
    expect(body).toContain(`${THEME_SWITCH_MS}ms`);
  });
});
