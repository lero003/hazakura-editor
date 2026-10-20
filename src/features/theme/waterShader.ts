/**
 * 深海の水を描く共通 GLSL / Shared water shading chunks.
 *
 * `ShinkaiShaderOverlay`（通常画面）と `ShinkaiBootSequence`（起動演出）は
 * 同じ海を描く。以前は浅い/深いの色とノイズ関数を両ファイルに写して持っており、
 * 「変更時は両方を更新する」というコメントで同期を促していた。
 * ここへ集約し、両者が同じ関数・同じ定数を import する。
 *
 * 安全上の前提（docs/security-boundary.md）:
 *   - 外部テクスチャ / shader の fetch はしない。すべてプロシージャル。
 *   - `blob:` を生成しないので CSP 変更は不要。
 */

/** 水面近くの色。 */
export const SHALLOW_WATER_COLOR = "vec3(0.12, 0.38, 0.46)";
/** 深部の色。 */
export const DEEP_WATER_COLOR = "vec3(0.015, 0.09, 0.16)";
/**
 * 波長ごとの吸収係数（赤が最も速く落ちる）。Beer–Lambert の指数に使う。
 */
export const WATER_ABSORPTION = "vec3(1.10, 0.35, 0.22)";

/**
 * 2D ハッシュと値ノイズ。プロシージャルで外部テクスチャを持たない。
 * 両シェーダーが同じ質感になるよう 1 箇所に置く。
 */
export const WATER_NOISE_GLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
`;

/**
 * 深さによる水の色。線形の mix ではなく、赤から先に落ちる指数減衰にする。
 * 浅い側の明るさは保ち、深部だけが青へ沈む。
 */
export const WATER_DEPTH_TINT_GLSL = `
vec3 waterDepthTint(float uvY, vec3 shallow, vec3 deep) {
  float depth = 1.0 - uvY;
  vec3 attenuation = exp(-${WATER_ABSORPTION} * depth * 3.2);
  return mix(deep, shallow, pow(uvY, 0.55)) * (0.55 + 0.45 * attenuation);
}
`;

/**
 * 8bit 出力のバンディング除去。±0.5/255 のディザを最終色へ足す。
 * 暗い全面グラデーション（深海・夜光）で階調の縞が見えるのを防ぐ。
 */
export const WATER_DITHER_GLSL = `
col += (hash21(gl_FragCoord.xy * 0.7 + fract(u_time)) - 0.5) / 255.0;
`;
