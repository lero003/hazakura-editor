/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewCss = readFileSync(
  `${process.cwd()}/src/styles/preview.css`,
  "utf8",
);

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
  ] as const)("%s uses a stable opaque reading surface", (theme, surface) => {
    const selector = `:root[data-theme="${theme}"] .preview-pane-preview`;
    expect(tokenValue(selector, "--preview-reading-surface")).toBe(surface);
  });
});
