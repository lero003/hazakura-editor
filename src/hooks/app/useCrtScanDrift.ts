import { useEffect } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * CRT の走査ドリフト / Slow convergence drift for the CRT theme.
 *
 * 旧 `useCrtMouseTracking` は `mousemove` のたびに `--crt-mx` / `--crt-my` を
 * 書き換え、`.cm-content` 全体の `text-shadow`（色収差）を再計算させていた。
 * 長い原稿では 1 回のマウス移動で本文全体が再描画になり、収束誤差の見え方も
 * ポインタに依存して落ち着かなかった。
 *
 * ここでは 500ms 間隔で `--crt-mx` だけを 47 秒周期でゆっくり動かす。ブラウン管の
 * 収束ずれは電源や地磁気で緩やかに変化するもので、マウスに追従するものではない。
 * `--crt-my` は固定（0.5）に戻し、他テーマへ持ち越さない。
 */
const DRIFT_INTERVAL_MS = 500;
const DRIFT_PERIOD_SECONDS = 47;
const DRIFT_CENTER = 0.5;
const DRIFT_AMPLITUDE = 0.42;

export function useCrtScanDrift(enabled: boolean): void {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || reducedMotion) {
      return;
    }
    const root = document.documentElement;
    const startedAt = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const drift =
        DRIFT_CENTER +
        DRIFT_AMPLITUDE *
          Math.sin((elapsed / DRIFT_PERIOD_SECONDS) * Math.PI * 2);
      root.style.setProperty("--crt-mx", drift.toFixed(3));
      root.style.setProperty("--crt-my", String(DRIFT_CENTER));
    };
    tick();
    const timer = window.setInterval(tick, DRIFT_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      // 他テーマへ持ち越さないよう中央へ戻す。
      root.style.setProperty("--crt-mx", String(DRIFT_CENTER));
      root.style.setProperty("--crt-my", String(DRIFT_CENTER));
    };
  }, [enabled, reducedMotion]);
}
