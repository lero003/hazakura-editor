import { describe, expect, it } from "vitest";
import { ruleBody, stripCssComments } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const appShell = stripCssComments(readProjectFile("src/styles/app-shell.css"));
const shinkai = stripCssComments(readProjectFile("src/styles/shinkai-theme.css"));
const crt = stripCssComments(readProjectFile("src/styles/crt-theme.css"));
const edohigan = stripCssComments(readProjectFile("src/styles/edohigan-theme.css"));
const maskSource = readProjectFile("src/components/app/CrtMaskOverlay.tsx");
const shellSource = readProjectFile("src/components/app/AppShell.tsx");

/**
 * 2026-10-19 オーナー指摘:
 *   - 演出が左のワークスペースだけに見えるテーマがある
 *   - 中央の編集面に明るい色が乗り、コントラストが甘くなるテーマがある
 * 面全体を明るくするCSSブレンドの除去と、アンビエントの到達範囲を固定する。
 * 動的な粒子・CRTの局所的な芯まで含むコントラスト保証ではない。
 */
describe("atmosphere reach", () => {
  it("avoids area-wide brightening CSS blend modes", () => {
    // screen / lighten / plus-lighter / hard-light / color-dodge は下地を明るくする。
    // 文字の上に乗るとコントラストが下がるため、テーマCSS全体で使わない。
    const brightening = /mix-blend-mode:\s*(screen|lighten|plus-lighter|hard-light|color-dodge)/;
    for (const [name, css] of [
      ["app-shell.css", appShell],
      ["shinkai-theme.css", shinkai],
      ["crt-theme.css", crt],
      ["edohigan-theme.css", edohigan],
    ] as const) {
      expect(css, name).not.toMatch(brightening);
    }
  });

  it("keeps the shinkai foreground to a darkening vignette", () => {
    const overlay = ruleBody(shinkai, ".shinkai-overlay");
    // 上端の明るい滲み（旧 screen 合成）は編集面・読書面のコントラストを下げるため外した。
    expect(overlay).not.toContain("rgba(180, 230, 240");
    expect(overlay).not.toContain("rgba(125, 211, 224");
    expect(overlay).toContain("rgba(0, 16, 28, 0.42)");
    expect(overlay).toContain("mix-blend-mode: normal");
  });

  it("places the water vignette behind the paper and all chrome text", () => {
    // 暗い前景も紙と文字を一緒に暗くすると比を下げる。
    // 背景の水とビネットを UI の --z-base より一段下へ置き、
    // 半透明の紙/chrome だけを通す。UI と同じ階層には置かない。
    for (const selector of [".shinkai-canvas", ".shinkai-overlay"]) {
      expect(ruleBody(shinkai, selector), selector).toContain(
        "z-index: calc(var(--z-base) - 1)",
      );
    }
    // 同じ背景階層では水→ビネットの順。本文の上には重ねない。
    const water = shellSource.indexOf("<ShinkaiShaderOverlay");
    const vignette = shellSource.indexOf('className="shinkai-overlay"');
    expect(water).toBeGreaterThanOrEqual(0);
    expect(vignette).toBeGreaterThan(water);
  });

  it("keeps the aurora as hue-only layers", () => {
    // color合成へ置換したことを固定する。WCAG相対輝度の不変は保証しない。
    const yakouBefore = ruleBody(
      appShell,
      ':root[data-theme="yakou"] .ambient-yakou::before',
    );
    const yakouAfter = ruleBody(
      appShell,
      ':root[data-theme="yakou"] .ambient-yakou::after',
    );
    const shokouBefore = ruleBody(
      appShell,
      ':root[data-theme="shokou"] .ambient-shokou::before',
    );
    for (const rule of [yakouBefore, yakouAfter, shokouBefore]) {
      expect(rule).toContain("mix-blend-mode: color");
    }
  });

  it("keeps the CRT hum bar and burn darkening, with only a hairline core", () => {
    // 管の走査戻りは明るい帯だが、画面全体の幅で明るくすると本文のコントラストが落ちる。
    expect(maskSource).toContain("HUM_DARK_ALPHA");
    expect(maskSource).toContain("HUM_CORE_ALPHA");
    expect(maskSource).toMatch(/rgba\(0, 0, 0, \$\{HUM_DARK_ALPHA\}\)/);
    expect(maskSource).toMatch(/rgba\(255, 255, 255, \$\{HUM_CORE_ALPHA\}\)/);
    expect(maskSource).toMatch(/rgba\(0, 0, 0, \$\{BURN_ALPHA\}\)/);
    // 芯は細く保つ。通過画素のコントラストが不変という保証ではない。
    expect(maskSource).toContain("Math.round((window.devicePixelRatio || 1) * 0.5)");
  });

  it("lets the edohigan artwork reach the whole window", () => {
    // 以前は inset: 66px 0 34px でツールバーと status bar を避けており、
    // 「左のワークスペースだけ演出が効く」ように見えていた。
    expect(ruleBody(edohigan, ".edohigan-ambient")).toContain("inset: 0;");
    expect(ruleBody(edohigan, ".edohigan-ambient")).not.toMatch(
      /inset:\s*66px/,
    );
  });
});
