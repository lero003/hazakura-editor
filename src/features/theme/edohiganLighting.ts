import type { Vec3 } from "./edohiganTree";

/**
 * 江戸彼岸の情景の「太陽」— 1 つの向きを全員が指す。
 *
 * 空の太陽は右上、木の奥にある。なのに木だけは手前左から照らされていて、
 * 逆光の縁が太陽と反対側に出ていた（＝円柱にスタジオ照明を当てたように見えた）。
 * 木・花・地面の影・光条が同じ `EDOHIGAN_SUN_DIRECTION` を共有するようにして、
 * 情景の中で光の向きが矛盾しないようにする。
 *
 * 座標系は three.js のワールド（+x = 画面右, +y = 上, +z = カメラ側）。
 * 太陽は木の奥・右上なので z は負。
 */
export const EDOHIGAN_SUN_DIRECTION: Vec3 = [0.5503, 0.5803, -0.6003];

/**
 * シェーダーへ埋め込む GLSL リテラル。JS 側と同じ値であることを
 * `edohiganLighting.test.ts` で固定する（手で 2 か所を直さない）。
 */
export const EDOHIGAN_SUN_DIRECTION_GLSL =
  `vec3(${EDOHIGAN_SUN_DIRECTION[0]}, ${EDOHIGAN_SUN_DIRECTION[1]}, ${EDOHIGAN_SUN_DIRECTION[2]})`;

/** 太陽の方向を向いた面の明るさ（0..1）。CPU 側の参照実装。 */
export function edohiganSunLight(normal: Vec3): number {
  const dot =
    normal[0] * EDOHIGAN_SUN_DIRECTION[0] +
    normal[1] * EDOHIGAN_SUN_DIRECTION[1] +
    normal[2] * EDOHIGAN_SUN_DIRECTION[2];
  return Math.min(1, Math.max(0, dot));
}
