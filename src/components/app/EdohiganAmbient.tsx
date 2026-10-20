import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AmbientIntensity } from "../../types";
import { createPetalSeeds } from "../../features/theme/petalSeeds";

/** Bundled botanical artwork.
 *
 * 動きは CSS アニメーションだけで完結させ、per-frame JavaScript と WebGL は
 * 使わない（このテーマの既存判断）。強度・OS の reduced-motion・非表示には
 * CSS と visibility で即時に追従する。
 *
 * 花弁ごとの深度・周期・位相は決定論的な純関数 `createPetalSeeds` が決め、
 * ここでは CSS 変数として渡すだけにする。個々の揺れの下には共通の「風」
 * （`.edohigan-petals` の 1 アニメーション）があり、花弁は同じ風に乗って
 * それぞれの位相で応える。
 */
export function EdohiganAmbient({ intensity }: { intensity: AmbientIntensity }) {
  const [paused, setPaused] = useState(() => document.hidden);
  const active = intensity !== "off";
  const seeds = useMemo(() => createPetalSeeds(intensity), [intensity]);

  useEffect(() => {
    if (!active) return;
    const update = () => setPaused(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [active]);

  if (!active) return null;

  return (
    <div className="edohigan-ambient" data-intensity={intensity} data-paused={paused} aria-hidden="true">
      <div className="edohigan-branch" />
      <div className="edohigan-petals">
        {seeds.map((seed) => (
          <span
            className="edohigan-petal"
            key={seed.index}
            data-depth={seed.depth}
            style={{
              left: `${seed.leftPercent}%`,
              "--petal-size": `${seed.sizePx}px`,
              "--petal-opacity": seed.opacity,
              "--petal-blur": `${seed.blurPx}px`,
              "--petal-fall": `${seed.fallSeconds}s`,
              "--petal-fall-delay": `${seed.fallDelaySeconds}s`,
              "--petal-sway": `${seed.swaySeconds}s`,
              "--petal-sway-delay": `${seed.swayDelaySeconds}s`,
              "--petal-sway-x": `${seed.swayPx}px`,
              "--petal-roll": `${seed.rollDeg}deg`,
              "--petal-flip": `${seed.flipSeconds}s`,
            } as CSSProperties}
          >
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}
