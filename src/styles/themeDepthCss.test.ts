import { describe, expect, it } from "vitest";
import { ruleBody } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const shinkai = readProjectFile("src/styles/shinkai-theme.css");
const crt = readProjectFile("src/styles/crt-theme.css");

/**
 * S10: 演出を紙の外だけに置くと「壁紙＋無地の面」に見える。
 * 書き面の内側に深度を作り、読む面は不透明のまま階調だけを与える契約を固定する。
 */
describe("S10 paper depth", () => {
  it("gives shinkai's writing paper a lit gradient over the grain", () => {
    const body = ruleBody(shinkai, ':root[data-theme="shinkai"] .cm-editor');
    expect(body).toContain("var(--paper-texture)");
    expect(body).toMatch(/radial-gradient\(/);
    expect(body).toMatch(/linear-gradient\(/);
    // 縁の反射と落ち影。面の外側ではなく内側に深度を作る。
    expect(body).toMatch(/inset 0 0 56px/);
  });

  it("does not leave shinkai's reader on a flat fill", () => {
    const body = ruleBody(
      shinkai,
      ':root[data-theme="shinkai"] .ebook-page-sheet,\n:root[data-theme="shinkai"] .ebook-reading-focus-surface',
    );
    expect(body).toContain("background-image:");
    expect(body).toMatch(/linear-gradient\(180deg,\s*#17475d/);
  });

  it("gives the shinkai preview the same water light", () => {
    const body = ruleBody(
      shinkai,
      ':root[data-theme="shinkai"] .preview-pane-preview .markdown-preview',
    );
    expect(body).toContain("background-image:");
    expect(body).toMatch(/rgba\(125, 211, 224, 0\.1\)/);
  });

  it("gives crt a tube hotspot and an inset edge", () => {
    const body = ruleBody(crt, ':root[data-theme="crt"] .cm-editor');
    expect(body).toContain("var(--paper-texture)");
    expect(body).toMatch(/rgba\(95, 224, 106, 0\.14\)/);
    expect(body).toMatch(/inset 0 0 44px/);
  });

  it("keeps the crt phosphor bloom on the writing surface", () => {
    const body = ruleBody(crt, ':root[data-theme="crt"] .cm-content');
    expect(body).toMatch(/0 0 14px rgba\(95, 224, 106, 0\.28\)/);
  });

  it("draws the crt glass reflection above the mask", () => {
    const body = ruleBody(crt, ".crt-glass");
    expect(body).toMatch(/linear-gradient\(/);
    expect(body).toMatch(/inset 0 0 100px/);
    expect(body).toMatch(/z-index:\s*calc\(var\(--z-crt-top\) \+ 1\)/);
  });

  it("adds the crt aperture grille without flattening the glass", () => {
    const body = ruleBody(crt, ".crt-glass");
    expect(body).toMatch(/repeating-linear-gradient\(\s*90deg/);
    expect(body).toContain("rgba(255, 80, 80, 0.022)");
    expect(body).toContain("rgba(90, 120, 255, 0.022)");
  });

  it("adds a shinkai foreground bokeh outside the text column", () => {
    const body = ruleBody(shinkai, ".shinkai-bokeh");
    expect(body).toContain("filter: blur(28px)");
    expect(body).toContain("mask-image:");
    expect(body).toContain("transparent 44%");
    expect(body).toContain("transparent 56%");
    expect(body).toMatch(/z-index:\s*calc\(var\(--z-base\) \+ 1\)/);
  });

  it("keeps the crt reading card free of a text glow", () => {
    // 読む面の text-shadow は preview.css が外す契約。テーマ側で戻さない。
    expect(crt).not.toMatch(
      /:root\[data-theme="crt"\] \.v3-shell \.preview-pane-preview[\s\S]{0,240}text-shadow/s,
    );
  });

});
