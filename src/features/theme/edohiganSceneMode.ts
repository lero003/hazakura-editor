/**
 * 江戸彼岸の three.js 情景レイヤーを有効にするか / Spike switch.
 *
 * 既定は **無効**。既存の CSS 版（`EdohiganAmbient`）が正で、three.js 版は
 * 明示的に有効化したときだけ載る。ビルド時に固定したい場合は
 * `VITE_HAZAKURA_EDOHIGAN_SCENE=1`、実行時に見たい場合は `?edohigan3d=1`。
 *
 * このフラグが false のとき、`three` のチャンクは読み込まれない
 * （`EdohiganThreeAmbient` 内の動的 import が走らないため）。
 */
export function edohiganSceneEnabled(search?: string): boolean {
  if (import.meta.env.VITE_HAZAKURA_EDOHIGAN_SCENE === "1") {
    return true;
  }
  const query = search ?? (typeof window === "undefined" ? "" : window.location.search);
  return new URLSearchParams(query).get("edohigan3d") === "1";
}
