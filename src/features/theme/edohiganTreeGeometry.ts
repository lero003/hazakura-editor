import { TREE_MAX_DEPTH, treeBranchCurve, type Tree } from "./edohiganTree";

/**
 * 木の骨格を、曲がった管メッシュにする。
 *
 * 枝を直線で結ぶと「針金」に見えるので、枝ごとに 1 本の二次ベジェへ曲げる。
 * 根元（depth 0）は根張りを付けて地面へ広がらせる。頂点は
 *   - aSway   : 根元からの距離（0..1）。風の重み
 *   - aBarkUv : 樹皮のムラを描くための UV
 * を持つ。
 */

export function buildTreeGeometry(THREE: typeof import("three"), tree: Tree) {
  const positions: number[] = [];
  const normals: number[] = [];
  const sway: number[] = [];
  const depth: number[] = [];
  const barkUv: number[] = [];
  const indices: number[] = [];

  const SIDES = 9;
  const RINGS = 5;

  const basis = (direction: [number, number, number]) => {
    const helper: [number, number, number] = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u: [number, number, number] = [
      direction[1] * helper[2] - direction[2] * helper[1],
      direction[2] * helper[0] - direction[0] * helper[2],
      direction[0] * helper[1] - direction[1] * helper[0],
    ];
    const length = Math.hypot(u[0], u[1], u[2]) || 1;
    const unit: [number, number, number] = [u[0] / length, u[1] / length, u[2] / length];
    const v: [number, number, number] = [
      direction[1] * unit[2] - direction[2] * unit[1],
      direction[2] * unit[0] - direction[0] * unit[2],
      direction[0] * unit[1] - direction[1] * unit[0],
    ];
    return { unit, v };
  };

  for (const branch of tree.branches) {
    const startPoint = branch.start as unknown as [number, number, number];
    const endPoint = branch.end as unknown as [number, number, number];
    const delta: [number, number, number] = [
      endPoint[0] - startPoint[0],
      endPoint[1] - startPoint[1],
      endPoint[2] - startPoint[2],
    ];
    const { control, length } = treeBranchCurve(branch);
    const forward: [number, number, number] = [delta[0] / length, delta[1] / length, delta[2] / length];
    const side = basis(forward).unit;

    const baseIndex = positions.length / 3;

    for (let ring = 0; ring <= RINGS; ring += 1) {
      const t = ring / RINGS;
      const mt = 1 - t;
      const px = mt * mt * startPoint[0] + 2 * mt * t * control[0] + t * t * endPoint[0];
      const py = mt * mt * startPoint[1] + 2 * mt * t * control[1] + t * t * endPoint[1];
      const pz = mt * mt * startPoint[2] + 2 * mt * t * control[2] + t * t * endPoint[2];
      const tx = 2 * mt * (control[0] - startPoint[0]) + 2 * t * (endPoint[0] - control[0]);
      const ty = 2 * mt * (control[1] - startPoint[1]) + 2 * t * (endPoint[1] - control[1]);
      const tz = 2 * mt * (control[2] - startPoint[2]) + 2 * t * (endPoint[2] - control[2]);
      const tangentLength = Math.hypot(tx, ty, tz) || 1;
      const tangent: [number, number, number] = [tx / tangentLength, ty / tangentLength, tz / tangentLength];
      // 枝の途中で helper 軸を切り替えると、断面が急に回転して管が裏返る。
      // 最初の断面の軸を接線へ投影し、曲がりに沿って連続させる。
      const along = side[0] * tangent[0] + side[1] * tangent[1] + side[2] * tangent[2];
      const ux = side[0] - tangent[0] * along;
      const uy = side[1] - tangent[1] * along;
      const uz = side[2] - tangent[2] * along;
      const unitLength = Math.hypot(ux, uy, uz);
      const unit = [ux / unitLength, uy / unitLength, uz / unitLength];
      const frame = { unit, v: [
        tangent[1] * unit[2] - tangent[2] * unit[1],
        tangent[2] * unit[0] - tangent[0] * unit[2],
        tangent[0] * unit[1] - tangent[1] * unit[0],
      ] };

      // 根張り: 太い幹ほど根元が広がる。t=0 で最大、すぐ絞る。
      // 断面を真円のままにせず、根元は 3 つのローブで地面へ食い込ませる。
      // まっすぐな円錐だと「旋盤で削った柱」に見えるため。
      const flare = branch.depth === 0 ? 1 + 0.5 * Math.pow(1 - t, 4) : 1;
      const wobble = branch.depth === 0 ? 1 + 0.045 * Math.sin(t * 5.4 + 1.2) : 1;
      const baseRadius =
        (branch.radiusStart + (branch.radiusEnd - branch.radiusStart) * t) * wobble;
      const ringSway = branch.swayStart + (branch.sway - branch.swayStart) * t;

      for (let sideIndex = 0; sideIndex < SIDES; sideIndex += 1) {
        const angle = (sideIndex / SIDES) * Math.PI * 2;
        const lobe =
          branch.depth === 0
            ? 0.2 * Math.pow(1 - t, 2.5) * Math.sin(angle * 3.0 + 0.9)
            : 0;
        const radius = baseRadius * (flare + lobe);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = frame.unit[0] * cos + frame.v[0] * sin;
        const ny = frame.unit[1] * cos + frame.v[1] * sin;
        const nz = frame.unit[2] * cos + frame.v[2] * sin;
        positions.push(px + nx * radius, py + ny * radius, pz + nz * radius);
        normals.push(nx, ny, nz);
        sway.push(ringSway);
        depth.push(branch.depth / TREE_MAX_DEPTH);
        // 樹皮の u は「枝に沿った実寸（m）」。枝ごとに 0..1 で正規化すると、
        // 太い幹と細い枝で模様の密度が変わってしまう。
        barkUv.push(t * length, sideIndex / SIDES);
      }
    }

    for (let ring = 0; ring < RINGS; ring += 1) {
      for (let sideIndex = 0; sideIndex < SIDES; sideIndex += 1) {
        const next = (sideIndex + 1) % SIDES;
        const a = baseIndex + ring * SIDES + sideIndex;
        const b = baseIndex + ring * SIDES + next;
        const c = baseIndex + (ring + 1) * SIDES + sideIndex;
        const d = baseIndex + (ring + 1) * SIDES + next;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
  geometry.setAttribute("aDepth01", new THREE.Float32BufferAttribute(depth, 1));
  geometry.setAttribute("aBarkUv", new THREE.Float32BufferAttribute(barkUv, 2));
  geometry.setIndex(indices);
  return geometry;
}
