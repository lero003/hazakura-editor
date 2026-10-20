import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";

/**
 * CrtMaskOverlay — 管そのものの質感を 1 枚の 2D canvas で描く。
 *
 * 旧実装は CSS の `repeating-linear-gradient` で前景スキャンラインを描き、
 * 背景の WebGL canvas は UV 空間の本数（`SCAN_LINES = 520`）で別の周期の
 * 走査線を描いていた。2 系統の周期が一致しないため、実機ではモアレ（ビート）が
 * 出て「1 本の管」に見えなかった。
 *
 * ここではデバイス px の**物理ピッチ**（3.0px）で 1 系統だけ描く。
 *   - 走査線: 3 デバイス px 周期のサイン二乗プロファイル
 *   - ハムバー: 7.3 秒周期で流れる暗い帯と細い白い芯（署名のある欠陥）
 *   - 焼き付き: 固定位置のごく薄い暗部（同じく署名）
 *   - フリッカー: 全体の輝度を ±3%（文字の opacity は動かさない）
 *   - ビネット: 端を落として視線を中央へ
 *
 * 描画は 15fps に間引く。管の質感は低速で十分で、本文の再描画を起こさない。
 * `prefers-reduced-motion` と `intensity === "off"` では描かない。
 */

type CrtMaskOverlayProps = {
  intensity: AmbientIntensity;
};

/** 走査線の物理ピッチ（デバイス px）。1 系統だけにする基準値。 */
export const CRT_SCANLINE_PITCH_DEVICE_PX = 3;
/** ハムバーの周期（秒）。 */
export const CRT_HUM_PERIOD_SECONDS = 7.3;
/** マスク層の描画間隔（ms）。 */
export const CRT_MASK_FRAME_INTERVAL_MS = 1000 / 15;

/* 走査線は 0.30 だと画面全体が暗いフィルムに見えたため、蛍光ブルームと
   ガラス反射を足したぶんだけ 0.24 へ下げ、管の明るさを残す。 */
const SCANLINE_ALPHA = 0.24;
/** 走査戻り（ハムバー）の暗い帯。管では明るい帯だが、文字の上の明るみは
    コントラストを下げるため、暗い帯＋細い芯だけで表現する。 */
const HUM_DARK_ALPHA = 0.07;
/** ハムバーの細い芯。通過した局所の画素は明るくなる。
    S10 でグリルとブルームを足したため、走査戻りの芯だけ少し強くする。 */
const HUM_CORE_ALPHA = 0.16;
/** 焼き付きは蛍光体の劣化なので暗い染みとして置く。 */
const BURN_ALPHA = 0.05;
const FLICKER_ALPHA = 0.03;
const FLICKER_RATE_HZ = 0.7;
const VIGNETTE_ALPHA = 0.42;

export function CrtMaskOverlay({ intensity }: CrtMaskOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();
  const active = intensity !== "off";

  useEffect(() => {
    if (!active || reducedMotion) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    // 走査線はタイル 1 枚をパターン化して塗る（行ごとの fillRect を避ける）。
    const tile = document.createElement("canvas");
    tile.width = 1;
    tile.height = CRT_SCANLINE_PITCH_DEVICE_PX * 2;
    const tileContext = tile.getContext("2d");
    if (tileContext) {
      for (let y = 0; y < tile.height; y += 1) {
        const phase =
          (y / CRT_SCANLINE_PITCH_DEVICE_PX) * Math.PI -
          Math.PI / 2;
        const profile = Math.sin(phase) ** 2;
        tileContext.fillStyle = `rgba(0, 0, 0, ${(SCANLINE_ALPHA * profile).toFixed(3)})`;
        tileContext.fillRect(0, y, 1, 1);
      }
    }
    const scanlinePattern = context.createPattern(tile, "repeat");

    const resize = () => {
      // 走査線のピッチをデバイス px で一定に保つため、DPR をそのまま使う
      // （品質段による解像度の間引きはここでは行わない）。
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(window.innerWidth * dpr));
      const height = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let running = !document.hidden && document.hasFocus();
    let timer = 0;
    let lastFrameAt = performance.now();
    let elapsedMs = 0;

    const draw = () => {
      if (!running) {
        return;
      }
      const width = canvas.width;
      const height = canvas.height;
      const now = performance.now();
      // 非表示・非アクティブの時間を除き、復帰でハムバーを初期位置へ戻さない。
      elapsedMs += Math.max(0, now - lastFrameAt);
      lastFrameAt = now;
      const elapsed = elapsedMs / 1000;
      context.clearRect(0, 0, width, height);

      // 1. 走査線（デバイス px ピッチ）
      if (scanlinePattern) {
        context.fillStyle = scanlinePattern;
        context.fillRect(0, 0, width, height);
      }

      // 2. ハムバー（走査戻り）: ゆっくり流れる暗い帯 + 1px の芯。
      const humY = ((elapsed / CRT_HUM_PERIOD_SECONDS) % 1) * height;
      const humHeight = Math.max(24, height * 0.06);
      const humGradient = context.createLinearGradient(
        0,
        humY - humHeight,
        0,
        humY + humHeight,
      );
      humGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      humGradient.addColorStop(0.5, `rgba(0, 0, 0, ${HUM_DARK_ALPHA})`);
      humGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = humGradient;
      context.fillRect(0, humY - humHeight, width, humHeight * 2);
      const coreHeight = Math.max(
        1,
        Math.round((window.devicePixelRatio || 1) * 0.5),
      );
      context.fillStyle = `rgba(255, 255, 255, ${HUM_CORE_ALPHA})`;
      context.fillRect(0, Math.round(humY), width, coreHeight);

      // 3. 焼き付き: 同じ位置に残る薄い暗部（署名のある欠陥）
      const burn = context.createRadialGradient(
        width * 0.72,
        height * 0.34,
        0,
        width * 0.72,
        height * 0.34,
        Math.max(width, height) * 0.18,
      );
      burn.addColorStop(0, `rgba(0, 0, 0, ${BURN_ALPHA})`);
      burn.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = burn;
      context.fillRect(0, 0, width, height);

      // 4. ビネット: 端を落とす
      const vignette = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.32,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72,
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, `rgba(0, 0, 0, ${VIGNETTE_ALPHA})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      // 5. フリッカー: 管全体の明滅（文字の opacity は動かさない）
      const flicker =
        0.5 + 0.5 * Math.sin(elapsed * FLICKER_RATE_HZ * Math.PI * 2);
      context.fillStyle = `rgba(0, 0, 0, ${(FLICKER_ALPHA * flicker).toFixed(4)})`;
      context.fillRect(0, 0, width, height);

      timer = window.setTimeout(draw, CRT_MASK_FRAME_INTERVAL_MS);
    };
    if (running) {
      draw();
    }

    const pause = () => {
      running = false;
      window.clearTimeout(timer);
    };
    const resume = () => {
      if (document.hidden || !document.hasFocus()) {
        pause();
        return;
      }
      if (!running) {
        running = true;
        lastFrameAt = performance.now();
        draw();
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("blur", pause);

    return () => {
      pause();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("blur", pause);
    };
  }, [active, reducedMotion]);

  if (!active) {
    return null;
  }

  return (
    <>
      <canvas className="crt-mask" ref={canvasRef} aria-hidden="true" />
      <div className="crt-glass" aria-hidden="true" />
    </>
  );
}
