/**
 * 江戸彼岸の three.js 情景レイヤーを有効にするか。
 *
 * v3.4.1 から **既定で有効**。江戸彼岸を選ぶと、奥の夜明け（空・陽・遠景の花）と
 * 手前の枝・花弁が three.js で描かれる。無効にしたいときだけ明示する:
 *   - 実行時: `?edohigan3d=0`
 *   - ビルド時: `VITE_HAZAKURA_EDOHIGAN_SCENE=0`
 *
 * WebGL2 が無い環境では、各コンポーネントが CSS 版へ戻る
 * （紙は不透明のまま＝v3.4.0 までの見た目）。
 */
export function edohiganSceneEnabled(search?: string): boolean {
  const env = import.meta.env.VITE_HAZAKURA_EDOHIGAN_SCENE;
  if (env === "0" || env === "off") {
    return false;
  }
  const query = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const flag = new URLSearchParams(query).get("edohigan3d");
  return flag !== "0" && flag !== "off";
}
