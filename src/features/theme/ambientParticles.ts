import type { AmbientIntensity } from "../../types";

/**
 * 夜光 / 曙光のアンビエント粒子モデル / Ambient particle model.
 *
 * 旧実装は 46〜52 個の DOM 要素を `will-change` 付きで個別に CSS アニメーション
 * させていた。粒ごとの奥行き・明滅・共通の風を持てず、「動く壁紙」に見えていた。
 * ここでは 1 枚の canvas に描くための決定論的な粒子モデルを純関数として持ち、
 * 描画側（AmbientBackground）は時間 `t` を与えて位置と不透明度を受け取るだけにする。
 *
 * 設計:
 *   - 粒は 3 つの手掛かりで奥行きを持つ: 半径・明るさ・速さ（手前ほど大きい・明るい・速い）
 *   - すべての粒が同じ風 `ambientWind(t)` に乗る（個別のランダムウォークにしない）
 *   - 明滅はゆっくり（2.4〜6.0s）。星は強め、埃は弱め
 *   - 上昇は決定的な周期運動。周期は非整数比で、全体が同期しない
 *   - 配置は黄金比の stride ＋ わずかなゆらぎ（層化サンプリング相当）
 */

export type AmbientParticleMode = "yakou" | "shokou";

export type AmbientParticleSeed = {
  index: number;
  /** 0=奥, 1=手前。 */
  depth: number;
  /** 加算合成で光らせる粒（夜光の星、曙光の ember）か。 */
  glow: boolean;
  hue: number;
  radiusPx: number;
  /** 画面幅比の基準位置と揺れ幅。 */
  baseX: number;
  swayX: number;
  swayCycles: number;
  periodSeconds: number;
  phase: number;
  twinkleSeconds: number;
  twinklePhase: number;
  /** 明滅の深さ（0=明滅なし, 1=最小で消える）。 */
  twinkleDepth: number;
  alphaScale: number;
};

export type AmbientParticleFrame = {
  x: number;
  y: number;
  radiusPx: number;
  alpha: number;
};

export const AMBIENT_PARTICLE_COUNT: Record<AmbientParticleMode, number> = {
  shokou: 46,
  yakou: 52,
};

/** 上限。dramatic でも描画枚数が跳ねないようにする。 */
export const AMBIENT_PARTICLE_MAX = 96;

const HUE_BANDS: Record<AmbientParticleMode, number[]> = {
  // 紫〜藍〜青緑（アクセント #a090ff と副色 teal の宇宙帯）
  yakou: [248, 258, 268, 232, 196],
  // 夜明けの青灰帯に、ごく少数の暖色（ember）を混ぜる
  shokou: [214, 220, 228, 236, 28],
};

const INTENSITY_MULTIPLIER: Record<AmbientIntensity, number> = {
  dramatic: 1.7,
  normal: 1,
  subtle: 0.4,
  off: 0,
};

const INTENSITY_SIZE_SCALE: Record<AmbientIntensity, number> = {
  dramatic: 1.3,
  normal: 1,
  subtle: 0.75,
  off: 0,
};

/**
 * 強度は「動きの速さ」に効く。旧実装は dramatic で **遅く** なっており、
 * 「強い＝多い・速い・明るい」という物理と逆だったので反転した。
 */
const INTENSITY_SPEED_SCALE: Record<AmbientIntensity, number> = {
  dramatic: 1.25,
  normal: 1,
  subtle: 0.85,
  off: 1,
};

const MODE_PROFILE: Record<
  AmbientParticleMode,
  {
    basePeriodSeconds: number;
    periodJitterSeconds: number;
    radiusBase: number;
    radiusDepth: number;
    alphaScale: number;
    twinkleDepth: number;
    sizeScale: number;
  }
> = {
  yakou: {
    basePeriodSeconds: 18,
    periodJitterSeconds: 8,
    radiusBase: 1.1,
    radiusDepth: 2.2,
    alphaScale: 0.88,
    twinkleDepth: 0.25,
    sizeScale: 1,
  },
  shokou: {
    basePeriodSeconds: 15,
    periodJitterSeconds: 6,
    radiusBase: 1,
    radiusDepth: 1.7,
    alphaScale: 0.48,
    twinkleDepth: 0.15,
    // 曙光の埃は夜光の星より小さい（実機の見え方を維持）。
    sizeScale: 0.86,
  },
};

