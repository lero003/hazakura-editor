import type { AmbientIntensity } from "../../types";
import { mulberry32 } from "./edohiganRandom";
import type { AmbientQualityTier } from "./ambientQuality";

/**
 * 江戸彼岸 — three.js 情景レイヤーの純モデル / Scene parameters for the
 * Edohigan 3D layer.
 *
 * CSS 版（`EdohiganAmbient`）は「花弁は CSS で動かす」という判断の上に
 * 成り立っている。このモジュールは、その判断を three.js 側で置き換える
 * スパイク用に、**同じ決定論**（同じ強度なら同じ配置）で花弁の種を返す。
 *
 * ここは three.js に依存しない。深度・速度・位相は数値として決め、
 * 描画側はそれを uniform / instanced attribute へ流し込むだけにする。
 * これで「見た目の意図」を純関数テストで固定できる。
 */

/** 3D 空間に置く花弁の数。1 ドローコールなので CSS 版より多く置ける。 */
export const SCENE_PETAL_COUNT: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 28,
  normal: 48,
  dramatic: 72,
};

/**
 * 品質段による間引き。GPU が苦しいときは「解像度」より先に「枚数」を落とす。
 * 花弁は重なっても絵が壊れないので、枚数を減らす方が体感が穏やかになる。
 */
export const SCENE_PETAL_TIER_SCALE: Record<AmbientQualityTier, number> = {
  0: 1,
  1: 1,
  2: 0.7,
  3: 0.45,
};

export function scenePetalTargetCount(
  intensity: AmbientIntensity,
  tier: AmbientQualityTier,
): number {
  const base = SCENE_PETAL_COUNT[intensity];
  if (base === 0) {
    return 0;
  }
  return Math.max(1, Math.round(base * SCENE_PETAL_TIER_SCALE[tier]));
}

/** 深度帯。0 = 最遠, 1 = 最近。 */
export const SCENE_DEPTH_BANDS = [0.12, 0.48, 0.86] as const;

/**
 * 本文カラムを守る範囲（画面幅に対する中心からの距離）。
 * `NEAR` がここより内側に入ると花弁の不透明度を 0 へ落とす。
 * 既存 CSS 版の mask（左右 30% / 中央 36%）とほぼ同じ帯を、
 * 画面ではなく **シェーダー内の投影座標** で判定する。
 */
export const READING_CLEAR_INNER = 0.16;
export const READING_CLEAR_OUTER = 0.22;
/** 中景・遠景は中央でも完全には消さない（紙の奥に気配を残す）。 */
export const FAR_CENTER_KEEP = 0.45;

export type ScenePetal = {
  index: number;
  /** 0 = 最遠, 1 = 最近。カメラからの z と大きさ・濃さの元。 */
  depth01: number;
  /** 正規化した横位置 -1..1。 */
  x: number;
  /** 落下の初期進行 0..1（負の delay 相当）。 */
  start01: number;
  /** 画面高さに対する一辺の比率。 */
  size: number;
  opacity: number;
  /** 画面高さ / 秒。 */
  fall: number;
  /** 横揺れの振幅（画面高さに対する比率）。 */
  sway: number;
  swayHz: number;
  /** 自転 rad/秒。 */
  spin: number;
  /** 裏返りの周波数 Hz。 */
  flipHz: number;
  /** 位相 rad。 */
  phase: number;
};

const INTENSITY_SEED: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0x5eed_1,
  normal: 0x5eed_2,
  dramatic: 0x5eed_3,
};

/** 深度帯ごとの見え方。空気遠近を「寸法・濃さ・速度」で表す。 */
const DEPTH_PROFILE = [
  { size: 0.022, opacity: 0.16, fall: 0.052, sway: 0.012, spin: 0.22, flip: 0.1 },
  { size: 0.04, opacity: 0.34, fall: 0.082, sway: 0.02, spin: 0.34, flip: 0.16 },
  { size: 0.064, opacity: 0.5, fall: 0.118, sway: 0.032, spin: 0.5, flip: 0.23 },
] as const;

/**
 * 強度と品質段から花弁の種を作る。同じ引数なら常に同じ配列を返す。
 * 近景から先に埋めるので、品質段が落ちても「手前の花」は残る。
 */
export function createScenePetals(
  intensity: AmbientIntensity,
  tier: AmbientQualityTier = 1,
): ScenePetal[] {
  const total = SCENE_PETAL_COUNT[intensity];
  if (total === 0) {
    return [];
  }
  // 品質段は「先頭から何枚使うか」だけを決める。乱数の系列は強度ごとに固定なので、
  // 段が落ちても残った花弁の位置・速度は変わらない（絵が飛ばない）。
  const random = mulberry32(INTENSITY_SEED[intensity]);
  const petals: ScenePetal[] = [];
  for (let index = 0; index < total; index += 1) {
    // 0,2,1,0,2,1... と回して、近景と中景が先に並ぶようにする。
    const band = SCENE_DEPTH_BANDS.length - 1 - (index % SCENE_DEPTH_BANDS.length);
    const profile = DEPTH_PROFILE[band];
    const jitter = random();
    petals.push({
      index,
      depth01: Math.min(1, Math.max(0, SCENE_DEPTH_BANDS[band] + (jitter - 0.5) * 0.1)),
      x: random() * 2 - 1,
      start01: random(),
      size: profile.size * (0.82 + random() * 0.36),
      opacity: profile.opacity * (0.86 + random() * 0.28),
      fall: profile.fall * (0.85 + random() * 0.3),
      sway: profile.sway * (0.7 + random() * 0.6),
      swayHz: 0.09 + random() * 0.07,
      spin: profile.spin * (random() < 0.5 ? -1 : 1) * (0.6 + random() * 0.8),
      flipHz: profile.flip * (0.7 + random() * 0.6),
      phase: random() * Math.PI * 2,
    });
  }
  return petals.slice(0, scenePetalTargetCount(intensity, tier));
}

