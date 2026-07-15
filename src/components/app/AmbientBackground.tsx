import { useMemo } from "react";
import type { AmbientIntensity } from "../../types";

export type AmbientMode = "yakou" | "shokou";

type AmbientItem = {
  delay: number;
  drift: number;
  duration: number;
  hue: number;
  index: number;
  left: number;
  size: number;
};

type AmbientBackgroundProps = {
  intensity: AmbientIntensity;
  mode: AmbientMode;
};

const COUNT_BY_MODE: Record<AmbientMode, number> = {
  shokou: 46,
  yakou: 52,
};

const INTENSITY_MULTIPLIER: Record<AmbientIntensity, number> = {
  dramatic: 1.7,
  normal: 1,
  off: 0,
  subtle: 0.4,
};

const INTENSITY_DURATION_SCALE: Record<AmbientIntensity, number> = {
  dramatic: 1.35,
  normal: 1,
  off: 1,
  subtle: 0.85,
};

const INTENSITY_SIZE_SCALE: Record<AmbientIntensity, number> = {
  dramatic: 1.3,
  normal: 1,
  off: 1,
  subtle: 0.75,
};

function generateItems(
  mode: AmbientMode,
  intensity: AmbientIntensity,
): AmbientItem[] {
  const baseCount = COUNT_BY_MODE[mode];
  const count = Math.max(
    0,
    Math.round(baseCount * INTENSITY_MULTIPLIER[intensity]),
  );
  const sizeScale = INTENSITY_SIZE_SCALE[intensity];
  const durationScale = INTENSITY_DURATION_SCALE[intensity];
  return Array.from({ length: count }, (_, index) => {
    const seed = (index * 137.5 + 42) % 360;
    switch (mode) {
      case "yakou":
        {
          // 紫〜藍〜青緑。アクセント (#a090ff) と副色 teal の宇宙帯。
          const hueBand = [248, 258, 268, 232, 196][index % 5];
          const hueOffset = (seed % 14) - 7;
          return {
            delay: -((seed * 1.7 + index * 2.3) % 24),
            drift: ((seed * 0.9 + index * 2.7) % 14) - 7,
            duration: (18 + (seed % 8) * 2) * durationScale,
            hue: hueBand + hueOffset,
            index,
            left: ((seed * 1.618 + index * 7) % 100),
            size: Math.max(1, (1.8 + (seed % 5) * 0.65) * sizeScale),
          };
        }
      case "shokou":
        {
          // 夜明けの影粒子: 青灰帯にごく薄い暖色を混ぜる
          const hueBand = [214, 220, 228, 236, 28][index % 5];
          const hueOffset = (seed % 12) - 6;
          const shokouSizeScale =
            intensity === "dramatic" ? sizeScale * 0.82 : sizeScale;
          return {
            delay: -((seed * 2.1 + index * 1.3) % 18),
            drift: ((seed * 0.5 + index * 4.1) % 18) - 9,
            duration: (15 + (seed % 7) * 1.6) * durationScale,
            hue: hueBand + hueOffset,
            index,
            left: ((seed * 1.618 + index * 7) % 100),
            size: Math.max(1, (1.8 + (seed % 5) * 0.65) * shokouSizeScale),
          };
        }
    }
  });
}

function modeClass(mode: AmbientMode): string {
  return `ambient ambient-${mode}`;
}

export function AmbientBackground({
  intensity,
  mode,
}: AmbientBackgroundProps) {
  const items = useMemo(
    () => generateItems(mode, intensity),
    [mode, intensity],
  );
  if (intensity === "off" || items.length === 0) {
    return null;
  }
  return (
    <div className={modeClass(mode)} aria-hidden="true">
      {items.map((item) => {
        // 曙光の暖色帯は暗い影粒子ではなく ember として描く
        const isEmber = mode === "shokou" && item.hue < 60;
        return (
          <span
            className={
              isEmber ? "ambient-particle ambient-ember" : "ambient-particle"
            }
            key={item.index}
            style={{
              "--ambient-h": `${item.size}px`,
              "--ambient-w": `${item.size * 0.7}px`,
              "--ambient-hue": item.hue,
              "--ambient-drift": `${item.drift}vw`,
              "--ambient-delay": `${item.delay}s`,
              "--ambient-duration": `${item.duration}s`,
              left: `${item.left}%`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}
