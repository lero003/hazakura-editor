import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { growTree, sampleTreeBranch } from "./edohiganTree";
import { buildTreeGeometry } from "./edohiganTreeGeometry";

describe("edohigan branch mesh", () => {
  it("places every cross-section on the same curve used by attached blossoms", () => {
    const tree = growTree();
    const geometry = buildTreeGeometry(THREE, tree);
    try {
      const positions = geometry.getAttribute("position");
      const sway = geometry.getAttribute("aSway");
      // 太枝と梢を含む代表的な枝の断面中心を実メッシュから戻す。
      for (const branchIndex of [1, 2, 30, tree.branches.length - 1]) {
        const branch = tree.branches[branchIndex];
        for (let ring = 0; ring <= 5; ring += 1) {
          const first = branchIndex * 54 + ring * 9;
          const center = new THREE.Vector3();
          for (let side = 0; side < 9; side += 1) {
            center.add(new THREE.Vector3().fromBufferAttribute(positions, first + side));
          }
          center.divideScalar(9);
          const point = new THREE.Vector3(...sampleTreeBranch(branch, ring / 5));
          expect(center.distanceTo(point)).toBeLessThan(1e-5);
          expect(sway.getX(first)).toBeCloseTo(branch.swayStart + (branch.sway - branch.swayStart) * ring / 5, 6);
        }
      }
    } finally {
      geometry.dispose();
    }
  });

  it("faces outward so FrontSide renders bark rather than the inside of the trunk", () => {
    const tree = growTree();
    const geometry = buildTreeGeometry(THREE, tree);
    try {
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");
      const indices = geometry.getIndex()!;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const normal = new THREE.Vector3();
      let inward = 0;
      for (let index = 0; index < indices.count; index += 3) {
        const ia = indices.getX(index);
        a.fromBufferAttribute(positions, ia);
        b.fromBufferAttribute(positions, indices.getX(index + 1));
        c.fromBufferAttribute(positions, indices.getX(index + 2));
        normal.fromBufferAttribute(normals, ia);
        if (b.sub(a).cross(c.sub(a)).dot(normal) <= 0) inward += 1;
      }
      expect(inward).toBe(0);
    } finally {
      geometry.dispose();
    }
  });
});
