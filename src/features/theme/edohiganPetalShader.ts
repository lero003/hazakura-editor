import type { ScenePetal } from "./edohiganScene";

/**
 * 江戸彼岸の花弁 — 手前（紙の上・乗算）と奥（情景・通常合成）で共有する GLSL。
 *
 * 二層は「同じ花弁を 2 回描かない」ように深度で分担する（`splitPetalBands`）。
 * 描き方だけが違う:
 *   - 手前: 紙に影を落とすので multiply。中央カラムからは退避する
 *   - 奥: 空を背景に実体として置く。遠い花弁は空の色へ寄せる（空気遠近）
 * その差は uniform だけで切り替え、シェーダーは 1 本に保つ。
 */

export const PETAL_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec4 aSeed;   // x: 横位置(-1..1) / y: 落下の初期進行 / z: 一辺 / w: 位相
  attribute vec4 aMotion; // x: 落下速度 / y: 横揺れ周波数 / z: 自転 / w: 裏返し周波数
  attribute vec3 aExtras; // x: 深度0..1 / y: 不透明度 / z: 横揺れ振幅

  uniform float uTime;
  uniform float uGust;
  uniform vec2 uView;
  uniform float uSpanScale;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vDepth;
  varying float vScreenX;

  void main() {
    vUv = uv;
    float depth = aExtras.x;

    // 画面より少し広い範囲を回す。端で消えてから再登場する。
    float span = uView.y * uSpanScale;
    float progress = fract(aSeed.y + uTime * aMotion.x);

    float gust = 0.6 + uGust * 0.7;
    float sway = sin(uTime * aMotion.y * 6.28318 + aSeed.w) * aExtras.z * uView.y * gust;
    float x = aSeed.x * uView.x * 0.5 + sway;
    float y = uView.y * (uSpanScale * 0.5) - progress * span;
    float z = mix(-uView.y * 0.55, uView.y * 0.08, depth);

    float angle = uTime * aMotion.z + aSeed.w;
    float flip = abs(sin(uTime * aMotion.w * 6.28318 + aSeed.w * 1.7));
    float size = aSeed.z * uView.y;

    vec2 quad = position.xy * size;
    quad.x *= mix(0.26, 1.0, flip);
    float c = cos(angle);
    float s = sin(angle);
    vec2 rotated = vec2(c * quad.x - s * quad.y, s * quad.x + c * quad.y);

    vec4 mv = modelViewMatrix * vec4(x + rotated.x, y + rotated.y, z, 1.0);
    gl_Position = projectionMatrix * mv;

    vScreenX = gl_Position.x / gl_Position.w * 0.5 + 0.5;
    vDepth = depth;

    // 画面の上下端でふわっと出入りさせる。
    float edge = smoothstep(0.0, 0.09, progress) * smoothstep(1.0, 0.88, progress);
    vOpacity = aExtras.y * edge * (0.35 + depth * 0.65);
  }
`;

export const PETAL_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform vec3 uTint;        // 近景の色
  uniform vec3 uAerialTint;  // 遠景の色（空へ寄せた色）
  uniform float uClearInner;
  uniform float uClearOuter;
  uniform float uClearStrength; // 0 = 奥（中央カラムを空ける必要がない）
  uniform float uFarKeep;
  uniform float uOpacityScale;
  uniform float uLodBias;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vDepth;
  varying float vScreenX;

  void main() {
    // 遠景ほどミップを深く引く = ピントが外れた花弁。
    float lod = mix(uLodBias, 0.0, vDepth);
    vec4 texel = texture2D(uMap, vUv, lod);

    float distanceFromCenter = abs(vScreenX - 0.5);
    float inside = 1.0 - smoothstep(uClearInner, uClearOuter, distanceFromCenter);
    float suppress = mix(1.0 - uFarKeep, 1.0, smoothstep(0.4, 0.9, vDepth));
    float alpha =
      texel.a * vOpacity * uOpacityScale * (1.0 - inside * suppress * uClearStrength);
    if (alpha < 0.004) discard;

    vec3 color = mix(uAerialTint, uTint, vDepth);
    gl_FragColor = vec4(texel.rgb * color, alpha);
  }
`;

type ThreeModule = typeof import("three");

export type PetalAttributes = {
  seed: import("three").InstancedBufferAttribute;
  motion: import("three").InstancedBufferAttribute;
  extras: import("three").InstancedBufferAttribute;
};

/**
 * 花弁の板ポリ + インスタンス属性。`write` で中身だけ差し替えられる。
 * 品質段が変わってもジオメトリを作り直さない（GL リソースを増やさない）。
 */
export function createPetalGeometry(THREE: ThreeModule, capacity: number) {
  const positions = new Float32Array(18);
  const uvs = new Float32Array(12);
  const quad = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [-0.5, 0.5, 0, 1],
    [-0.5, 0.5, 0, 1],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
  ];
  quad.forEach(([x, y, u, v], index) => {
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = 0;
    uvs[index * 2] = u;
    uvs[index * 2 + 1] = v;
  });

  const seed = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const motion = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const extras = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  seed.setUsage(THREE.DynamicDrawUsage);
  motion.setUsage(THREE.DynamicDrawUsage);
  extras.setUsage(THREE.DynamicDrawUsage);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aSeed", seed);
  geometry.setAttribute("aMotion", motion);
  geometry.setAttribute("aExtras", extras);
  geometry.instanceCount = 0;

  const write = (petals: ScenePetal[]) => {
    const seedArray = seed.array as Float32Array;
    const motionArray = motion.array as Float32Array;
    const extrasArray = extras.array as Float32Array;
    for (let index = 0; index < petals.length; index += 1) {
      const petal = petals[index];
      seedArray[index * 4] = petal.x;
      seedArray[index * 4 + 1] = petal.start01;
      seedArray[index * 4 + 2] = petal.size;
      seedArray[index * 4 + 3] = petal.phase;
      motionArray[index * 4] = petal.fall;
      motionArray[index * 4 + 1] = petal.swayHz;
      motionArray[index * 4 + 2] = petal.spin;
      motionArray[index * 4 + 3] = petal.flipHz;
      extrasArray[index * 3] = petal.depth01;
      extrasArray[index * 3 + 1] = petal.opacity;
      extrasArray[index * 3 + 2] = petal.sway;
    }
    seed.needsUpdate = true;
    motion.needsUpdate = true;
    extras.needsUpdate = true;
    geometry.instanceCount = petals.length;
  };

  return { geometry, attributes: { seed, motion, extras } satisfies PetalAttributes, write };
}
