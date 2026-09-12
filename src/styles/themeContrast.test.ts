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

// chrome バー（ツールバー・タブ・ステータス）の面トークンの配線を見る。
const workspaceChromeCss = readFileSync(
  `${process.cwd()}/src/styles/workspace-chrome.css`,
  "utf8",
);

const themeNames = [
  "light",
  "dark",
  "yakou",
  "shokou",
  "edohigan",
  "crt",
  "shinkai",
] as const;

function selectorForTheme(theme: string): string {
  return theme === "light" ? ":root" : `:root[data-theme="${theme}"]`;
}

/** テーマCSSからトークンの宣言値を読む（テスト内に色を書き写さない）。 */
function themeToken(theme: string, token: string): string {
  return tokenDeclarationIn(themeCss, selectorForTheme(theme), token).replace(
    `${token}: `,
    "",
  );
}

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
  edohigan: { background: "#975b68", foreground: "#ffffff" },
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

function hexToChannels(hex: string): string {
  return [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
    .join(", ");
}

/**
 * 紙トークンを不透明な色に解決する（半透明なら地色と合成＝実描画の見え方に近い）。
 * お遊びテーマは演出を透かすために紙が rgba なので、色の検査はこの解決を通す。
 */
function resolvedPaper(theme: string): string {
  const selector = theme === "light" ? ":root" : `:root[data-theme="${theme}"]`;
  const declaration = tokenDeclarationIn(themeCss, selector, "--surface-paper").replace(
    "--surface-paper: ",
    "",
  );
  const rgba = declaration.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!rgba) {
    return declaration;
  }
  const hex = `#${[1, 2, 3]
    .map((index) => Number(rgba[index]).toString(16).padStart(2, "0"))
    .join("")}`;
  const background = tokenDeclarationIn(themeCss, selector, "--bg").replace("--bg: ", "");
  return /^#[0-9a-fA-F]{6}$/.test(background)
    ? blendOver(hex, background, Number(rgba[4]))
    : hex;
}

