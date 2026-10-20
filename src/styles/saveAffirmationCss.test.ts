import { describe, expect, it } from "vitest";
import { ruleBody, stripCssComments } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const css = stripCssComments(
  readProjectFile("src/styles/save-affirmation.css"),
);

const THEMES = ["edohigan", "yakou", "shokou", "shinkai", "crt"] as const;

function themeRule(theme: string, selector = ".save-affirmation"): string {
  return ruleBody(css, `:root[data-theme="${theme}"] ${selector}`);
}

describe("save affirmation material response", () => {
  it("keeps the quiet default for light and dark", () => {
    // 日常のテーマは演出を足さない。
    expect(css).not.toContain(':root[data-theme="light"] .save-affirmation');
    expect(css).not.toContain(':root[data-theme="dark"] .save-affirmation');
    expect(ruleBody(css, ".save-affirmation")).toContain("saveAffirmationPop");
  });

  it.each(THEMES)("%s replaces the pop with its own material", (theme) => {
    const rule = themeRule(theme);
    expect(rule).toContain("animation:");
    // 既定の pop を残したまま重ねない（2 つの動きが競合しない）。
    expect(rule).not.toContain("saveAffirmationPop");
    expect(rule).toContain("saveAffirmationFade 1.4s");
  });

  it("keeps every theme response under 0.4 seconds", () => {
    for (const theme of THEMES) {
      const match = themeRule(theme).match(/animation:\s*(\S+)\s+([\d.]+)s/);
      expect(match, theme).not.toBeNull();
      expect(Number(match?.[2]), theme).toBeLessThanOrEqual(0.4);
      expect(Number(match?.[2]), theme).toBeGreaterThan(0);
    }
  });

  it("does not move the layout", () => {
    const base = ruleBody(css, ".save-affirmation");
    expect(base).toContain("width: 16px");
    expect(base).toContain("height: 16px");
    expect(base).toContain("position: relative");
    for (const theme of THEMES) {
      const rule = themeRule(theme);
      expect(rule, theme).not.toMatch(/(^|[\s;{])width\s*:/);
      expect(rule, theme).not.toMatch(/(^|[\s;{])height\s*:/);
      expect(rule, theme).not.toMatch(/(^|[\s;{])margin/);
    }
  });

  it("only shinkai and crt add a ring or bar", () => {
    expect(themeRule("shinkai", ".save-affirmation::after")).toContain(
      "saveAffirmationRing",
    );
    expect(themeRule("crt", ".save-affirmation::after")).toContain(
      "saveAffirmationSyncBar",
    );
    for (const theme of ["edohigan", "yakou", "shokou"] as const) {
      expect(themeRule(theme, ".save-affirmation::after"), theme).toBe("");
    }
    // 疑似要素は操作を妨げない。
    expect(themeRule("shinkai", ".save-affirmation::after")).toContain(
      "pointer-events: none",
    );
    expect(themeRule("crt", ".save-affirmation::after")).toContain(
      "pointer-events: none",
    );
  });

  it("still stops everything under prefers-reduced-motion", () => {
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion"));
    expect(reduce).toContain(".save-affirmation,");
    expect(reduce).toContain(".save-affirmation::after");
    expect(reduce).toContain("animation: none");
  });

  it.each(["light", "dark", ...THEMES])(
    "%s keeps a visible static save confirmation under reduced motion",
    (theme) => {
      // jsdom does not evaluate media preferences. Activate the final reduce
      // block explicitly, then let its CSS cascade resolve the theme selectors.
      // A text-only check missed theme rules overriding `animation: none`.
      const style = document.createElement("style");
      style.textContent = css.replace(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{([\s\S]*)}\s*$/,
        "$1",
      // jsdom incorrectly drops a selector group containing ::after when
      // computing the originating element. Test its ordinary selector alone.
      ).replace(/,\s*\.save-affirmation::after/g, "");
      const confirmation = document.createElement("span");
      confirmation.className = "save-affirmation";
      confirmation.textContent = "✓";
      const previousTheme = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = theme;
      document.head.append(style);
      document.body.append(confirmation);
      try {
        const computed = getComputedStyle(confirmation);
        expect(computed.animation).toBe("none");
        expect(computed.opacity).toBe("0.85");
      } finally {
        confirmation.remove();
        style.remove();
        if (previousTheme === undefined) {
          delete document.documentElement.dataset.theme;
        } else {
          document.documentElement.dataset.theme = previousTheme;
        }
      }
    },
  );
});
