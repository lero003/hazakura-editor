/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewCss = readFileSync(
  `${process.cwd()}/src/styles/preview.css`,
  "utf8",
);

// 紙面トークンはテーマ側が唯一の定義元。preview は var(--surface-paper) を参照するだけ。
const themeCss = [
  "tokens.css",
  "themes.css",
  "edohigan-theme.css",
  "shinkai-theme.css",
  "crt-theme.css",
]
  .map((file) => readFileSync(`${process.cwd()}/src/styles/${file}`, "utf8"))
  .join("\n");

function ruleBodyIn(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    css.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"))?.groups
      ?.body ?? ""
  );
}

function tokenDeclarationIn(css: string, selector: string, token: string): string {
  return (
    ruleBodyIn(css, selector).match(
      new RegExp(
        `${token}:\\s*(?:var\\(--[a-z-]+\\)|#[0-9a-fA-F]{6}|rgba?\\([^)]*\\))`,
      ),
    )?.[0] ?? ""
  );
}

const selectionPalette = {
  light: { background: "#2e6b4f", foreground: "#ffffff" },
  dark: { background: "#87cba8", foreground: "#0e1311" },
  yakou: { background: "#a090ff", foreground: "#0a0a14" },
  shokou: { background: "#3478ad", foreground: "#ffffff" },
  edohigan: { background: "#e8a0b0", foreground: "#2a1824" },
  crt: { background: "#5fe06a", foreground: "#040a06" },
  shinkai: { background: "#7dd3e0", foreground: "#0a2430" },
} as const;

function ruleBody(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    previewCss.match(
      new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, "s"),
    )?.groups?.body ?? ""
  );
}

function tokenValue(selector: string, token: string): string {
  const body = ruleBody(selector);
  return body.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, "i"))?.[1] ?? "";
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(background: string, foreground: string): number {
  const backgroundLuminance = relativeLuminance(background);
  const foregroundLuminance = relativeLuminance(foreground);
  return (
    (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
    (Math.min(backgroundLuminance, foregroundLuminance) + 0.05)
  );
}

describe("Preview theme contrast", () => {
  it.each(Object.entries(selectionPalette))(
    "%s keeps selected Preview text at WCAG AA contrast",
    (theme, palette) => {
      const selector =
        theme === "light"
          ? ".preview-pane-preview"
          : `:root[data-theme="${theme}"] .preview-pane-preview`;

      expect(tokenValue(selector, "--preview-selection-bg")).toBe(
        palette.background,
      );
      expect(tokenValue(selector, "--preview-selection-fg")).toBe(
        palette.foreground,
      );
      expect(
        contrastRatio(palette.background, palette.foreground),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    ["edohigan", "#342230"],
    ["crt", "#0d1a11"],
    ["shinkai", "#14384a"],
  ] as const)("%s keeps an opaque paper for reading", (theme, surface) => {
    expect(
      tokenDeclarationIn(themeCss, `:root[data-theme="${theme}"]`, "--surface-paper"),
    ).toBe(`--surface-paper: ${surface}`);
    expect(
      tokenDeclarationIn(previewCss, `:root[data-theme="${theme}"] .preview-pane-preview`, "--preview-reading-surface"),
    ).toBe("--preview-reading-surface: var(--surface-paper)");
  });
});

describe("paper token", () => {
  const paper = {
    light: "#fffefb",
    dark: "#1d2a23",
    yakou: "#1c1d31",
    shokou: "#f5f8fc",
    edohigan: "#342230",
    crt: "#0d1a11",
    shinkai: "#14384a",
  } as const;

  // ナビ面が半透明のテーマは背景シェーダーを透かすため、合成後の色は実描画でしか測れない。
  // この2テーマは tests ではなく、資料の実描画ピクセル測定で確認する。
  const translucentNav = new Set(["edohigan", "shinkai"]);

  const selectorFor = (theme: string) =>
    theme === "light" ? ":root" : `:root[data-theme="${theme}"]`;

  const themes = Object.keys(paper) as (keyof typeof paper)[];
  const opaqueThemes = themes.filter((theme) => !translucentNav.has(theme));

  /** CSSから実際の宣言値を読む（テスト内に色を書き写さない）。 */
  const tokenHex = (theme: string, token: string) =>
    tokenDeclarationIn(themeCss, selectorFor(theme), token).replace(`${token}: `, "");

  it.each(themes)(
    "%s defines one paper token in the theme",
    (theme) => {
      expect(tokenHex(theme, "--surface-paper")).toBe(paper[theme]);
      expect(tokenDeclarationIn(themeCss, selectorFor(theme), "--nav-surface")).not.toBe("");
    },
  );

  it.each(themes)(
    "%s keeps body and muted text readable on the paper",
    (theme) => {
      expect(
        contrastRatio(paper[theme], tokenHex(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(paper[theme], tokenHex(theme, "--text-muted")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(opaqueThemes)(
    "%s keeps text readable on the opaque nav surface",
    (theme) => {
      const nav = tokenHex(theme, "--nav-surface");
      expect(nav).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(contrastRatio(nav, tokenHex(theme, "--text"))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(nav, tokenHex(theme, "--text-muted"))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps the translucent nav themes on the rendered-measurement path", () => {
    for (const theme of translucentNav) {
      expect(tokenHex(theme, "--nav-surface")).toMatch(/^rgba\(/);
    }
  });

  it("keeps the editor surface on the paper token for every theme", () => {
    for (const theme of ["light", "dark", "yakou", "shokou", "edohigan", "crt", "shinkai"]) {
      const selector = theme === "light" ? ":root" : `:root[data-theme="${theme}"]`;
      expect(tokenDeclarationIn(themeCss, selector, "--cm-bg")).toBe(
        "--cm-bg: var(--surface-paper)",
      );
    }
  });
});

describe("solid accent control contrast", () => {
  it("keeps light-theme accent buttons on a dark green with white-adjacent text", () => {
    expect(
      contrastRatio("#2e6b4f", "#ffffff"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark-theme sage accent readable against the dark surface", () => {
    expect(
      contrastRatio("#87cba8", "#141a17"),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps CRT phosphor accent readable against the CRT surface", () => {
    expect(
      contrastRatio("#5fe06a", "#08120c"),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
