import { useMemo } from "react";

type AmbientMode = "sakura" | "yakou" | "shokou" | "kouyou";

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
  mode: AmbientMode;
};

const COUNT_BY_MODE: Record<AmbientMode, number> = {
  kouyou: 24,
  sakura: 28,
  shokou: 22,
  yakou: 32,
};

function generateItems(mode: AmbientMode): AmbientItem[] {
  const count = COUNT_BY_MODE[mode];
  return Array.from({ length: count }, (_, index) => {
    const seed = (index * 137.5 + 42) % 360;
    switch (mode) {
      case "sakura":
        return {
          delay: -((seed * 2.3 + index * 1.9) % 20),
          drift: ((seed * 0.7 + index * 3.1) % 12) - 6,
          duration: 12 + (seed % 9) * 1.8,
          hue: 340 + (seed % 16) - 4,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: 8 + (seed % 7) * 1.5,
        };
      case "yakou":
        return {
          delay: -((seed * 1.7 + index * 2.3) % 24),
          drift: ((seed * 0.9 + index * 2.7) % 14) - 7,
          duration: 18 + (seed % 8) * 2,
          hue: 200 + (seed % 30) - 6,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: 1.5 + (seed % 4) * 0.6,
        };
      case "shokou":
        return {
          delay: -((seed * 2.1 + index * 1.3) % 16),
          drift: ((seed * 0.5 + index * 4.1) % 18) - 9,
          duration: 14 + (seed % 6) * 1.4,
          hue: 42 + (seed % 18) - 4,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: 2 + (seed % 5) * 0.8,
        };
      case "kouyou":
        return {
          delay: -((seed * 2.7 + index * 1.5) % 22),
          drift: ((seed * 0.6 + index * 3.7) % 16) - 8,
          duration: 16 + (seed % 7) * 1.6,
          hue: 18 + (seed % 28) - 6,
          index,
          left: ((seed * 1.618 + index * 7) % 100),
          size: 7 + (seed % 6) * 1.4,
        };
    }
  });
}

function modeClass(mode: AmbientMode): string {
  return `ambient ambient-${mode}`;
}

export function AmbientBackground({ mode }: AmbientBackgroundProps) {
  const items = useMemo(() => generateItems(mode), [mode]);
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
