import { describe, expect, it } from "vitest";
import { readProjectFile } from "../../test-support/source";

/**
 * GLSL の予約語を識別子に使うと、**コンパイルが失敗してオブジェクトが消える**。
 * シェーダーは実行するまで分からないので、ソースの時点で止める。
 *
 * 実際に `patch` を変数名に使って地面が丸ごと描画されなくなり、
 * 「空だけが残る」状態になった（2026-10-22）。その再発防止。
 */
const RESERVED = [
  "patch",
  "sample",
  "subroutine",
  "partition",
  "active",
  "filter",
  "resource",
  "superp",
  "sizeof",
  "cast",
  "namespace",
  "using",
  "row_major",
  "common",
];

const SOURCES = [
  "src/components/app/EdohiganSceneBackdrop.tsx",
  "src/features/theme/edohiganPost.ts",
  "src/features/theme/edohiganPetalShader.ts",
  "src/features/theme/edohiganTree.ts",
];

/** `/* glsl *\/ \`...\`` のブロックだけを取り出す。 */
function glslBlocks(source: string): string[] {
  const blocks: string[] = [];
  const pattern = /\/\* glsl \*\/ `([\s\S]*?)`;/g;
  let match = pattern.exec(source);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(source);
  }
  return blocks;
}

describe("GLSL source hygiene", () => {
  it("finds the shader blocks", () => {
    const blocks = SOURCES.flatMap((path) => glslBlocks(readProjectFile(path)));
    // 背景（sky/ground/tree/blossom/grass）とポスト（bright/blur/composite）で十分な数になる。
    expect(blocks.length).toBeGreaterThanOrEqual(8);
  });

  it("does not use GLSL ES reserved words as identifiers", () => {
    const offenders: string[] = [];
    for (const path of SOURCES) {
      for (const block of glslBlocks(readProjectFile(path))) {
        // コメントを落としてから識別子としての出現を見る。
        const code = block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
        for (const word of RESERVED) {
          const declaration = new RegExp(`\\b(?:float|int|vec2|vec3|vec4|mat2|mat3|mat4|bool)\\s+${word}\\b`);
          if (declaration.test(code)) {
            offenders.push(`${path}: ${word}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
