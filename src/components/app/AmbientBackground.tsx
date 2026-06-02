import { useMemo } from "react";
import type { AmbientIntensity } from "../../types";

export type AmbientMode = "sakura" | "yakou" | "shokou";

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
  sakura: 28,
  shokou: 22,
  yakou: 32,
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
      case "sakura":
        return {
          delay: -((seed * 2.3 + index * 1.9) % 20),
          drift: ((seed * 0.7 + index * 3.1) % 12) - 6,
          duration: (12 + (seed % 9) * 1.8) * durationScale,
          hue: 340 + (seed % 16) - 4,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: (8 + (seed % 7) * 1.5) * sizeScale,
        };
      case "yakou":
        return {
          delay: -((seed * 1.7 + index * 2.3) % 24),
          drift: ((seed * 0.9 + index * 2.7) % 14) - 7,
          duration: (18 + (seed % 8) * 2) * durationScale,
          hue: 200 + (seed % 30) - 6,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: Math.max(0.8, (1.5 + (seed % 4) * 0.6) * sizeScale),
        };
      case "shokou":
        return {
          delay: -((seed * 2.1 + index * 1.3) % 16),
          drift: ((seed * 0.5 + index * 4.1) % 18) - 9,
          duration: (14 + (seed % 6) * 1.4) * durationScale,
          hue: 42 + (seed % 18) - 4,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: Math.max(0.8, (2 + (seed % 5) * 0.8) * sizeScale),
        };
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
      {items.map((item) => (
        <span
          className="ambient-particle"
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
      ))}
    </div>
  );
}
