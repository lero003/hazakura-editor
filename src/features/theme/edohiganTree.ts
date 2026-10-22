import { mulberry32 } from "./edohiganRandom";

/**
 * 江戸彼岸の一本の大木 / Procedural Edohigan tree.
 *
 * 画像の枝を板ポリで揺らすのをやめ、**骨格から木を組む**。根元から先端までの
 * 距離を `sway` として持たせ、描画側は「根元は動かず、先端ほど大きくしなる」
 * 1 つの式で風に乗せる。位置ごとに位相をずらしつつ、接合点と花の基点は
 * 同じ風を受ける。枝が継ぎ目で離れたり、花が枝から滑ったりしない。
 *
 * ここは three.js に依存しない。種から決まる決定論的な骨格と花の位置だけを返し、
 * メッシュ化は描画側が行う。同じ種なら常に同じ木になる。
 */

export type Vec3 = readonly [number, number, number];

export type TreeBranch = {
  start: Vec3;
  end: Vec3;
  radiusStart: number;
  radiusEnd: number;
  /** 0 = 幹, 大きいほど先端。 */
  depth: number;
  /** 根元からの距離（0..1）。揺れの重み（枝の終点）。 */
  sway: number;
  /** 同じ値の枝の始点側。頂点ごとに補間して、関節で折れないようにする。 */
  swayStart: number;
  /** この枝の咲きぶり（咲き始め〜満開）。花の量と大きさに効く。 */
  fullness: number;
  /** 枝の曲がりと花の外観を決める位相（rad）。接合点の風には使わない。 */
  phase: number;
};

export type TreeBlossom = {
  position: Vec3;
  /** 花が付く枝の曲線上の点。風は花の中心ではなく、この基点で受ける。 */
  anchor: Vec3;
  /** 基点の根元からの距離（0..1）。枝と同じ揺れの重み。 */
  sway: number;
  size: number;
  phase: number;
  /** 花の濃さ（0..1）。奥の花を薄くするのに使う。 */
  tint: number;
  /**
   * 自己遮蔽（0 = 樹冠の奥で暗い, 1 = 梢の外で明るい）。
   * 板ポリの花を並べただけでは樹冠が「平らな壁」になるので、
   * 外側ほど光が当たるようにして塊の奥行きを出す。
   */
  shade: number;
  /**
   * 花の向き（樹冠の中心から外へ）。太陽との角度で明るさを変える。
   * これがないと、どの花も同じ明るさで「貼った紙」になる。
   */
  normal: Vec3;
};

export type Tree = {
  branches: TreeBranch[];
  blossoms: TreeBlossom[];
  /** 根元から先端までの高さ。 */
  height: number;
  /** 樹冠のおおよその半径。 */
  crownRadius: number;
};

export const TREE_MAX_DEPTH = 6;
/** 1 本の枝先に置く花の数。 */
export const BLOSSOMS_PER_TIP = 10;

type Vec = [number, number, number];

function add(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: Vec, k: number): Vec {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function normalize(a: Vec): Vec {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}

/** 任意の軸まわりの回転（Rodrigues）。 */
function rotate(v: Vec, axis: Vec, angle: number): Vec {
  const k = normalize(axis);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
  const cross: Vec = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];
  return [
    v[0] * cos + cross[0] * sin + k[0] * dot * (1 - cos),
    v[1] * cos + cross[1] * sin + k[1] * dot * (1 - cos),
    v[2] * cos + cross[2] * sin + k[2] * dot * (1 - cos),
  ];
}

/** 軸に直交する適当なベクトル。 */
function perpendicular(v: Vec): Vec {
  const helper: Vec = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross: Vec = [
    v[1] * helper[2] - v[2] * helper[1],
    v[2] * helper[0] - v[0] * helper[2],
    v[0] * helper[1] - v[1] * helper[0],
  ];
  return normalize(cross);
}

/** 描画用の管と花の基点が共有する、枝の二次ベジェ。 */
export function treeBranchCurve(branch: Pick<TreeBranch, "start" | "end" | "phase">): {
  control: Vec3;
  length: number;
} {
  const delta: Vec = [
    branch.end[0] - branch.start[0],
    branch.end[1] - branch.start[1],
    branch.end[2] - branch.start[2],
  ];
  const length = Math.hypot(...delta) || 1;
  const side = perpendicular(scale(delta, 1 / length));
  const bend = Math.sin(branch.phase * 1.7) * 0.16 * length;
  return {
    control: [
      branch.start[0] + delta[0] * 0.5 + side[0] * bend,
      branch.start[1] + delta[1] * 0.5 + side[1] * bend,
      branch.start[2] + delta[2] * 0.5 + side[2] * bend,
    ],
    length,
  };
}

