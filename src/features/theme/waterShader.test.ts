import { describe, expect, it } from "vitest";
import { SHINKAI_BOOT_FRAGMENT_SHADER } from "../../components/app/ShinkaiBootSequence";
import { SHINKAI_FRAGMENT_SHADER } from "../../components/app/ShinkaiShaderOverlay";
import { readProjectFile } from "../../test-support/source";
import {
  DEEP_WATER_COLOR,
  SHALLOW_WATER_COLOR,
  WATER_ABSORPTION,
  WATER_DEPTH_TINT_GLSL,
  WATER_DITHER_GLSL,
  WATER_NOISE_GLSL,
} from "./waterShader";

/**
 * GLSL コンパイラは手元にない（実機の WKWebView でしかコンパイルできない）。
 * そのため、ここでは「コンパイル前に落とせる誤り」だけを構造として固定する。
 * 描画結果そのものは実機確認の対象。
 */
function assertBalanced(source: string, label: string) {
  const open = (source.match(/{/g) ?? []).length;
  const close = (source.match(/}/g) ?? []).length;
  expect(open, `${label}: braces`).toBe(close);
  const openParens = (source.match(/\(/g) ?? []).length;
  const closeParens = (source.match(/\)/g) ?? []).length;
  expect(openParens, `${label}: parentheses`).toBe(closeParens);
}

/** コメント中の語を誤検出しないよう、行コメントを落としてから見る。 */
function stripGlslComments(source: string): string {
  return source.replace(/\/\/[^\n]*/g, "");
}

function declaredUniforms(source: string): string[] {
  return [...source.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map(
    (match) => match[1],
  );
}

describe("water shader chunks", () => {
  it("keeps one definition of the shared noise", () => {
    expect(WATER_NOISE_GLSL.match(/float hash21\(/g)).toHaveLength(1);
    expect(WATER_NOISE_GLSL.match(/float valueNoise\(/g)).toHaveLength(1);
    expect(WATER_DEPTH_TINT_GLSL).toContain("vec3 waterDepthTint(");
    expect(WATER_DEPTH_TINT_GLSL).toContain(WATER_ABSORPTION);
    expect(WATER_DITHER_GLSL).toContain("u_time");
  });

  it("keeps the boot and the overlay on the same shallow/deep colours", () => {
    for (const shader of [SHINKAI_FRAGMENT_SHADER, SHINKAI_BOOT_FRAGMENT_SHADER]) {
      expect(shader).toContain(SHALLOW_WATER_COLOR);
      expect(shader).toContain(DEEP_WATER_COLOR);
      expect(shader).toContain("waterDepthTint(");
    }
  });

  it("no longer keeps private copies of the noise functions", () => {
    // 以前は 2 ファイルに同じ関数を写していた（コメントで同期を促していた）。
    for (const source of [
      readProjectFile("src/components/app/ShinkaiShaderOverlay.tsx"),
      readProjectFile("src/components/app/ShinkaiBootSequence.tsx"),
    ]) {
      expect(source).not.toContain("float hash21(vec2 p) {");
      expect(source).not.toContain("float valueNoise(vec2 p) {");
      expect(source).toContain("waterShader");
    }
  });
});

describe("shinkai fragment shaders", () => {
  it.each([
    ["overlay", SHINKAI_FRAGMENT_SHADER, ["u_time", "u_flowField", "u_intensity"]],
    ["boot", SHINKAI_BOOT_FRAGMENT_SHADER, ["u_progress", "u_intensity"]],
  ] as const)("%s is structurally valid GLSL ES 3", (label, shader, required) => {
    expect(shader.startsWith("#version 300 es")).toBe(true);
    expect(shader).toContain("precision highp float;");
    expect(shader).toContain("void main()");
    assertBalanced(shader, label);
    for (const uniform of required) {
      expect(shader, uniform).toMatch(
        new RegExp(`uniform\\s+\\w+\\s+${uniform}\\s*;`),
      );
    }
  });

  it("only uses u_time where it is declared", () => {
    // ブートは u_time を持たない。共通 chunk のディザをそのまま使うと
    // 未宣言の uniform を参照してコンパイルに失敗する。
    expect(declaredUniforms(SHINKAI_BOOT_FRAGMENT_SHADER)).not.toContain("u_time");
    const bootCode = stripGlslComments(SHINKAI_BOOT_FRAGMENT_SHADER);
    const bootMain = bootCode.slice(bootCode.indexOf("void main()"));
    expect(bootMain).not.toContain("u_time");
    expect(declaredUniforms(SHINKAI_FRAGMENT_SHADER)).toContain("u_time");
  });

  it("radiates the light shafts from a single apex", () => {
    for (const shader of [SHINKAI_FRAGMENT_SHADER, SHINKAI_BOOT_FRAGMENT_SHADER]) {
      expect(shader).toContain("RAY_APEX");
      // 平行な縞（旧実装）に戻さない。
      expect(shader).not.toContain("RAY_TILT");
    }
  });
});
