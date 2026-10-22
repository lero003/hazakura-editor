import { describe, expect, it } from "vitest";
import { readProjectFile } from "../../test-support/source";
import {
  EDOHIGAN_SUN_DIRECTION,
  EDOHIGAN_SUN_DIRECTION_GLSL,
  edohiganSunLight,
} from "./edohiganLighting";

describe("edohigan sun", () => {
  it("is a unit vector", () => {
    const length = Math.hypot(...EDOHIGAN_SUN_DIRECTION);
    expect(length).toBeCloseTo(1, 3);
  });

  it("sits upper-right, behind the tree", () => {
    const [x, y, z] = EDOHIGAN_SUN_DIRECTION;
    // 画面右・上・奥。ここが崩れると木の陰影と地面の影が食い違う。
    expect(x).toBeGreaterThan(0.3);
    expect(y).toBeGreaterThan(0.3);
    expect(z).toBeLessThan(-0.3);
  });

  it("lights the sun side and leaves the far side dark", () => {
    expect(edohiganSunLight(EDOHIGAN_SUN_DIRECTION)).toBeCloseTo(1, 3);
    expect(edohiganSunLight([-0.5503, -0.5803, 0.6003])).toBeCloseTo(0, 5);
    // 右を向いた面は、左を向いた面より明るい。
    expect(edohiganSunLight([1, 0, 0])).toBeGreaterThan(edohiganSunLight([-1, 0, 0]));
  });

  it("embeds the same vector in the GLSL literal", () => {
    for (const value of EDOHIGAN_SUN_DIRECTION) {
      expect(EDOHIGAN_SUN_DIRECTION_GLSL).toContain(String(value));
    }
    expect(EDOHIGAN_SUN_DIRECTION_GLSL).toContain("-0.6003");
  });
});

describe("scene lighting consistency", () => {
  const source = readProjectFile("src/components/app/EdohiganSceneBackdrop.tsx");

  it("takes the shadow camera direction from the shared constant", () => {
    expect(source).toMatch(/new THREE\.Vector3\(\.\.\.EDOHIGAN_SUN_DIRECTION\)/);
    // 手前から照らす古い向きが残っていない。
    expect(source).not.toContain("new THREE.Vector3(0.55, 0.8, 0.35)");
  });

  it("lights the tree and the blossoms with the shared GLSL direction", () => {
    // TREE_FRAGMENT と BLOSSOM_VERTEX の両方が同じリテラルを埋め込む。
    const uses = source.match(/\$\{EDOHIGAN_SUN_DIRECTION_GLSL\}/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
  });
});
