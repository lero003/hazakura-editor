import { mulberry32 } from "./edohiganRandom";

/**
 * 江戸彼岸の一本の大木 / Procedural Edohigan tree.
 *
 * 画像の枝を板ポリで揺らすのをやめ、**骨格から木を組む**。根元から先端までの
 * 距離を `sway` として持たせ、描画側は「根元は動かず、先端ほど大きくしなる」
 * 1 つの式で風に乗せる。枝ごとに位相をずらしてあるので、木全体が同じ位相で
 * 回る（＝くるくる回って見える）ことはない。
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
  /** 枝ごとの位相（rad）。揺れが同期しないようにする。 */
  phase: number;
};

export type TreeBlossom = {
  position: Vec3;
  size: number;
  phase: number;
  /** 花の濃さ（0..1）。奥の花を薄くするのに使う。 */
  tint: number;
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
export const BLOSSOMS_PER_TIP = 7;

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

export const TREE_DEFAULTS = {
  seed: 0xed0_0421,
  trunkLength: 8.2,
  trunkRadius: 0.98,
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
    maxPath = Math.max(maxPath, endPath);
    crownRadius = Math.max(crownRadius, Math.hypot(end[0], end[2]));

    branches.push({
      start: origin,
      end,
      radiusStart: radius,
      radiusEnd: Math.max(radius * TREE_DEFAULTS.radiusDecay, 0.02),
      depth,
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
    const count = branch.depth >= TREE_MAX_DEPTH - 1 ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const t = 0.45 + random() * 0.55;
      const spread = 0.25 + random() * 0.3;
      blossoms.push({
        position: [
          branch.start[0] + (branch.end[0] - branch.start[0]) * t + (random() - 0.5) * spread,
          branch.start[1] + (branch.end[1] - branch.start[1]) * t + (random() - 0.5) * spread,
          branch.start[2] + (branch.end[2] - branch.start[2]) * t + (random() - 0.5) * spread,
        ],
        size: 0.3 + random() * 0.3,
        phase: branch.phase + random() * 0.8,
        tint: Math.min(1, 0.3 + branch.sway * 0.7),
      });
    }
  }

  tips.forEach((tip, index) => {
    const sway = tipSway[index] / denominator;
    const phase = tipPhase[index];
    for (let count = 0; count < BLOSSOMS_PER_TIP; count += 1) {
      const spread = 0.45 + random() * 0.5;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      blossoms.push({
        position: [
          tip[0] + Math.sin(phi) * Math.cos(theta) * spread,
          tip[1] + Math.cos(phi) * spread * 0.7,
          tip[2] + Math.sin(phi) * Math.sin(theta) * spread,
        ],
        size: 0.34 + random() * 0.4,
        phase: phase + random() * 0.8,
        // 高いところほど空を背景に明るく見える。
        tint: Math.min(1, 0.35 + sway * 0.65),
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
`;

/** 風の式（CPU 側）。テストと、必要なら JS からの参照に使う。 */
export function edohiganSway(time: number, phase: number, gust: number): number {
  const slow = Math.sin(time * 0.55 + phase) * 0.62;
  const mid = Math.sin(time * 0.27 + phase * 1.7) * 0.28;
  const fast = Math.sin(time * 1.13 + phase * 2.3) * 0.1;
  return (slow + mid + fast) * (0.55 + gust * 0.65);
}
