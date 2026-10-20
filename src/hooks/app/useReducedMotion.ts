import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * OS の「動きを減らす」設定を購読する / Subscribe to `prefers-reduced-motion`.
 *
 * CSS 側は `@media (prefers-reduced-motion: reduce)` で自動追従するが、
 * rAF ループを持つ canvas 演出は JS 側で止める必要がある。
 * 起動時に一度 `matchMedia` を読むだけでは、アプリを開いたまま設定を変えたときに
 * ループが回り続けるため、`change` を購読して実行中でも追従する。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const update = () => setReduced(query.matches);
    // 初期値を effect 内でも読み直す（初回描画前に OS 設定が変わった場合の保険）。
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
