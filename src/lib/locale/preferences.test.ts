import { describe, expect, it } from "vitest";
import { getPreferencesCopy } from "./preferences";
import type { ThemePreference } from "../../types";

// v0.15 theme select polish (v1.6 で江戸彼岸をジョークテーマへ格上げ)。
//
// The Preferences dialog exposes seven theme options
// (light / dark / edohigan / yakou / shokou / crt / shinkai).
// edohigan・crt・shinkai は演出優先のジョークテーマ。
// yakou・shokou は季節アンビエントテーマ。
// The `themeHint` copy function supplies a short per-theme description
// that the Preferences dialog surfaces through each option's `title`
// tooltip.
//
// The tests below pin:
//   - `themeHint` is defined for every language,
//   - every theme id has a non-empty, distinct description in
//     each language,
//   - the English copy never accidentally bleeds into the
//     Japanese / kana descriptions,
//   - the kana descriptions still use hiragana-fumi style.

const ALL_THEMES: ReadonlyArray<ThemePreference> = [
  "light",
  "dark",
  "edohigan",
  "yakou",
  "shokou",
  "crt",
  "shinkai",
];

describe("getPreferencesCopy.themeHint", () => {
  for (const lang of ["en", "ja", "kana"] as const) {
    describe(`${lang}`, () => {
      const copy = getPreferencesCopy(lang);

      it("returns a non-empty description for every theme id", () => {
        for (const theme of ALL_THEMES) {
          const hint = copy.themeHint(theme);
          expect(hint, `theme ${theme} for ${lang}`).toMatch(/\S/);
        }
      });

      it("returns distinct descriptions for every theme id", () => {
        const hints = ALL_THEMES.map((theme) => copy.themeHint(theme));
        expect(new Set(hints).size).toBe(ALL_THEMES.length);
      });

      it("marks the base themes (light, dark) as base, not seasonal", () => {
        const lightHint = copy.themeHint("light").toLowerCase();
        const darkHint = copy.themeHint("dark").toLowerCase();
        if (lang === "en") {
          expect(lightHint).toMatch(/base|daytime|print/);
          expect(darkHint).toMatch(/base|night|low-light/);
        } else if (lang === "ja") {
          expect(lightHint).toMatch(/基本/);
          expect(darkHint).toMatch(/基本/);
        } else {
          expect(lightHint).toMatch(/きほん/);
          expect(darkHint).toMatch(/きほん/);
        }
      });

      it("marks the seasonal themes (yakou, shokou) as seasonal", () => {
        const seasonalHints = [
          copy.themeHint("yakou"),
          copy.themeHint("shokou"),
        ];
        for (const hint of seasonalHints) {
          const lower = hint.toLowerCase();
          if (lang === "en") {
            expect(lower).toMatch(/seasonal/);
          } else if (lang === "ja") {
            expect(hint).toMatch(/アンビエント|テーマ/);
          } else {
            expect(hint).toMatch(/きせつ|いろあひ/);
          }
        }
      });
    });
  }

  it("keeps the three language hints distinct (no en bleed-through)", () => {
    const en = getPreferencesCopy("en");
    const ja = getPreferencesCopy("ja");
    const kana = getPreferencesCopy("kana");
    for (const theme of ALL_THEMES) {
      const enHint = en.themeHint(theme);
      const jaHint = ja.themeHint(theme);
      const kanaHint = kana.themeHint(theme);
      expect(jaHint, `ja hint for ${theme}`).not.toBe(enHint);
      expect(kanaHint, `kana hint for ${theme}`).not.toBe(enHint);
    }
  });

  it("keeps kana theme hints free of the known split-word corruption", () => {
    const kana = getPreferencesCopy("kana");
    for (const theme of ["edohigan", "crt", "shinkai"] as const) {
      expect(kana.themeHint(theme)).toContain("じょうだんてーまです。");
      expect(kana.themeHint(theme)).not.toContain("じょうけ ん て ま す");
    }
    expect(kana.themeHint("shokou")).toContain("おもわせる");
  });
});
