import { useEffect, useState, type CSSProperties } from "react";
import type { AmbientIntensity } from "../../types";

const PETAL_COUNT: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 4,
  normal: 8,
  dramatic: 14,
};

/** Bundled botanical artwork; only small transform/opacity layers move.
 * No full-window shader or per-frame JavaScript. CSS responds to reduced motion
 * immediately, including when the OS preference changes while the app is open.
 */
export function EdohiganAmbient({ intensity }: { intensity: AmbientIntensity }) {
  const [paused, setPaused] = useState(() => document.hidden);
  const active = intensity !== "off";

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
        {Array.from({ length: PETAL_COUNT[intensity] }, (_, index) => (
          <span className="edohigan-petal" key={index} style={{
            left: `${(index * 61.8 + 11) % 100}%`,
            "--petal-size": `${24 + index % 4 * 5}px`,
            "--petal-duration": `${32 + index % 5 * 7}s`,
            "--petal-delay": `${-index * 7.3 - 8}s`,
            "--petal-drift": `${index % 2 ? -80 : 110}px`,
            "--petal-turn": `${index * 47}deg`,
          } as CSSProperties}><i /></span>
        ))}
      </div>
    </div>
  );
}
