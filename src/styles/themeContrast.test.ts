/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readGrayscalePngInfo } from "../test-support/png";
import { readProjectFile } from "../test-support/source";

const previewCss = readProjectFile("src/styles/preview.css");

// 紙面トークンはテーマ側が唯一の定義元。preview/readerは不透明の紙を参照する。
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
const workspaceChromeCss = readProjectFile("src/styles/workspace-chrome.css");

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
  it.each(["a", "code"])("edohigan keeps %s ink readable after the light-theme migration", (tag) => {
    const color = ruleBody(`:root[data-theme="edohigan"] .markdown-preview ${tag}`)
      .match(/color:\s*(#[0-9a-f]{6}|var\(--[a-z-]+\))/i)?.[1] ?? "";
    const ink = color.startsWith("var(")
      ? themeToken("edohigan", color.slice(4, -1))
      : color;
    expect(ink).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrastRatio(resolvedPaper("edohigan"), ink)).toBeGreaterThanOrEqual(4.5);
  });

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
   * 実機要望（第10報）で書き面を少し透かしたが、2026-10-19のオーナー指摘
   * （編集面が明るくコントラストが甘い／読む面は背景色を置いた方がよい）を受けて
   * 役割を分けた:
   *   - 書き面（--surface-paper）: 少しだけ透かす（0.95。補助文字の余裕が最も
   *     小さい深海に合わせた下限）
   *   - 読む面（--preview-reading-surface）: 不透明の紙（--surface-paper-solid）
   * どちらも本文のコントラストを AA 以上に保つ。
   */
  it.each([
    ["edohigan", "#fffcf8", 0.95],
    ["crt", "#0d1a11", 0.95],
    ["shinkai", "#14384a", 0.95],
  ] as const)(
    "%s keeps the writing paper translucent and the reading paper solid",
    (theme, paper, alpha) => {
      expect(
        tokenDeclarationIn(themeCss, `:root[data-theme="${theme}"]`, "--surface-paper"),
      ).toBe(`--surface-paper: rgba(${hexToChannels(paper)}, ${alpha})`);
      expect(
        tokenDeclarationIn(themeCss, `:root[data-theme="${theme}"]`, "--surface-paper-solid"),
      ).toBe(`--surface-paper-solid: ${paper}`);
      expect(
        tokenDeclarationIn(previewCss, `:root[data-theme="${theme}"] .preview-pane-preview`, "--preview-reading-surface"),
      ).toBe("--preview-reading-surface: var(--surface-paper-solid)");

      // 透かした紙をテーマの地色と合成した色＝紙の下から演出が見える分だけ地色が混ざる。
      const composited = blendOver(paper, themeToken(theme, "--bg"), alpha);
      expect(
        contrastRatio(composited, themeToken(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
      // 透かしすぎない（書き面として成立する下限）。
      expect(alpha).toBeGreaterThanOrEqual(0.95);
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
  // shinkai: 背景シェーダーを透かすため元から半透明。
  // yakou: 実機要望（第10報の続き）で bgDrift（背景が微かに色づく演出）を透かすため半透明に。
  const translucentNav = new Set(["shinkai", "yakou"]);

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

  it.each(themes)(
    "%s keeps AA contrast with the paper grain composited",
    (theme) => {
      // material.css は紙面の背景へタイルを乗算する。文字は紙の上に載るため
      // 影響を受けず、紙だけが暗くなる。明色面では比が下がり得るため、最も暗い画素
      // （最大の暗化）を当てた場合の静的パレットを検査する。
      const grain = readGrayscalePngInfo("src/assets/themes/paper-grain.png");
      const factor = grain.minValue / 255;
      const paper = resolvedPaper(theme);
      const shaded = `#${[1, 3, 5]
        .map((offset) =>
          Math.round(
            Number.parseInt(paper.slice(offset, offset + 2), 16) * factor,
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
      expect(
        contrastRatio(shaded, tokenHex(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(shaded, tokenHex(theme, "--text-muted")),
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
    readProjectFile("src/lib/theme-palette.json"),
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

describe("assist window shell surface", () => {
  // 分離窓（Hazakura Local Assist）のフラット面。特殊テーマは app-shell の
  // グラデ / シェーダーを継承しない代わりに、apple-assist-window.css がフラット色を敷く。
  // 面ごとの 4.5:1 契約にこの窓も加える（江戸彼岸の明色化で暗色背景だけが残り、
  // --text が 1.28:1 まで沈む事故が出た。実測 2026-09-12）。
  const assistWindowCss = readProjectFile("src/styles/apple-assist-window.css");

  function assistShellBackground(theme: string): string {
    const override = ruleBodyIn(
      assistWindowCss,
      `:root[data-theme="${theme}"] .apple-assist-window-shell`,
    ).match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1];
    // 上書きを持たないテーマ（light / dark / edohigan）は基の宣言 var(--bg) をそのまま使う。
    return override ?? themeToken(theme, "--bg");
  }

  it.each(themeNames)(
    "%s keeps the assist window text readable on its shell",
    (theme) => {
      const background = assistShellBackground(theme);
      expect(background).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(
        contrastRatio(background, themeToken(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
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
    // 塗る面は演出テーマだけ半透明にできる --chrome-bar-surface を参照する。
    expect(workspaceChromeCss).toContain("--workspace-chrome-bar: var(--chrome-bar-surface)");
    const barUses = workspaceChromeCss.match(/background:\s*var\(--workspace-chrome-bar\)/g) ?? [];
    const navUses = workspaceChromeCss.match(/background:\s*var\(--workspace-chrome-surface\)/g) ?? [];
    // ツールバー・タブ・ステータスの3箇所が chrome、サイドバーの1箇所が nav。
    expect(barUses).toHaveLength(3);
    expect(navUses).toHaveLength(1);
  });
});

describe("theme atmosphere surfaces", () => {
  /**
   * 比較用に仮置きした明るい背景色。実測値やshaderの厳密な上限ではない。
   * 面のalphaを掛けた静的パレットの回帰検査であり、前景の粒子/マスクや
   * color合成を含む画面全体のAA適合を証明しない。
   */
  const brightAmbientSamples: Record<string, string> = {
    light: "#f7f8f5",
    dark: "#25332a",
    yakou: "#3c345f",
    shokou: "#ffe6c4",
    edohigan: "#fbf4f2",
    // 隔離WKWebViewの9描画条件から得たRGB各成分の最大値。厳密なshader上限ではない。
    shinkai: "#b2cdd1",
    crt: "#2e6e40",
  };

  /** 半透明の面を下地の上に置いた結果の色。不透明ならそのまま返す。 */
  function compositeOver(declaration: string, bottomHex: string): string {
    const rgba = declaration.match(
      /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/,
    );
    if (!rgba) {
      return declaration;
    }
    const top = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const alpha = Number(rgba[4]);
    const bottom = [1, 3, 5].map((offset) =>
      Number.parseInt(bottomHex.slice(offset, offset + 2), 16),
    );
    const mixed = top.map((value, index) =>
      Math.round(value * alpha + bottom[index] * (1 - alpha)),
    );
    return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  it.each(themeNames)(
    "%s keeps the static editor palette readable over a bright background sample",
    (theme) => {
      const paper = compositeOver(
        themeToken(theme, "--surface-paper"),
        brightAmbientSamples[theme],
      );
      expect(contrastRatio(paper, themeToken(theme, "--text"))).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(paper, themeToken(theme, "--text-muted")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["edohigan", "shinkai", "crt"] as const)(
    "%s lets the atmosphere through the chrome bar without losing text contrast",
    (theme) => {
      // 演出が左のワークスペースだけに見えないよう、chrome バーでも背景を透かす。
      const bar = themeToken(theme, "--chrome-bar-surface");
      expect(bar).toMatch(/^rgba\(/);
      const alpha = Number(bar.match(/,\s*([\d.]+)\)$/)?.[1] ?? "0");
      expect(alpha).toBeGreaterThanOrEqual(0.85);

      // ネイティブ窓の色契約（--chrome-surface）は不透明のまま。
      expect(themeToken(theme, "--chrome-surface")).toMatch(/^#[0-9a-fA-F]{6}$/);

      const composited = compositeOver(bar, brightAmbientSamples[theme]);
      expect(
        contrastRatio(composited, themeToken(theme, "--text")),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(composited, themeToken(theme, "--text-muted")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps shinkai muted text readable even over a white background", () => {
    // 実shaderの明部で旧mutedが4.35:1まで落ちた。紙の透け方を維持し、
    // 補助文字の静的パレットに白までの余裕を持たせる。
    const ink = themeToken("shinkai", "--text-muted");
    for (const surface of ["--surface-paper", "--chrome-bar-surface"]) {
      expect(
        contrastRatio(compositeOver(themeToken("shinkai", surface), "#ffffff"), ink),
        surface,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the themes without a behind-the-content atmosphere on the opaque chrome", () => {
    // light は :root の既定（= --chrome-surface）。dark/yakou/shokou は
    // そもそも上書きしない（演出が画面の上に乗る、または演出を持たない）。
    expect(themeToken("light", "--chrome-bar-surface")).toBe(
      "var(--chrome-surface)",
    );
    for (const theme of ["dark", "yakou", "shokou"] as const) {
      expect(
        tokenDeclarationIn(themeCss, `:root[data-theme="${theme}"]`, "--chrome-bar-surface"),
        theme,
      ).toBe("");
      expect(themeToken(theme, "--chrome-surface")).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it.each(themeNames)(
    "%s reads the preview and reader on one opaque paper",
    (theme) => {
      const solid = themeToken(theme, "--surface-paper-solid");
      expect(solid).toMatch(/^#[0-9a-fA-F]{6}$/);
      // 不透明の紙は本文・補助文字ともに AA を満たす。
      expect(contrastRatio(solid, themeToken(theme, "--text"))).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(solid, themeToken(theme, "--text-muted")),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("points every preview/reader surface at the opaque paper", () => {
    // 読む面（プレビュー・電子書籍・読書）は演出よりコントラストを優先する。
    expect(previewCss).not.toContain(
      "--preview-reading-surface: var(--surface-paper);",
    );
    expect(
      previewCss.match(
        /--preview-reading-surface: var\(--surface-paper-solid\);/g,
      )?.length,
    ).toBeGreaterThanOrEqual(7);
  });
});