/**
 * 共通の風。花弁も枝もこの 1 つの値に乗る（別々のループにしない）。
 * 返り値は 0..1。周期の違う 3 波を重ねて、同期して見えないようにする。
 */
export function edohiganWind(seconds: number): number {
  const t = Number.isFinite(seconds) ? seconds : 0;
  const value =
    0.5 + 0.28 * Math.sin(t * 0.23) + 0.16 * Math.sin(t * 0.61 + 1.7) + 0.06 * Math.sin(t * 1.31 + 0.4);
  return Math.min(1, Math.max(0, value));
}

/** 枝の振れ角（rad）。近景の花弁より一桁小さい。 */
export function edohiganBranchSway(seconds: number): number {
  return (edohiganWind(seconds) - 0.5) * 0.032;
}

/**
 * 中央カラムを守る係数。`screenX` は 0..1 の投影座標、`depth01` は花弁の深度。
 * 近景ほど強く消し、遠景は薄く残す。描画側とテストで同じ式を使う。
 */
export function centerClearFactor(screenX: number, depth01: number): number {
  const distance = Math.abs(screenX - 0.5);
  // 1 = 中央の守る帯の内側, 0 = 帯の外側。
  const inside = 1 - smoothstep(READING_CLEAR_INNER, READING_CLEAR_OUTER, distance);
  // 近景ほど強く消す。遠景は `FAR_CENTER_KEEP` の割合だけ残す。
  const near = smoothstep(0.4, 0.9, depth01);
  const suppress = near + (1 - near) * (1 - FAR_CENTER_KEEP);
  return 1 - inside * suppress;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 紙の手前と奥で花弁を分担する。
 *
 * 江戸彼岸の情景は二層になった:
 *   - 奥（`backdrop`）= 空・陽の光・枝・中景/遠景の花弁。紙は半透明でこれを透かす
 *   - 手前（`foreground`）= 近景の花弁だけ。紙の上を横切って奥行きを作る
 *
 * 同じ種を二重に描かないよう、深度で 1 回だけ分ける。分担しても
 * 合計枚数と配置は `createScenePetals` のまま変わらない。
 */
export function splitPetalBands(petals: ScenePetal[]): {
  backdrop: ScenePetal[];
  foreground: ScenePetal[];
} {
  const foreground: ScenePetal[] = [];
  const backdrop: ScenePetal[] = [];
  for (const petal of petals) {
    if (petal.depth01 >= NEAR_BAND_THRESHOLD) {
      foreground.push(petal);
    } else {
      backdrop.push(petal);
    }
  }
  return { backdrop, foreground };
}

/** これ以上を「紙の手前」として扱う深度。 */
export const NEAR_BAND_THRESHOLD = 0.7;

/**
 * 夜明けの空の色。江戸彼岸は「和紙の上の花」から「夜明けの情景」へ移した。
 * sRGB の 0..1。CSS 側のトークンとは独立で、情景レイヤーだけの色。
 */
export const DAWN_SKY = {
  zenith: [0.6, 0.62, 0.86],
  upper: [0.93, 0.68, 0.78],
  middle: [1.0, 0.71, 0.56],
  horizon: [1.0, 0.88, 0.8],
  sun: [1.0, 0.97, 0.9],
  haze: [1.0, 0.86, 0.8],
} as const;

/** 奥の花弁の色。空気遠近で、遠いほど空の色へ寄せる。 */
export const DAWN_PETAL_TINT = [0.93, 0.62, 0.68] as const;

/**
 * 前景ボケ。紙のすぐ手前を横切る、ピントの外れた大きな花弁。
 * 3D の花弁とは別に、ごく少数だけ置く（明るさを足さず、影として薄く）。
 */
export type BokehPetal = {
  index: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  driftX: number;
  driftY: number;
  seconds: number;
  phase: number;
};

export function createBokehPetals(count: number, seed = 0x9a1c): BokehPetal[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    index,
    x: random() * 1.3 - 0.65,
    y: random() * 1.3 - 0.65,
    size: 0.18 + random() * 0.24,
    opacity: 0.05 + random() * 0.05,
    driftX: (random() - 0.5) * 0.1,
    driftY: (random() - 0.5) * 0.06 + 0.03,
    seconds: 22 + random() * 26,
    phase: random() * Math.PI * 2,
  }));
}