export function sampleTreeBranch(
  branch: Pick<TreeBranch, "start" | "end" | "phase">,
  t: number,
): Vec3 {
  const { control } = treeBranchCurve(branch);
  const mt = 1 - t;
  return [
    mt * mt * branch.start[0] + 2 * mt * t * control[0] + t * t * branch.end[0],
    mt * mt * branch.start[1] + 2 * mt * t * control[1] + t * t * branch.end[1],
    mt * mt * branch.start[2] + 2 * mt * t * control[2] + t * t * branch.end[2],
  ];
}

export const TREE_DEFAULTS = {
  seed: 0xed0_0421,
  trunkLength: 8.8,
  trunkRadius: 0.9,
  /** 世代ごとの長さ・太さの減衰。 */
  lengthDecay: 0.78,
  radiusDecay: 0.66,
  /** 幹から出る枝の本数。 */
  trunkChildren: 3,
  /** それ以降の分岐数（2 か 3）。 */
} as const;

/**
 * 木を 1 本つくる。`seed` を固定すれば常に同じ形になる。
 *
 * 形の作り方:
 *   - 幹はほぼ真上。太く短く、最初の分岐で 3 本に分かれる
 *   - 子の向きは「親の向き + 外向き + 上向き」を混ぜ、世代が深いほど外へ広がる
 *   - 先端（`TREE_MAX_DEPTH`）では少し垂らす。桜の枝らしい重さを出す
 *   - 揺れの重みは根元からの累積距離。深さではなく距離なので、
 *     長い枝ほどよくしなる
 */
export function growTree(seed: number = TREE_DEFAULTS.seed): Tree {
  const random = mulberry32(seed);
  const branches: TreeBranch[] = [];
  const tips: Vec[] = [];
  const tipSway: number[] = [];
  const tipPhase: number[] = [];
  let maxPath = 0;
  let crownRadius = 0;

  type Task = {
    origin: Vec;
    direction: Vec;
    length: number;
    radius: number;
    depth: number;
    path: number;
  };

  const root: Task = {
    origin: [0, 0, 0],
    direction: normalize([0.09, 1, 0.03]),
    length: TREE_DEFAULTS.trunkLength,
    radius: TREE_DEFAULTS.trunkRadius,
    depth: 0,
    path: 0,
  };

  const stack: Task[] = [root];
  while (stack.length > 0) {
    const task = stack.pop()!;
    const { origin, direction, length, radius, depth, path } = task;
    const end: Vec = add(origin, scale(direction, length));
    const endPath = path + length;
    // 枝ごとの「咲きぶり」。満開の枝と咲き始めの枝を混ぜる。
    const fullness = 0.55 + random() * 0.6;
    maxPath = Math.max(maxPath, endPath);
    crownRadius = Math.max(crownRadius, Math.hypot(end[0], end[2]));

    branches.push({
      start: origin,
      end,
      radiusStart: radius,
      radiusEnd: Math.max(radius * TREE_DEFAULTS.radiusDecay, 0.02),
      depth,
      fullness,
      // いったん根元からの距離を入れ、下で 0..1 に正規化する。
      sway: endPath,
      swayStart: path,
      phase: random() * Math.PI * 2,
    });

    if (depth >= TREE_MAX_DEPTH) {
      tips.push(end);
      tipSway.push(endPath);
      tipPhase.push(random() * Math.PI * 2);
      continue;
    }

    const children = depth === 0 ? TREE_DEFAULTS.trunkChildren : random() < 0.45 ? 2 : 3;
    for (let index = 0; index < children; index += 1) {
      const around = perpendicular(direction);
      const spin = (index / children) * Math.PI * 2 + random() * 0.9;
      const axis = rotate(around, direction, spin);
      const spread = depth === 0 ? 0.5 + random() * 0.35 : 0.38 + random() * 0.34;
      let next = rotate(direction, axis, spread);

      // 外向きと上向きを少し混ぜる。深い枝ほど横へ、先端は少し垂れる。
      const outward = normalize([next[0], 0, next[2]]);
      const outwardWeight = 0.12 + depth * 0.1;
      const upWeight = depth < 2 ? 0.22 : depth >= TREE_MAX_DEPTH - 1 ? -0.16 : 0.06;
      next = normalize([
        next[0] + outward[0] * outwardWeight,
        next[1] + upWeight,
        next[2] + outward[2] * outwardWeight,
      ]);

      stack.push({
        origin: end,
        direction: next,
        length: length * TREE_DEFAULTS.lengthDecay * (0.9 + random() * 0.2),
        radius: radius * TREE_DEFAULTS.radiusDecay,
        depth: depth + 1,
        path: endPath,
      });
    }
  }

  // 揺れの重みを根元からの距離で正規化する。
  const denominator = maxPath || 1;
  for (const branch of branches) {
    branch.sway = Math.min(1, Math.max(0, branch.sway / denominator));
    branch.swayStart = Math.min(1, Math.max(0, branch.swayStart / denominator));
  }

  const blossoms: TreeBlossom[] = [];

  // 枝の途中にも花を置く。先端だけだと「綿の塊」に見えるため。
  for (const branch of branches) {
    if (branch.depth < 3 || branch.sway < 0.35) {
      continue;
    }
    const count = branch.depth >= TREE_MAX_DEPTH - 1 ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      if (random() > branch.fullness) {
        continue;
      }
      const t = 0.45 + random() * 0.55;
      const spread = 0.25 + random() * 0.3;
      const anchor = sampleTreeBranch(branch, t);
      const sway = branch.swayStart + (branch.sway - branch.swayStart) * t;
      const x = anchor[0] + (random() - 0.5) * spread;
      const y = anchor[1] + (random() - 0.5) * spread;
      const z = anchor[2] + (random() - 0.5) * spread;
      blossoms.push({
        position: [x, y, z],
        anchor,
        sway,
        size: 0.4 + random() * 0.4,
        phase: branch.phase + random() * 0.8,
        tint: Math.min(1, 0.15 + branch.sway * 0.45 + random() * 0.5),
        shade: 0.55 + Math.min(1, Math.hypot(x, z) / Math.max(crownRadius, 0.001)) * 0.45,
        normal: normalFromCrown(x, y, z),
      });
    }
  }

  tips.forEach((tip, index) => {
    const sway = tipSway[index] / denominator;
    const phase = tipPhase[index];
    const tipFullness = 0.72 + random() * 0.5;
    for (let count = 0; count < BLOSSOMS_PER_TIP; count += 1) {
      if (random() > tipFullness) {
        continue;
      }
      const spread = 0.28 + random() * 0.32;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const bx = tip[0] + Math.sin(phi) * Math.cos(theta) * spread;
      const by = tip[1] + Math.cos(phi) * spread * 0.7;
      const bz = tip[2] + Math.sin(phi) * Math.sin(theta) * spread;
      blossoms.push({
        position: [bx, by, bz],
        anchor: tip,
        sway,
        size: (0.48 + random() * 0.52) * (0.78 + tipFullness * 0.35),
        phase: phase + random() * 0.8,
        // 高いところほど空を背景に明るく見える。
        tint: Math.min(1, 0.18 + sway * 0.42 + random() * 0.5),
        shade: 0.55 + Math.min(1, Math.hypot(bx, bz) / Math.max(crownRadius, 0.001)) * 0.45,
        normal: normalFromCrown(bx, by, bz),
      });
    }
  });

  let height = 0;
  for (const branch of branches) {
    height = Math.max(height, branch.end[1]);
  }

  return { branches, blossoms, height, crownRadius };
}

