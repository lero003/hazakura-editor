import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ruleBody } from "../test-support/css";
import { readGrayscalePngInfo } from "../test-support/png";
import { readProjectFile } from "../test-support/source";

const tokens = readProjectFile("src/styles/tokens.css");
const themes = readProjectFile("src/styles/themes.css");
const edohigan = readProjectFile("src/styles/edohigan-theme.css");
const shinkai = readProjectFile("src/styles/shinkai-theme.css");
const crt = readProjectFile("src/styles/crt-theme.css");
const material = readProjectFile("src/styles/material.css");
const a11y = readProjectFile("src/styles/a11y.css");
const index = readProjectFile("src/styles/index.css");

const GRAIN_PATH = "src/assets/themes/paper-grain.png";

const themeSources = [
  { theme: "light", css: tokens, selector: ":root" },
  { theme: "dark", css: themes, selector: ':root[data-theme="dark"]' },
  { theme: "yakou", css: themes, selector: ':root[data-theme="yakou"]' },
  { theme: "shokou", css: themes, selector: ':root[data-theme="shokou"]' },
  {
    theme: "edohigan",
    css: edohigan,
    selector: ':root[data-theme="edohigan"]',
  },
  {
    theme: "shinkai",
    css: shinkai,
    selector: ':root[data-theme="shinkai"]',
  },
  { theme: "crt", css: crt, selector: ':root[data-theme="crt"]' },
] as const;

describe("light model tokens", () => {
  it.each(themeSources)(
    "$theme defines both edge tokens",
    ({ css, selector }) => {
      const block = ruleBody(css, selector);
      expect(block).toMatch(/--edge-hi:\s*rgba?\(/);
      expect(block).toMatch(/--edge-lo:\s*rgba?\(/);
    },
  );

  it.each(themeSources)(
    "$theme composes the edge light into every shadow step",
    ({ css, selector }) => {
      const block = ruleBody(css, selector);
      for (const step of ["sm", "md", "lg"]) {
        const declaration =
          block.match(new RegExp(`--shadow-${step}:\\s*([^;]+);`))?.[1] ?? "";
        expect(declaration, `--shadow-${step}`).toContain(
          "inset 0 1px 0 var(--edge-hi)",
        );
        expect(declaration, `--shadow-${step}`).toContain(
          "inset 0 -1px 0 var(--edge-lo)",
        );
      }
    },
  );

  it("keeps the accent shadow free of inset edges", () => {
    // --shadow-accent は色付きのグローで、面の内側の反射とは役割が違う。
    expect(ruleBody(tokens, ":root")).toMatch(
      /--shadow-accent:\s*0 4px 16px/,
    );
  });
});

describe("paper grain", () => {
  it("declares the bundled texture once on the root", () => {
    const root = ruleBody(tokens, ":root");
    expect(root).toContain(
      '--paper-texture: url("../assets/themes/paper-grain.png")',
    );
    expect(root).toMatch(/--paper-texture-size:\s*\d+px \d+px;/);
    expect(existsSync(`${process.cwd()}/${GRAIN_PATH}`)).toBe(true);
  });

  it("applies the texture to the reading surfaces only", () => {
    // 紙面（エディタ / プレビュー / 読書面）は背景を乗算で暗くする。
    // ナビ面・chrome・ダイアログには乗せない（操作面は素材より明瞭さを優先）。
    expect(material).toMatch(/\.cm-editor,\s*\n\.markdown-preview\s*{/);
    const rule = ruleBody(material, ".cm-editor,\n.markdown-preview".trim());
    expect(rule).toContain("background-image: var(--paper-texture)");
    expect(rule).toContain("background-blend-mode: multiply");
  });

  it("ships only a darkening tile", () => {
    // 乗算タイルが白より明るい画素を持つと紙が明るくなり、
    // 「文字だけ暗い」前提（コントラストが悪化しない）が崩れる。
    const info = readGrayscalePngInfo(GRAIN_PATH);
    expect(info.width).toBe(128);
    expect(info.height).toBe(128);
    expect(info.maxValue).toBeLessThanOrEqual(255);
    expect(info.minValue).toBeGreaterThanOrEqual(240);
    expect(info.minValue).toBeLessThan(255);
  });

  it("is disabled under prefers-contrast: more", () => {
    const contrastBlock = ruleBody(a11y, "@media (prefers-contrast: more)");
    expect(contrastBlock).toContain("--paper-texture: none;");
    expect(contrastBlock).toContain("--edge-hi: transparent;");
    expect(contrastBlock).toContain("--edge-lo: transparent;");
  });

  it("loads after the paper background shorthands", () => {
    const materialAt = index.indexOf('@import "./material.css"');
    expect(materialAt).toBeGreaterThan(index.indexOf('@import "./preview.css"'));
    expect(materialAt).toBeGreaterThan(
      index.indexOf('@import "./workspace-paper.css"'),
    );
  });
});