/** 半透明の面（top, alpha）を下地（bottom）に重ねた結果の色。 */
function blendOver(top: string, bottom: string, alpha: number): string {
  const channel = (offset: number) =>
    Math.round(
      Number.parseInt(top.slice(offset, offset + 2), 16) * alpha +
        Number.parseInt(bottom.slice(offset, offset + 2), 16) * (1 - alpha),
    );
  return `#${[1, 3, 5]
    .map((offset) => channel(offset).toString(16).padStart(2, "0"))
    .join("")}`;
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

  /**
   * 実機要望（第10報）: お遊びテーマの演出が紙を通して見えるように、読み書きの面を
   * **少しだけ**透かす（従来は「不透明な紙」を固定していた）。読めなくならないよう、
   * 背景（テーマの --bg）と合成した最悪ケースでも本文のコントラストを AA 以上に保つ。
   */
  it.each([
    ["edohigan", "#fffcf8", 0.93],
    ["crt", "#0d1a11", 0.9],
    ["shinkai", "#14384a", 0.9],
  ] as const)(
    "%s lets the theme show through the paper while keeping the text readable",
    (theme, paper, alpha) => {
      expect(
        tokenDeclarationIn(themeCss, `:root[data-theme="${theme}"]`, "--surface-paper"),
      ).toBe(`--surface-paper: rgba(${hexToChannels(paper)}, ${alpha})`);
      expect(
        tokenDeclarationIn(previewCss, `:root[data-theme="${theme}"] .preview-pane-preview`, "--preview-reading-surface"),
      ).toBe("--preview-reading-surface: var(--surface-paper)");

      // 透かした紙をテーマの地色と合成した色＝紙の下から演出が見える分だけ地色が混ざる。
      const composited = blendOver(paper, themeToken(theme, "--bg"), alpha);
      expect(
        contrastRatio(composited, themeToken(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
      // 透かしすぎない（読む面として成立する下限）。
      expect(alpha).toBeGreaterThanOrEqual(0.88);
    },
  );
});

describe("paper token", () => {
  const paper = {
    light: "#fffefb",
    dark: "#1d2a23",
    yakou: "#1c1d31",
    shokou: "#f5f8fc",
    edohigan: "#fffcf8",
    crt: "#0d1a11",
    shinkai: "#14384a",
  } as const;

  // ナビ面が半透明のテーマは背景シェーダーを透かすため、合成後の色は実描画でしか測れない。
  // この2テーマは tests ではなく、資料の実描画ピクセル測定で確認する。
  const translucentNav = new Set(["shinkai"]);

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
      // お遊びテーマは演出を透かすために rgba（同じ色・alpha 0.88 以上）。
      const declaration = tokenHex(theme, "--surface-paper");
      expect(
        declaration === paper[theme] ||
          declaration.startsWith(`rgba(${hexToChannels(paper[theme])},`),
      ).toBe(true);
      if (declaration.startsWith("rgba(")) {
        expect(Number(declaration.match(/,\s*([\d.]+)\)$/)?.[1] ?? "0")).toBeGreaterThanOrEqual(0.88);
      }
      expect(tokenDeclarationIn(themeCss, selectorFor(theme), "--nav-surface")).not.toBe("");
    },
  );

  it.each(themes)(
    "%s keeps body and muted text readable on the paper",
    (theme) => {
      expect(
        contrastRatio(resolvedPaper(theme), tokenHex(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(resolvedPaper(theme), tokenHex(theme, "--text-muted")),
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

describe("border hierarchy", () => {
  // --border = 通常の区切り（輪郭を少し立てる）、--border-strong = 入力欄・重要な輪郭。
  // 2段階の差が潰れないことを見る。単なるペイン間の1px線は3:1を目標にしない（C08の3:1は
  // focus と重要な輪郭の話で、全罫線を濃くすると静かな紙面が壊れる）。
  it.each(themeNames)("%s keeps the two border steps distinct", (theme) => {
    const paper = resolvedPaper(theme);
    const border = themeToken(theme, "--border");
    const strong = themeToken(theme, "--border-strong");
    expect(border).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(strong).toMatch(/^#[0-9a-fA-F]{6}$/);

    const onPaper = contrastRatio(paper, border);
    expect(onPaper).toBeGreaterThanOrEqual(1.45);
    expect(onPaper).toBeLessThanOrEqual(1.7);

    const strongOnPaper = contrastRatio(paper, strong);
    expect(strongOnPaper).toBeGreaterThanOrEqual(2.1);
    expect(strongOnPaper - onPaper).toBeGreaterThanOrEqual(0.4);
  });

  it.each(themeNames)("%s keeps the border visible on the surfaces it separates", (theme) => {
    const border = themeToken(theme, "--border");
    expect(contrastRatio(themeToken(theme, "--chrome-surface"), border)).toBeGreaterThanOrEqual(1.4);
    const nav = themeToken(theme, "--nav-surface");
    // 半透明のナビ面は合成後でしか測れないので実描画の経路（下のテスト）に任せる。
    if (nav.startsWith("#")) {
      expect(contrastRatio(nav, border)).toBeGreaterThanOrEqual(1.3);
    }
  });

  it.each(themeNames)("%s keeps the strong border clear of its surface", (theme) => {
    const surface = themeToken(theme, "--surface");
    const strong = themeToken(theme, "--border-strong");
    // edohigan / shinkai の surface は半透明。
    if (surface.startsWith("#")) {
      expect(contrastRatio(surface, strong)).toBeGreaterThanOrEqual(1.9);
    }
  });

  it.each(themeNames)("%s keeps the focus ring above 3:1", (theme) => {
    // 実際のリングは `outline: 2px solid var(--focus-ring)`。薄めた色ではなく
    // その実値が、載り得る面すべてで 3:1 以上であることを見る。
    // トークンの定義は :root の単一ソース（各テーマは accent を差し替える）。
    const ring = tokenDeclarationIn(themeCss, ":root", "--focus-ring").replace(
      "--focus-ring: ",
      "",
    );
    expect(ring).toBe("var(--accent)");
    const ringColor = themeToken(theme, "--accent");
    expect(ringColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    for (const token of ["--surface-paper", "--nav-surface", "--chrome-surface"]) {
      const surface = themeToken(theme, token);
      if (!surface.startsWith("#")) continue;
      expect(
        contrastRatio(surface, ringColor),
        `${theme} ${token}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("native window background", () => {
  // 透明タイトルバーの色は theme-palette.json（Rust が include_str! で共有）が
  // chrome 面と同色であることを契約にする。CSS だけ変えて JSON を忘れる事故を防ぐ。
  const palette = JSON.parse(
    readFileSync(`${process.cwd()}/src/lib/theme-palette.json`, "utf8"),
  ) as Record<string, string>;

  it.each(themeNames)("%s keeps the native palette on the chrome surface", (theme) => {
    expect(palette[theme]).toBe(themeToken(theme, "--chrome-surface"));
  });
});

describe("solid accent control contrast", () => {
  // accent 面に載る文字は --accent-contrast。CSSから実値を読む。
  it.each(themeNames)("%s keeps text on the accent surface readable", (theme) => {
    const ink = themeToken(theme, "--accent-contrast");
    expect(ink).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(
      contrastRatio(themeToken(theme, "--accent"), ink),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("chrome surface", () => {
  const chrome = {
    light: "#f7f8f5",
    dark: "#18241e",
    yakou: "#12102a",
    shokou: "#eef5fb",
    edohigan: "#fbf4f2",
    shinkai: "#0a2a38",
    crt: "#040a06",
  } as const;

  it.each(themeNames)("%s defines one opaque chrome surface", (theme) => {
    expect(themeToken(theme, "--chrome-surface")).toBe(chrome[theme]);
  });

  it.each(themeNames)("%s keeps chrome text readable", (theme) => {
    const surface = themeToken(theme, "--chrome-surface");
    expect(contrastRatio(surface, themeToken(theme, "--text"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(surface, themeToken(theme, "--text-muted"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps chrome bars on the chrome token and the sidebar on the nav token", () => {
    expect(workspaceChromeCss).toContain("--workspace-chrome-bar: var(--chrome-surface)");
    const barUses = workspaceChromeCss.match(/background:\s*var\(--workspace-chrome-bar\)/g) ?? [];
    const navUses = workspaceChromeCss.match(/background:\s*var\(--workspace-chrome-surface\)/g) ?? [];
    // ツールバー・タブ・ステータスの3箇所が chrome、サイドバーの1箇所が nav。
    expect(barUses).toHaveLength(3);
    expect(navUses).toHaveLength(1);
  });
});
