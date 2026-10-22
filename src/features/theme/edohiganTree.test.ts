import { describe, expect, it } from "vitest";
import {
  BLOSSOMS_PER_TIP,
  TREE_MAX_DEPTH,
  edohiganSway,
  growTree,
} from "./edohiganTree";

describe("edohigan tree skeleton", () => {
  it("is deterministic for the same seed and different for another", () => {
    const first = growTree(1);
    expect(growTree(1)).toEqual(first);
    expect(growTree(2).branches).not.toEqual(first.branches);
  });

  it("grows one trunk and branches out to the configured depth", () => {
    const tree = growTree();
    const trunk = tree.branches.filter((branch) => branch.depth === 0);
    expect(trunk).toHaveLength(1);
    // 幹は根元から立ち上がる。
    expect(trunk[0].start[1]).toBe(0);
    expect(trunk[0].end[1]).toBeGreaterThan(trunk[0].start[1]);
    const deepest = Math.max(...tree.branches.map((branch) => branch.depth));
    expect(deepest).toBe(TREE_MAX_DEPTH);
  });

  it("keeps every sway weight inside 0..1 and growing toward the tips", () => {
    const tree = growTree();
    for (const branch of tree.branches) {
      expect(branch.sway).toBeGreaterThanOrEqual(0);
      expect(branch.sway).toBeLessThanOrEqual(1);
      expect(branch.swayStart).toBeLessThanOrEqual(branch.sway);
    }
    const trunk = tree.branches.find((branch) => branch.depth === 0)!;
    const tip = tree.branches.find((branch) => branch.depth === TREE_MAX_DEPTH)!;
    // 根元はほぼ動かず、先端ほど大きくしなる。
    expect(trunk.swayStart).toBe(0);
    expect(tip.sway).toBeGreaterThan(0.8);
  });

  it("produces a blossom canopy within a sane budget", () => {
    const tree = growTree();
    const tips = tree.branches.filter((branch) => branch.depth === TREE_MAX_DEPTH).length;
    // 枝先 + 途中の枝に花が付く。1 ドローコールで収まる範囲に保つ。
    expect(tree.blossoms.length).toBeGreaterThan(tips);
    expect(tree.blossoms.length).toBeLessThan(tips * (BLOSSOMS_PER_TIP + 8));
    // 1 ドローコールのインスタンス数として許容できる上限。
    expect(tree.blossoms.length).toBeLessThan(5200);
    for (const blossom of tree.blossoms) {
      expect(Number.isFinite(blossom.position[0])).toBe(true);
      expect(blossom.size).toBeGreaterThan(0);
      expect(blossom.tint).toBeGreaterThanOrEqual(0);
      expect(blossom.tint).toBeLessThanOrEqual(1);
    }
  });

  it("has a trunk-based height taller than the crown radius", () => {
    const tree = growTree();
    expect(tree.height).toBeGreaterThan(10);
    expect(tree.height).toBeGreaterThan(tree.crownRadius);
  });
});

describe("shared wind", () => {
  it("breathes slowly and stays bounded", () => {
    const samples = Array.from({ length: 600 }, (_, index) => edohiganSway(index * 0.2, 0.7, 0.5));
    expect(Math.max(...samples)).toBeLessThan(1.2);
    expect(Math.min(...samples)).toBeGreaterThan(-1.2);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
  });

  it("gives different branches different phases", () => {
    // 位相が同じだと木全体が同じリズムで回り、機械的に見える。
    const a = edohiganSway(3, 0, 0.5);
    const b = edohiganSway(3, 1.7, 0.5);
    expect(Math.abs(a - b)).toBeGreaterThan(0.05);
  });
});
