import type { AmbientIntensity } from "../../types";

/**
 * 演出の品質段 / ambient quality tier.
 *
 * Q-THM-1 の DPR cap とフレーム間引きを「強度」から「実測フレーム時間」へ広げる。
 * 強度はユーザーが選ぶ見た目の上限（base tier）で、実際に描く段は
 * 端末の余力に応じて base tier から 3（30fps / DPR 1）までの範囲で下がる。
 * base tier より上へは戻さない（選んだ強度を超えて重くしない）。
 *
 *   0 = dramatic 相当（毎フレーム / DPR 2）
 *   1 = normal 相当（60fps / DPR 2）
 *   2 = subtle 相当（30fps / DPR 1.5）
 *   3 = 低解像度（30fps / DPR 1、rAF の計測は継続）
 */
export type AmbientQualityTier = 0 | 1 | 2 | 3;

export type AmbientQualityState = {
  tier: AmbientQualityTier;
  baseTier: AmbientQualityTier;
  emaMs: number;
  framesAbove: number;
  framesBelow: number;
};

/** 降格のしきい値（これより遅い状態が続いたら一段落とす）。 */
export const AMBIENT_DOWNGRADE_EMA_MS = 20;
export const AMBIENT_DOWNGRADE_FRAMES = 90;
/** 昇格のしきい値（十分速い状態が長く続いたときだけ一段戻す）。 */
// 60Hz の rAF は約16.7ms。12msでは安定しても降格から戻れない。
export const AMBIENT_UPGRADE_EMA_MS = 18;
export const AMBIENT_UPGRADE_FRAMES = 600;

/** EMA の平滑化係数。1 フレームの跳ねで段を落とさない程度に鈍くする。 */
const EMA_ALPHA = 0.05;
/** EMA に取り込む 1 フレームの上限。タブ復帰の巨大な差分で平均を汚さない。 */
const EMA_FRAME_MS_CLAMP = 250;

const DPR_CAP_BY_TIER: Record<AmbientQualityTier, number> = {
  0: 2,
  1: 2,
  2: 1.5,
  3: 1,
};

const FRAME_INTERVAL_BY_TIER: Record<AmbientQualityTier, number> = {
  0: 0,
  1: 1000 / 60,
  2: 1000 / 30,
  3: 1000 / 30,
};

export function baseAmbientQualityTier(
  intensity: AmbientIntensity,
): AmbientQualityTier {
  switch (intensity) {
    case "dramatic":
      return 0;
    case "normal":
      return 1;
    case "subtle":
      return 2;
    case "off":
    default:
      return 3;
  }
}

export function ambientQualityDprCap(tier: AmbientQualityTier): number {
  return DPR_CAP_BY_TIER[tier];
}

export function ambientQualityFrameIntervalMs(tier: AmbientQualityTier): number {
  return FRAME_INTERVAL_BY_TIER[tier];
}

/** 60fps 相当を初期値にする。最初の数フレームで段を動かさない。 */
export function initialAmbientQualityState(
  intensity: AmbientIntensity,
): AmbientQualityState {
  const baseTier = baseAmbientQualityTier(intensity);
  return {
    tier: baseTier,
    baseTier,
    emaMs: 1000 / 60,
    framesAbove: 0,
    framesBelow: 0,
  };
}

export function blendAmbientFrameTime(
  previousEmaMs: number,
  frameMs: number,
): number {
  if (!Number.isFinite(frameMs) || frameMs <= 0) {
    return previousEmaMs;
  }
  const clamped = Math.min(frameMs, EMA_FRAME_MS_CLAMP);
  return previousEmaMs + (clamped - previousEmaMs) * EMA_ALPHA;
}

/**
 * 1 フレーム分の実測を取り込み、次の段を返す。
 * 遅い状態が続けば落とし、速い状態が長く続けば base tier まで戻す。
 */
export function updateAmbientQuality(
  state: AmbientQualityState,
  frameMs: number,
): AmbientQualityState {
  const emaMs = blendAmbientFrameTime(state.emaMs, frameMs);
  let tier = state.tier;
  let framesAbove = state.framesAbove;
  let framesBelow = state.framesBelow;

  if (emaMs > AMBIENT_DOWNGRADE_EMA_MS) {
    framesAbove += 1;
    framesBelow = 0;
    if (framesAbove >= AMBIENT_DOWNGRADE_FRAMES && tier < 3) {
      tier = (tier + 1) as AmbientQualityTier;
      framesAbove = 0;
    }
  } else if (emaMs < AMBIENT_UPGRADE_EMA_MS) {
    framesBelow += 1;
    framesAbove = 0;
    if (framesBelow >= AMBIENT_UPGRADE_FRAMES && tier > state.baseTier) {
      tier = (tier - 1) as AmbientQualityTier;
      framesBelow = 0;
    }
  } else {
    // 安定帯。単発の速い/遅いフレームで段が動かないようカウンタを戻す。
    framesAbove = 0;
    framesBelow = 0;
  }

  return { tier, baseTier: state.baseTier, emaMs, framesAbove, framesBelow };
}
