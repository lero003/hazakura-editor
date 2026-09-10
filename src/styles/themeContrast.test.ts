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
    light: { surface: "#fffefb", text: "#1a1f1d" },
    dark: { surface: "#1d2a23", text: "#e8ede5" },
    yakou: { surface: "#1c1d31", text: "#e8e8f4" },
    shokou: { surface: "#f5f8fc", text: "#1c3554" },
    edohigan: { surface: "#342230", text: "#f2e4e8" },
    crt: { surface: "#0d1a11", text: "#9be0a4" },
    shinkai: { surface: "#14384a", text: "#d4ecf2" },
  } as const;

  it.each(Object.entries(paper))(
    "%s defines one paper token in the theme",
    (theme, expected) => {
      const selector = theme === "light" ? ":root" : `:root[data-theme="${theme}"]`;
      expect(tokenDeclarationIn(themeCss, selector, "--surface-paper")).toBe(
        `--surface-paper: ${expected.surface}`,
      );
      expect(tokenDeclarationIn(themeCss, selector, "--nav-surface")).not.toBe("");
    },
  );

  it.each(Object.entries(paper))(
    "%s keeps body text readable on the paper",
    (_theme, expected) => {
      expect(
        contrastRatio(expected.surface, expected.text),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(Object.entries(paper))(
    "%s keeps muted text readable on the paper",
    (theme, expected) => {
      const selector = theme === "light" ? ":root" : `:root[data-theme="${theme}"]`;
      const muted = tokenDeclarationIn(themeCss, selector, "--text-muted").replace(
        "--text-muted: ",
        "",
      );
      expect(muted).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(contrastRatio(expected.surface, muted)).toBeGreaterThanOrEqual(4.5);
    },
  );

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
