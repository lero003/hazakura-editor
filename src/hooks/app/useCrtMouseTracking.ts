import { useEffect } from "react";

/**
 * CRT テーマ用: mousemove を CSS 変数 (--crt-mx / --crt-my) に変換する。
 * 0..1 に正規化したマウス座標を :root に書き込み、crt-theme.css の
 * text-shadow 色収差とビネットがマウスで悪化するようにする。
 *
 * - enabled && !prefers-reduced-motion のときだけリスナを起動。
 * - rAF スロットルで書き込み頻度を抑える。
 * - クリーンアップで変数を中央値 (0.5) に戻し、他テーマへ持ち越さない。
 */
export function useCrtMouseTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const root = document.documentElement;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) {
        return;
      }
      const { x, y } = pending;
      pending = null;
      root.style.setProperty("--crt-mx", x.toFixed(3));
      root.style.setProperty("--crt-my", y.toFixed(3));
    };

    const onMove = (event: MouseEvent) => {
      pending = {
        x: event.clientX / Math.max(window.innerWidth, 1),
        y: event.clientY / Math.max(window.innerHeight, 1),
      };
      if (frame === 0) {
        frame = window.requestAnimationFrame(flush);
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      // 他テーマへ持ち越さないよう中央値に戻す
      root.style.setProperty("--crt-mx", "0.5");
      root.style.setProperty("--crt-my", "0.5");
    };
  }, [enabled]);
}
