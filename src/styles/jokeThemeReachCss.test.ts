/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const crt = readFileSync(`${process.cwd()}/src/styles/crt-theme.css`, "utf8");
const edohigan = readFileSync(
  `${process.cwd()}/src/styles/edohigan-theme.css`,
  "utf8",
);
const shinkai = readFileSync(
  `${process.cwd()}/src/styles/shinkai-theme.css`,
  "utf8",
);

/**
 * 実機フィードバック（第2弾）の判断:
 * 「タブは演出が過剰」（タブは小さく常に目に入る面）→ タブからは演出を引く。
 * サイドバーの文字には本文より弱い語彙で載せ、状態表示（ステータスバー）と
 * 主要操作（保存・Local Assist 等）は、読み違えると操作を誤る面なので据え置く。
 */
describe("joke theme effect reach", () => {
  const effectTargets = [
    ".tree-name",
    ".workspace-kicker",
    ".workspace-title",
    ".workspace-labels",
  ];
  // タブは対象から外す（第2弾）。うっかり戻さないよう逆側も固定する。
  const tabTargets = [".tab-name", ".tab-parent", ".empty-tabs"];
  const excludedTargets = [
    ".status-bar",
    ".workspace-sidebar-rail",
    ".app-primary-toolbar",
    ".pane-toggle",
    ".primary-save",
    ".workspace-new-button",
    ".workspace-open-button",
    ".workspace-trash-button",
    ".workspace-collapse-button",
    ".workspace-restore-button",
  ];

  /** `text-shadow: none` を当てている規則のセレクタ部分を取り出す。 */
  const exclusionSelectors = (css: string) => {
    const rules = css.match(/[^}]*{[^}]*text-shadow:\s*none[^}]*}/g) ?? [];
    return rules.filter((rule) => rule.includes(".status-bar"));
  };

  it.each([
    ["crt", crt],
    ["shinkai", shinkai],
  ])("%s carries the effect onto the sidebar text", (theme, css) => {
    for (const target of effectTargets) {
      expect(css, `${theme} ${target}`).toContain(target);
    }
  });

  it.each([
    ["crt", crt],
    ["shinkai", shinkai],
  ])("%s keeps the file tabs out of it", (theme, css) => {
    const effectRules = css.match(/[^}]*\{[^}]*text-shadow:\s*\n?[^}]*rgba\([^}]*}/g) ?? [];
    for (const target of tabTargets) {
      expect(
        effectRules.some((rule) => rule.includes(target)),
        `${theme} ${target} should not carry the effect`,
      ).toBe(false);
    }
  });

  it.each([
    ["crt", crt],
    ["shinkai", shinkai],
  ])("%s keeps the status bar and primary actions free of it", (theme, css) => {
    const rules = exclusionSelectors(css);
    expect(rules.length, `${theme} exclusion rules`).toBeGreaterThan(0);
    for (const target of excludedTargets) {
      expect(
        rules.some((rule) => rule.includes(target)),
        `${theme} ${target}`,
      ).toBe(true);
    }
  });

  it("keeps edohigan decoration away from interaction and central writing", () => {
    const ambient = edohigan.match(/\.edohigan-ambient\s*{([^}]*)}/s)?.[1];
    expect(ambient).toMatch(/pointer-events:\s*none/);
    expect(ambient).toMatch(/z-index:\s*calc\(var\(--z-base\) \+ 1\)/);
    expect(ambient).not.toContain("mix-blend-mode");
    const petals = edohigan.match(/\.edohigan-petals\s*{([^}]*)}/s)?.[1];
    expect(petals).toContain("transparent 32%, transparent 68%");
    // 合成指定はコントラスト比の保証ではない。前後の実画面も記録する。
    expect(edohigan).not.toContain(".edohigan-canvas");
  });

  it("stops edohigan motion for OS reduced motion and background windows", () => {
    const reduced = edohigan.split("@media (prefers-reduced-motion: reduce)")[1];
    expect(reduced).toMatch(/\.edohigan-branch\s*{\s*animation:\s*none/);
    expect(reduced).toMatch(/\.edohigan-petals\s*{\s*display:\s*none/);
    expect(edohigan).toContain('[data-paused="true"]');
    expect(edohigan).toContain("animation-play-state: paused");
  });

  it("keeps the sidebar treatment weaker than the body", () => {
    // 色収差: 本文 1.6px / 0.55・0.5 → タブ・サイドバー 0.9px / 0.3・0.28
    expect(crt).toContain("calc((var(--crt-mx) - 0.5) * 1.6px)");
    expect(crt).toContain("calc((var(--crt-mx) - 0.5) * 0.9px)");
    expect(crt).toContain("rgba(255, 40, 40, 0.3)");
    // グロー: 本文 6px / 0.16 → タブ・サイドバー 5px / 0.1
    expect(shinkai).toContain("text-shadow: 0 0 6px rgba(125, 211, 224, 0.16);");
    expect(shinkai).toContain("text-shadow: 0 0 5px rgba(125, 211, 224, 0.1);");
  });
});
