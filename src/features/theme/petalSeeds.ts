import type { AmbientIntensity } from "../../types";

/**
 * 江戸彼岸の花弁のパラメータ / Edohigan petal parameters.
 *
 * 花弁の運動そのものは CSS アニメーションで駆動する（このテーマは
 * 「per-frame JavaScript を使わない」という既存判断を維持する）。
 * ここが決めるのは、深度ごとの見え方と、ループが同期して見えないための
 * 非整数比の周期・位相だけ。乱数はインデックスから決まる決定論的な
 * PRNG なので、同じ強度なら常に同じ配置になり、テストで固定できる。
 *
 * 設計:
 *   - 3 深度（near / mid / far）で サイズ・不透明度・blur・速さ を段階化
 *     （空気遠近。遠い花弁ほど小さく淡く、わずかにぼけ、ゆっくり落ちる）
 *   - 落下は終端速度（CSS 側の `linear()` 近似）
 *   - 横揺れと回転は同じ周期・同じ位相（回転は横速度に由来する）
 *   - 周期は互いに非整数比にして、全体が同期して見えないようにする
 */

export type PetalDepth = "near" | "mid" | "far";

export type PetalSeed = {
  index: number;
  depth: PetalDepth;
  /** 花弁の中心の水平位置（%）。 */
  leftPercent: number;
  sizePx: number;
  opacity: number;
  blurPx: number;
  /** 1 回の落下にかける秒数。 */
  fallSeconds: number;
  /** 負の delay。最初から落下の途中にいる状態で始める。 */
  fallDelaySeconds: number;
  swaySeconds: number;
  swayDelaySeconds: number;
  swayPx: number;
  rollDeg: number;
  flipSeconds: number;
};

/* S10: 8 枚では「窓の端に数枚」に見えたため、通常 14・強 22 へ増やす。
   中央のテキストカラムは mask で外したまま、左右の余白に厚みを出す。 */
export const PETAL_COUNT: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 6,
  normal: 14,
  dramatic: 22,
};

const DEPTH_ORDER: PetalDepth[] = ["near", "mid", "far"];

const DEPTH_PROFILE: Record<
  PetalDepth,
  {
    sizePx: number;
    opacity: number;
    blurPx: number;
    speed: number;
    swayPx: number;
    rollDeg: number;
  }
> = {
  near: { sizePx: 40, opacity: 0.72, blurPx: 0, speed: 1, swayPx: 28, rollDeg: 17 },
  mid: { sizePx: 30, opacity: 0.55, blurPx: 0.5, speed: 0.82, swayPx: 21, rollDeg: 13 },
  far: { sizePx: 22, opacity: 0.38, blurPx: 1.2, speed: 0.64, swayPx: 15, rollDeg: 9 },
};

/** 強度は「数」だけでなく「濃さ」にも効く（dramatic は少し濃い）。 */
const INTENSITY_OPACITY: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0.7,
  normal: 1,
  dramatic: 1.25,
};

const MAX_PETAL_OPACITY = 0.8;

/** 決定的な 32bit PRNG。同じ index からは常に同じ花弁が得られる。 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPetalSeeds(intensity: AmbientIntensity): PetalSeed[] {
  const count = PETAL_COUNT[intensity];
  const opacityScale = INTENSITY_OPACITY[intensity];
  return Array.from({ length: count }, (_, index) => {
    const random = mulberry32(0x9e3779b9 ^ Math.imul(index + 1, 2654435761));
    const depth = DEPTH_ORDER[index % DEPTH_ORDER.length];
    const profile = DEPTH_PROFILE[depth];
    // 落下・揺れ・裏返しの周期は互いに非整数比。同じ組み合わせを避ける。
    const fallSeconds = (34 + ((index * 5.7) % 24)) / profile.speed;
    const swaySeconds = 7.4 + ((index * 2.3) % 5.1);
    const flipSeconds = 11.3 + ((index * 3.1) % 6.7);
    return {
      index,
      depth,
      leftPercent: (index * 61.8 + 9 + random() * 6) % 100,
      sizePx: Math.round(profile.sizePx * (0.92 + random() * 0.16)),
      opacity: Math.min(
        MAX_PETAL_OPACITY,
        profile.opacity * opacityScale,
      ),
      blurPx: profile.blurPx,
      fallSeconds,
      fallDelaySeconds: -(random() * fallSeconds),
      swaySeconds,
      swayDelaySeconds: -(random() * swaySeconds),
      swayPx: profile.swayPx * (0.85 + random() * 0.3),
      rollDeg: profile.rollDeg * (0.8 + random() * 0.4),
      flipSeconds,
    };
  });
}
