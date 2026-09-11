/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const crt = readFileSync(`${process.cwd()}/src/styles/crt-theme.css`, "utf8");
const shinkai = readFileSync(
  `${process.cwd()}/src/styles/shinkai-theme.css`,
  "utf8",
);

/**
 * 実機指摘⑦（お遊びテーマの演出が本文だけ）の判断:
 * 「演出はサイドバーとタブまで／ステータスと主要操作ボタンは除外」。
 *
 * 本文（CodeMirror / preview）と同じ語彙を、タブとサイドバーの文字に**薄く**載せる。
 * 状態表示（ステータスバー）と主要操作（保存・Local Assist 等）は、読み違えると
 * 操作を誤る面なので据え置く。
 */
describe("joke theme effect reach", () => {
  const effectTargets = [
    ".tab-name",
    ".tab-parent",
    ".empty-tabs",
    ".tree-name",
    ".workspace-kicker",
    ".workspace-title",
    ".workspace-labels",
  ];
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
  ])("%s carries the effect onto tabs and the sidebar", (theme, css) => {
    for (const target of effectTargets) {
      expect(css, `${theme} ${target}`).toContain(target);
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

  it("keeps the tab and sidebar treatment weaker than the body", () => {
    // 色収差: 本文 1.6px / 0.55・0.5 → タブ・サイドバー 0.9px / 0.3・0.28
    expect(crt).toContain("calc((var(--crt-mx) - 0.5) * 1.6px)");
    expect(crt).toContain("calc((var(--crt-mx) - 0.5) * 0.9px)");
    expect(crt).toContain("rgba(255, 40, 40, 0.3)");
    // グロー: 本文 6px / 0.16 → タブ・サイドバー 5px / 0.1
    expect(shinkai).toContain("text-shadow: 0 0 6px rgba(125, 211, 224, 0.16);");
    expect(shinkai).toContain("text-shadow: 0 0 5px rgba(125, 211, 224, 0.1);");
  });
});
