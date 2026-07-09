import type { AmbientIntensity } from "../../types";

/**
 * Q-THM-1 — shared budget for joke-theme WebGL overlays.
 * Edohigan stays calm; Shinkai/CRT use these caps so "showy" themes
 * do not always run at full Retina 60fps + CSS filter loops.
 */

/** Cap for `devicePixelRatio` when sizing ambient canvases. */
export function ambientDevicePixelRatioCap(
  intensity: AmbientIntensity,
): number {
  switch (intensity) {
    case "dramatic":
      return 2;
    case "normal":
      return 1.5;
    case "subtle":
      return 1.25;
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
