import { describe, expect, it } from "vitest";
import {
  BLOSSOMS_PER_TIP,
  TREE_MAX_DEPTH,
  TREE_DEFAULTS,
  edohiganSway,
  edohiganTreeDisplacement,
  growTree,
  sampleTreeBranch,
  treeBranchCurve,
  type TreeBranch,
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

  it("keeps blossoms across the whole crown when intensity draws only a prefix", () => {
    for (const seed of [TREE_DEFAULTS.seed, 1, 2]) {
      const { blossoms } = growTree(seed);
      // 強度の間引きは instanceCount で先頭から描く。どの x/z 象限も
      // 同じ割合で残り、片側の枝だけが裸にならないことを確かめる。
      for (const ratio of [0.62, 0.85]) {
        const visible = blossoms.slice(0, Math.round(blossoms.length * ratio));
        for (const signX of [-1, 1]) {
          for (const signZ of [-1, 1]) {
            const inSector = (blossom: (typeof blossoms)[number]) =>
              blossom.position[0] * signX >= 0 && blossom.position[2] * signZ >= 0;
            const total = blossoms.filter(inSector).length;
            const remaining = visible.filter(inSector).length;
            expect(total).toBeGreaterThan(100);
            expect(Math.abs(remaining / total - ratio)).toBeLessThan(0.08);
          }
        }
      }
    }
  });

  it("preserves the main limbs and tapers the terminal branches continuously", () => {
    const { branches } = growTree();
    for (const branch of branches) {
      if (branch.depth <= 3) {
        const originalStart = TREE_DEFAULTS.trunkRadius * TREE_DEFAULTS.radiusDecay ** branch.depth;
        expect(branch.radiusStart).toBeCloseTo(originalStart, 12);
        expect(branch.radiusEnd).toBeCloseTo(originalStart * TREE_DEFAULTS.radiusDecay, 12);
      }
      if (branch.depth >= 4) {
        expect(branch.radiusEnd / branch.radiusStart).toBeLessThan(0.6);
      }
      if (branch.depth === TREE_MAX_DEPTH) {
        const originalRadius = TREE_DEFAULTS.trunkRadius * TREE_DEFAULTS.radiusDecay ** TREE_MAX_DEPTH;
        expect(branch.radiusStart).toBeLessThan(originalRadius * 0.65);
        expect(branch.radiusEnd).toBeGreaterThan(0);
      }
      if (branch.depth > 0) {
        const parent = branches.find((candidate) =>
          candidate.end.every((value, axis) => value === branch.start[axis]));
        expect(parent).toBeDefined();
        expect(branch.radiusStart).toBe(parent!.radiusEnd);
      }
    }
  });

  it("has a trunk-based height taller than the crown radius", () => {
    const tree = growTree();
    expect(tree.height).toBeGreaterThan(10);
    expect(tree.height).toBeGreaterThan(tree.crownRadius);
  });

  it("keeps flower attachment points on their parent branch curves", () => {
    const tree = growTree();
    for (const blossom of tree.blossoms) {
      expect(blossom.anchor.every(Number.isFinite)).toBe(true);
      expect(blossom.sway).toBeGreaterThan(0);
      expect(blossom.sway).toBeLessThanOrEqual(1);
      // 花の塊には広がりがあるが、風の基点は枝から離さない。
      expect(Math.hypot(...blossom.position.map((value, axis) => value - blossom.anchor[axis])))
        .toBeLessThan(0.61);
    }
    // 途中の花と枝先の花の両方を含む代表点で、曲線上の位置と揺れの重みを照合する。
    for (const blossom of tree.blossoms.filter((_, index) => index % 31 === 0)) {
      const attached = tree.branches.some((branch) => {
        const t = (blossom.sway - branch.swayStart) / (branch.sway - branch.swayStart);
        if (t < 0.45 - 1e-10 || t > 1 + 1e-10) return false;
        const point = sampleTreeBranch(branch, t);
        return Math.hypot(...point.map((value, axis) => value - blossom.anchor[axis])) < 1e-9;
      });
      expect(attached).toBe(true);
    }
  });
});

describe("edohigan branch curve", () => {
  const branch: TreeBranch = {
    start: [1, 2, 3], end: [1, 12, 3], phase: 0.8,
    radiusStart: 0.8, radiusEnd: 0.5, depth: 1,
    swayStart: 0.2, sway: 0.4, fullness: 1,
  };

  it("keeps junction endpoints fixed and bends between them", () => {
    expect(sampleTreeBranch(branch, 0)).toEqual(branch.start);
    expect(sampleTreeBranch(branch, 1)).toEqual(branch.end);
    const middle = sampleTreeBranch(branch, 0.5);
    expect(middle[1]).toBe(7);
    expect(Math.hypot(middle[0] - 1, middle[2] - 3)).toBeGreaterThan(0.5);
    const { control, length } = treeBranchCurve(branch);
    expect(length).toBe(10);
    expect(middle).toEqual(branch.start.map((value, axis) =>
      value * 0.25 + control[axis] * 0.5 + branch.end[axis] * 0.25));
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

  it("keeps parent and child branch junctions together throughout a gust", () => {
    const tree = growTree();
    for (const child of tree.branches.filter((branch) => branch.depth > 0)) {
      const parent = tree.branches.find((branch) =>
        branch.end.every((value, axis) => value === child.start[axis]));
      expect(parent).toBeDefined();
      for (const time of [0, 3, 11]) {
        const end = edohiganTreeDisplacement(sampleTreeBranch(parent!, 1), parent!.sway, time, 0.8, 1.4);
        const start = edohiganTreeDisplacement(sampleTreeBranch(child, 0), child.swayStart, time, 0.8, 1.4);
        expect(start).toEqual(end);
      }
    }
  });

  it("anchors the root and stops every axis when wind is disabled", () => {
    for (const time of [0, 3, 11]) {
      const root = edohiganTreeDisplacement([0, 0, 0], 0, time, 1, 1.4);
      const still = edohiganTreeDisplacement([7, 12, -4], 0.9, time, 1, 0);
      expect(root.every((value) => value === 0)).toBe(true);
      expect(still.every((value) => value === 0)).toBe(true);
    }
    const near = edohiganTreeDisplacement([7, 12, -4], 0.5, 3, 1, 1.4);
    const tip = edohiganTreeDisplacement([7, 12, -4], 1, 3, 1, 1.4);
    expect(near).toEqual(tip.map((value) => value * 0.25));
  });
});