/**
 * 風の式。木・花・草が同じ式を使う（別々のループにしない）。
 * GLSL 側と揃えるため、文字列としても書き出せるようにしておく。
 */
export const WIND_GLSL = /* glsl */ `
  float edohiganSway(float time, float phase, float gust) {
    float slow = sin(time * 0.55 + phase) * 0.62;
    float mid = sin(time * 0.27 + phase * 1.7) * 0.28;
    float fast = sin(time * 1.13 + phase * 2.3) * 0.1;
    return (slow + mid + fast) * (0.55 + gust * 0.65);
  }

  // 木と付着した花は同じ空間の風を受ける。枝ごとの乱数位相は使わない。
  vec3 edohiganTreeDisplacement(vec3 anchorWorld, float sway, float time, float gust, float windScale) {
    float spatial = (anchorWorld.x + anchorWorld.z * 0.6) * 0.11;
    float s = edohiganSway(time, spatial, gust) * windScale;
    float weight = sway * sway;
    return vec3(s * 0.62, sin(time * 0.45 + spatial * 2.0) * 0.05 * windScale, s * 0.16) * weight;
  }
`;

/** 風の式（CPU 側）。テストと、必要なら JS からの参照に使う。 */
export function edohiganSway(time: number, phase: number, gust: number): number {
  const slow = Math.sin(time * 0.55 + phase) * 0.62;
  const mid = Math.sin(time * 0.27 + phase * 1.7) * 0.28;
  const fast = Math.sin(time * 1.13 + phase * 2.3) * 0.1;
  return (slow + mid + fast) * (0.55 + gust * 0.65);
}

/** 枝と花が共有する変位の CPU 参照。基点と距離が同じなら動きも一致する。 */
export function edohiganTreeDisplacement(
  anchorWorld: Vec3,
  sway: number,
  time: number,
  gust: number,
  windScale: number,
): Vec3 {
  const spatial = (anchorWorld[0] + anchorWorld[2] * 0.6) * 0.11;
  const s = edohiganSway(time, spatial, gust) * windScale;
  const weight = sway * sway;
  return [
    s * 0.62 * weight,
    Math.sin(time * 0.45 + spatial * 2) * 0.05 * windScale * weight,
    s * 0.16 * weight,
  ];
}


/** 樹冠の中心から花へ向かう単位ベクトル。 */
function normalFromCrown(x: number, y: number, z: number): Vec3 {
  const dx = x;
  const dy = y - 14;
  const dz = z;
  const length = Math.hypot(dx, dy, dz) || 1;
  return [dx / length, dy / length, dz / length];
}
