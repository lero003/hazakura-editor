import type { AmbientIntensity } from "../../types";

/**
 * Q-THM-1 — shared budget for joke-theme WebGL overlays.
 * Edohigan stays calm; Shinkai/CRT use these caps so "showy" themes
 * do not always run at full Retina 60fps + CSS filter loops.
 *
 * 実機フィードバック（第2弾）: 抑えすぎで「攻めたテーマなのにつまらない」と感じられたため、
 * DPR cap を**一段だけ**戻す（描画の解像度＝背景の締まり。フレーム間引きは据え置き＝
 * 負荷の主因は動かさない）。CSS filter を使わない方針は維持する。
 */

/** Cap for `devicePixelRatio` when sizing ambient canvases. */
export function ambientDevicePixelRatioCap(
  intensity: AmbientIntensity,
): number {
  switch (intensity) {
    case "dramatic":
      return 2;
    case "normal":
      return 2;
    case "subtle":
      return 1.5;
    case "off":
    default:
      return 1;
  }
}

/**
 * Minimum milliseconds between WebGL draws. `0` means every rAF tick
 * (display refresh). Lower intensities throttle to reduce GPU heat.
 */
export function ambientMinFrameIntervalMs(
  intensity: AmbientIntensity,
): number {
  switch (intensity) {
    case "dramatic":
      return 0;
    case "normal":
      return 1000 / 30;
    case "subtle":
      return 1000 / 24;
    case "off":
    default:
      return 1000 / 24;
  }
}

export function resolveAmbientDevicePixelRatio(
  intensity: AmbientIntensity,
  devicePixelRatio: number = typeof window !== "undefined"
    ? window.devicePixelRatio || 1
    : 1,
): number {
  return Math.min(devicePixelRatio, ambientDevicePixelRatioCap(intensity));
}