/** 決定的な 32bit PRNG。同じ index からは常に同じ粒が得られる。 */
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

function fract(value: number): number {
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * 共通の風 / shared wind. すべての粒がこの 1 つの場に乗る。
 * 2 つの低周波成分の和で、範囲はほぼ [-1, 1]。
 */
export function ambientWind(t: number): number {
  return 0.65 * Math.sin(t * 0.13) + 0.35 * Math.sin(t * 0.047 + 1.7);
}

export function createAmbientParticleSeeds(
  mode: AmbientParticleMode,
  intensity: AmbientIntensity,
): AmbientParticleSeed[] {
  const profile = MODE_PROFILE[mode];
  const count = Math.min(
    AMBIENT_PARTICLE_MAX,
    Math.max(0, Math.round(AMBIENT_PARTICLE_COUNT[mode] * INTENSITY_MULTIPLIER[intensity])),
  );
  const sizeScale = INTENSITY_SIZE_SCALE[intensity] * profile.sizeScale;
  const speedScale = INTENSITY_SPEED_SCALE[intensity];
  const bands = HUE_BANDS[mode];

  return Array.from({ length: count }, (_, index) => {
    const random = mulberry32(0x85ebca6b ^ Math.imul(index + 1, 2654435761));
    const band = bands[index % bands.length];
    const hueJitter = (random() - 0.5) * (mode === "yakou" ? 14 : 12);
    // 奥行きは黄金比で層化する（一様乱数のムラを作らない）。
    const depth = fract(index * 0.6180339887 + random() * 0.06);
    const periodSeconds =
      ((profile.basePeriodSeconds + random() * profile.periodJitterSeconds) /
        speedScale) *
      (1.45 - 0.6 * depth);
    return {
      index,
      depth,
      glow: mode === "yakou" || band < 60,
      hue: band + hueJitter,
      radiusPx: Math.max(
        0.6,
        (profile.radiusBase + profile.radiusDepth * depth) * sizeScale,
      ),
      baseX: fract(index * 0.6180339887 + random() * 0.05),
      swayX: 0.004 + 0.012 * depth,
      swayCycles: 0.5 + random() * 1.5,
      periodSeconds,
      phase: random(),
      twinkleSeconds: 2.4 + random() * 3.6,
      twinklePhase: random(),
      twinkleDepth: profile.twinkleDepth,
      alphaScale: profile.alphaScale,
    };
  });
}

/**
 * 時刻 `t` での粒の位置・半径・不透明度。
 * 描画は CSS px 空間で行うため、`width` / `height` も CSS px で渡す。
 */
export function sampleAmbientParticle(
  seed: AmbientParticleSeed,
  t: number,
  width: number,
  height: number,
  pointerOffsetPx = 0,
): AmbientParticleFrame {
  const margin = 24;
  const u = fract(seed.phase + t / seed.periodSeconds);
  const y = (1 - u) * (height + margin * 2) - margin;
  const sway =
    Math.sin((u * seed.swayCycles + seed.phase) * Math.PI * 2) * seed.swayX;
  // 手前の粒ほど風と視差の影響を強く受ける。
  const wind = ambientWind(t + seed.phase * 7) * 0.006 * (0.3 + seed.depth);
  const x =
    (seed.baseX + sway + wind) * width + pointerOffsetPx * (0.3 + seed.depth);
  const fadeIn = smoothstep(0, 0.1, u);
  const fadeOut = 1 - smoothstep(0.86, 1, u);
  // 明滅: 0.5+0.5sin を [1 - depth, 1] に写す。星は強め、埃は弱め。
  const twinkleWave =
    0.5 + 0.5 * Math.sin((t / seed.twinkleSeconds + seed.twinklePhase) * Math.PI * 2);
  const twinkle = 1 - seed.twinkleDepth * (1 - twinkleWave);
  const depthAlpha = 0.22 + 0.7 * seed.depth;
  return {
    x,
    y,
    radiusPx: seed.radiusPx,
    alpha: Math.min(
      1,
      depthAlpha * seed.alphaScale * fadeIn * fadeOut * twinkle,
    ),
  };
}
