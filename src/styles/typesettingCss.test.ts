import { describe, expect, it } from "vitest";
import { ruleBody, stripCssComments } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const tokens = readProjectFile("src/styles/tokens.css");
const themes = readProjectFile("src/styles/themes.css");
const edohigan = readProjectFile("src/styles/edohigan-theme.css");
const shinkai = readProjectFile("src/styles/shinkai-theme.css");
const crt = readProjectFile("src/styles/crt-theme.css");
const typesetting = readProjectFile("src/styles/typesetting.css");
const index = readProjectFile("src/styles/index.css");

describe("font smoothing follows the theme lightness", () => {
  it("leaves the root on the UA default", () => {
    // 明色の既定で文字を細らせない。暗色テーマだけが自前で指定する。
    const root = stripCssComments(ruleBody(tokens, ":root"));
    expect(root).not.toContain("text-rendering: optimizeLegibility");
    expect(root).not.toContain("-webkit-font-smoothing");
  });

  it.each([
    ["dark", themes, ':root[data-theme="dark"]'],
    ["yakou", themes, ':root[data-theme="yakou"]'],
    ["shinkai", shinkai, ':root[data-theme="shinkai"]'],
    ["crt", crt, ':root[data-theme="crt"]'],
  ])("%s opts into antialiased text", (_theme, css, selector) => {
    expect(ruleBody(css, selector)).toContain(
      "-webkit-font-smoothing: antialiased",
    );
  });

  it.each([
    ["light", tokens, ":root"],
    ["shokou", themes, ':root[data-theme="shokou"]'],
    ["edohigan", edohigan, ':root[data-theme="edohigan"]'],
  ])("%s keeps the UA grayscale settings", (_theme, css, selector) => {
    expect(stripCssComments(ruleBody(css, selector))).not.toContain(
      "-webkit-font-smoothing",
    );
  });
});

describe("Japanese typesetting", () => {
  const readingSurfaces = ruleBody(
    typesetting,
    '.markdown-preview,\n:root[data-l-mode="on"] .cm-content'.trim(),
  );

  it("applies proportional kana and punctuation trimming to reading surfaces", () => {
    expect(readingSurfaces).toContain('font-feature-settings: "palt" 1');
    expect(readingSurfaces).toContain("text-spacing-trim: trim-start");
    expect(readingSurfaces).toContain("hanging-punctuation: allow-end");
    expect(readingSurfaces).toContain("line-break: strict");
  });

  it("keeps the editing surface to line-breaking rules only", () => {
    // 通常の編集面に palt を入れると IME の変換中表示とカーソル位置の
    // 実機確認が必要になる。禁則だけ先に固定し、palt は別判断に残す。
    // `ruleBody` は部分一致なので、L Mode 側の `.cm-content` より先に
    // 行頭の `.cm-content {` を拾う。
    const editor =
      typesetting.match(/^\.cm-content\s*{(?<body>[^}]*)}/m)?.groups?.body ?? "";
    expect(editor).toContain("line-break: strict");
    expect(editor).not.toContain("font-feature-settings");
  });

  it("does not change text size or line height", () => {
    // 組版だけのスライス。文字サイズ・行送りは利用者設定の領分なので触らない。
    expect(typesetting).not.toMatch(/(^|[\s;{])font-size\s*:/);
    expect(typesetting).not.toMatch(/(^|[\s;{])line-height\s*:/);
  });

  it("loads after the preview and L Mode stylesheets", () => {
    const at = index.indexOf('@import "./typesetting.css"');
    expect(at).toBeGreaterThan(index.indexOf('@import "./preview.css"'));
    expect(at).toBeGreaterThan(index.indexOf('@import "./lMode.css"'));
  });
});
