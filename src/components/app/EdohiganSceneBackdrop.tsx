import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
import { EdohiganAmbient } from "./EdohiganAmbient";
import {
  createScenePetals,
  splitPetalBands,
  edohiganWind,
  DAWN_PETAL_TINT,
} from "../../features/theme/edohiganScene";
import {
  PETAL_FRAGMENT,
  PETAL_VERTEX,
  createPetalGeometry,
} from "../../features/theme/edohiganPetalShader";
import { WIND_GLSL, growTree, type Tree } from "../../features/theme/edohiganTree";
import {
  ambientQualityFrameIntervalMs,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "../../features/theme/ambientQuality";
import { nextElapsedSeconds } from "../../features/theme/ambientRenderBudget";
import petalUrl from "../../assets/themes/edohigan-petal.webp";
import { drawBlossomSprite } from "../../features/theme/edohiganBlossomSprite";

/**
 * 江戸彼岸 — 草原に立つ一本の大木（three.js）。
 *
 * 「紙の上に枝を置く」のをやめ、**空・草原・木・花**で 1 つの風景を組む。
 * 木は画像ではなく骨格から起こす（`growTree`）。根元から先端までの距離を
 * 重みにした 1 つの風の式で、幹はほぼ動かず、枝先だけがゆっくりしなる。
 * 花は枝先にビルボードで置き、木と同じ風に乗せる。
 *
 * 境界は既存のまま: 外部テクスチャの fetch なし、`blob:` なし、CSP 変更なし。
 * 強度・品質段・reduced-motion・非表示停止は既存の ambient 予算系に従う。
 */

const SKY_VERTEX = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uSun;
  uniform vec3 cZenith;
  uniform vec3 cMiddle;
  uniform vec3 cHorizon;
  uniform vec3 cSun;

  varying vec2 vUv;

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
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 uv = vUv;

    // 昼前の空。上は淡い青、地平は暖かい白。
    vec3 color = mix(cHorizon, cMiddle, smoothstep(0.0, 0.42, uv.y));
    color = mix(color, cZenith, smoothstep(0.38, 1.0, uv.y));

    // 太陽。木の後ろへ置き、花を逆光で透かす。
    vec2 d = (uv - uSun) * vec2(uAspect, 1.0);
    float r = length(d);
    color = mix(color, cSun, clamp(exp(-r * 26.0) * 0.9 + exp(-r * 6.0) * 0.22, 0.0, 1.0));

    // ごく淡い雲の帯。動かすと空気が動いて見える。
    float bands = sin(uv.y * 34.0 + uv.x * 5.0 + uTime * 0.02) * 0.5 + 0.5;
    bands *= smoothstep(0.55, 0.95, uv.y) * (1.0 - smoothstep(0.9, 1.0, uv.y));
    color += vec3(1.0, 0.98, 0.96) * bands * 0.03;

    // 地平の霞。
    float haze = (1.0 - smoothstep(0.0, 0.18, uv.y)) * 0.5;
    color = mix(color, vec3(1.0, 0.96, 0.9), haze);

    // 地平の向こうの林。地面の遠端（uv.y ≈ 0.47）に接する低い帯。
    // 輪郭は滑らかなノイズで崩し、色は空気の色へ寄せて主張しない。
    float ridge = valueNoise(vec2(uv.x * 22.0, 0.5)) * 0.016 + valueNoise(vec2(uv.x * 61.0, 2.0)) * 0.006;
    float treeBand = smoothstep(0.462, 0.474, uv.y)
                   * (1.0 - smoothstep(0.5 + ridge, 0.512 + ridge, uv.y));
    color = mix(color, vec3(0.5, 0.58, 0.5), treeBand * 0.4);

    color += (hash21(uv * 1024.0) - 0.5) / 255.0;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const GROUND_VERTEX = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying float vDistance;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vDistance = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 cNear;
  uniform vec3 cFar;
  uniform vec3 cHaze;
  uniform vec2 uTreeXZ;
  uniform float uTreeRadius;

  varying vec3 vWorld;
  varying float vDistance;

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
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    // 風で草がなびく細かいまだら。ゆっくり流す。
    float n = valueNoise(p * 0.09 + vec2(uTime * 0.012, 0.0));
    float fine = valueNoise(p * 0.7);

    float depth = clamp((10.0 - vWorld.z) / 110.0, 0.0, 1.0);
    vec3 color = mix(cNear, cFar, depth);
    color *= 0.9 + n * 0.22 + fine * 0.06;

    // 陽の当たる面を少し明るく。
    color += vec3(0.06, 0.05, 0.02) * smoothstep(0.55, 0.95, n);

    // 木の根元の影。楕円に薄く落として、木が地面に立っているように見せる。
    float shadow = 1.0 - smoothstep(
      0.15,
      1.0,
      length((vWorld.xz - uTreeXZ) / vec2(uTreeRadius, uTreeRadius * 0.5))
    );
    color *= 1.0 - shadow * 0.38;

    // 遠景は霞へ溶かす。
    float haze = smoothstep(0.66, 1.0, depth) * 0.72;
    color = mix(color, cHaze, haze);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const TREE_VERTEX = /* glsl */ `
  precision highp float;

  attribute float aSway;
  attribute float aPhase;
  attribute float aDepth01;
  attribute vec2 aBarkUv;

  uniform float uTime;
  uniform float uGust;

  varying float vDepth01;
  varying vec3 vNormalW;
  varying vec2 vBarkUv;
  varying vec3 vWorldPos;

  ${WIND_GLSL}

  void main() {
    vec3 p = position;
    // 根元は動かない。先端ほど大きくしなる。
    float weight = aSway * aSway;
    // 空間位相: 木の左端と右端で位相をずらすと、風が梢を渡って見える。
    vec3 baseWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    float spatial = (baseWorld.x + baseWorld.z * 0.6) * 0.11;
    float s = edohiganSway(uTime, aPhase + spatial, uGust);
    p.x += s * weight * 0.62;
    p.z += s * weight * 0.16;
    p.y += sin(uTime * 0.45 + aPhase * 2.0) * 0.05 * weight;

    vDepth01 = aDepth01;
    vBarkUv = aBarkUv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const TREE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 cBarkNear;
  uniform vec3 cBarkFar;
  uniform vec3 cHaze;

  varying float vDepth01;
  varying vec3 vNormalW;
  varying vec2 vBarkUv;
  varying vec3 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    // 奥の枝ほど空気の色へ寄せる。
    vec3 color = mix(cBarkNear, cBarkFar, vDepth01 * 0.55);
    color = mix(color, cHaze, vDepth01 * 0.12);

    // 樹皮のムラ。縦に長いノイズを重ねる。
    float grain = hash21(vec2(floor(vBarkUv.x * 72.0), floor(vBarkUv.y * 11.0)));
    float broad = hash21(vec2(floor(vBarkUv.x * 9.0), floor(vBarkUv.y * 3.0)));
    color *= 0.78 + grain * 0.26 + broad * 0.16;

    // 太陽側の面をわずかに明るく。
    float light = clamp(dot(normalize(vNormalW), normalize(vec3(-0.35, 0.75, 0.55))), 0.0, 1.0);
    color *= 0.82 + light * 0.34;

    // 逆光の縁。太陽は木の後ろ（右上）なので、輪郭だけが淡く光る。
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), 3.0);
    // 太陽側の縁だけ。全体を均一に持ち上げると幹が灰色になる。
    color += vec3(1.0, 0.88, 0.74) * rim * light * 0.16;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BLOSSOM_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aPhase;
  attribute float aTint;
  attribute float aRotation;

  uniform float uTime;
  uniform float uGust;

  varying vec2 vUv;
  varying float vTint;
  varying float vShade;

  ${WIND_GLSL}

  void main() {
    vUv = uv;
    // 木と同じ空間位相を使う（同じ風の中にいる）。
    vec3 centerWorld = (modelMatrix * vec4(aCenter, 1.0)).xyz;
    float spatial = (centerWorld.x + centerWorld.z * 0.6) * 0.11;
    float s = edohiganSway(uTime, aPhase + spatial, uGust);
    // 木と同じ風に乗せる。花は枝先なので重みは最大。
    vec3 center = aCenter + vec3(s * 0.62, sin(uTime * 0.9 + aPhase * 3.0) * 0.05, s * 0.16);

    // 花ごとに向きを変える（全部同じ向きだと並んで見える）。
    float c = cos(aRotation);
    float sn = sin(aRotation);
    vec2 turned = vec2(c * position.x - sn * position.y, sn * position.x + c * position.y);

    // カメラを向く板（ビルボード）。
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 pos = center + (right * turned.x + up * turned.y) * aSize;

    vTint = aTint;
    vShade = 0.75 + 0.25 * position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const BLOSSOM_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform vec3 cPetal;
  uniform vec3 cPetalDeep;

  varying vec2 vUv;
  varying float vTint;
  varying float vShade;

  void main() {
    vec4 sprite = texture2D(uMap, vUv);
    float alpha = sprite.a * vShade;
    if (alpha < 0.02) discard;

    // 花の色はスプライト由来。個体差だけ tint で寄せる。
    vec3 color = sprite.rgb * mix(cPetalDeep, cPetal, vTint);
    gl_FragColor = vec4(color * (0.88 + vShade * 0.2), alpha);
  }
`;


const GRASS_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec3 aOffset;
  attribute float aScale;
  attribute float aPhase;

  uniform float uTime;
  uniform float uGust;

  varying vec2 vUv;
  varying float vShade;

  ${WIND_GLSL}

  void main() {
    vUv = uv;
    float s = edohiganSway(uTime, aPhase, uGust);
    float weight = position.y * position.y;

    // カメラの右方向へ向ける（板の向きを揃えない）。
    vec3 right = vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]);
    vec3 local = right * (position.x * aScale * 0.3) + vec3(0.0, position.y * aScale, 0.0);
    vec3 pos = aOffset + local + vec3(s * weight * aScale * 0.35, 0.0, 0.0);

    vShade = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRASS_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 cBase;
  uniform vec3 cTip;

  varying vec2 vUv;
  varying float vShade;

  void main() {
    // 根元は濃く、穂先は淡く。輪郭は上下でぼかす。
    float alpha = smoothstep(0.0, 0.12, vShade) * (1.0 - smoothstep(0.72, 1.0, vShade));
    if (alpha < 0.02) discard;
    vec3 color = mix(cBase, cTip, vShade);
    gl_FragColor = vec4(color, alpha * 0.62);
  }
`;

const SKY_COLORS = {
  zenith: [0.45, 0.64, 0.84],
  middle: [0.78, 0.84, 0.84],
  horizon: [1.0, 0.92, 0.79],
  sun: [1.0, 0.97, 0.88],
} as const;

const GROUND_COLORS = {
  near: [0.28, 0.38, 0.19],
  far: [0.55, 0.64, 0.42],
  haze: [0.8, 0.83, 0.7],
} as const;

const BARK_COLORS = {
  near: [0.12, 0.08, 0.075],
  far: [0.22, 0.16, 0.15],
  haze: [0.85, 0.82, 0.78],
} as const;

export type EdohiganSceneBackdropProps = {
  intensity: AmbientIntensity;
};

export function EdohiganSceneBackdrop({ intensity }: EdohiganSceneBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  const [failed, setFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const active = intensity !== "off";

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    if (!active || failed) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;
    let teardown = () => {};

    void (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        if (!disposed) setFailed(true);
        return;
      }
      if (disposed) {
        return;
      }
      try {
        teardown = startBackdrop(THREE, canvas, intensityRef.current, () => intensityRef.current, {
          animate: !reducedMotion,
        });
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      teardown();
    };
  }, [active, reducedMotion, failed]);

  if (!active) {
    return null;
  }
  if (failed) {
    // WebGL2 が無い環境では、紙の上を流れる CSS 版の花弁へ戻す。
    return <EdohiganAmbient intensity={intensity} />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="edohigan-scene-backdrop"
      data-intensity={intensity}
      aria-hidden="true"
    />
  );
}

const TREE_SCALE = 1.22;
const GROUND_Y = -10.5;
const TREE_DEPTH = -6;

/**
 * 木の骨格を、曲がった管メッシュにする。
 *
 * 枝を直線で結ぶと「針金」に見えるので、枝ごとに 1 本の二次ベジェへ曲げる。
 * 根元（depth 0）は根張りを付けて地面へ広がらせる。頂点は
 *   - aSway   : 根元からの距離（0..1）。風の重み
 *   - aPhase  : 枝ごとの位相
 *   - aBarkUv : 樹皮のムラを描くための UV
 * を持つ。
 */
function buildTreeGeometry(THREE: typeof import("three"), tree: Tree) {
  const positions: number[] = [];
  const normals: number[] = [];
  const sway: number[] = [];
  const phase: number[] = [];
  const depth: number[] = [];
  const barkUv: number[] = [];
  const indices: number[] = [];

  const SIDES = 7;
  const RINGS = 4;

  const basis = (direction: [number, number, number]) => {
    const helper: [number, number, number] = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u: [number, number, number] = [
      direction[1] * helper[2] - direction[2] * helper[1],
      direction[2] * helper[0] - direction[0] * helper[2],
      direction[0] * helper[1] - direction[1] * helper[0],
    ];
    const length = Math.hypot(u[0], u[1], u[2]) || 1;
    const unit: [number, number, number] = [u[0] / length, u[1] / length, u[2] / length];
    const v: [number, number, number] = [
      direction[1] * unit[2] - direction[2] * unit[1],
      direction[2] * unit[0] - direction[0] * unit[2],
      direction[0] * unit[1] - direction[1] * unit[0],
    ];
    return { unit, v };
  };

  for (const branch of tree.branches) {
    const startPoint = branch.start as unknown as [number, number, number];
    const endPoint = branch.end as unknown as [number, number, number];
    const delta: [number, number, number] = [
      endPoint[0] - startPoint[0],
      endPoint[1] - startPoint[1],
      endPoint[2] - startPoint[2],
    ];
    const length = Math.hypot(delta[0], delta[1], delta[2]) || 1;
    const forward: [number, number, number] = [delta[0] / length, delta[1] / length, delta[2] / length];
    const side = basis(forward).unit;

    // 枝ごとに少しだけしならせる（位相から決まるので毎回同じ形）。
    const bend = Math.sin(branch.phase * 1.7) * 0.16 * length;
    const control: [number, number, number] = [
      startPoint[0] + delta[0] * 0.5 + side[0] * bend,
      startPoint[1] + delta[1] * 0.5 + side[1] * bend,
      startPoint[2] + delta[2] * 0.5 + side[2] * bend,
    ];

    const baseIndex = positions.length / 3;

    for (let ring = 0; ring <= RINGS; ring += 1) {
      const t = ring / RINGS;
      const mt = 1 - t;
      const px = mt * mt * startPoint[0] + 2 * mt * t * control[0] + t * t * endPoint[0];
      const py = mt * mt * startPoint[1] + 2 * mt * t * control[1] + t * t * endPoint[1];
      const pz = mt * mt * startPoint[2] + 2 * mt * t * control[2] + t * t * endPoint[2];
      const tx = 2 * mt * (control[0] - startPoint[0]) + 2 * t * (endPoint[0] - control[0]);
      const ty = 2 * mt * (control[1] - startPoint[1]) + 2 * t * (endPoint[1] - control[1]);
      const tz = 2 * mt * (control[2] - startPoint[2]) + 2 * t * (endPoint[2] - control[2]);
      const tangentLength = Math.hypot(tx, ty, tz) || 1;
      const tangent: [number, number, number] = [tx / tangentLength, ty / tangentLength, tz / tangentLength];
      const frame = basis(tangent);

      // 根張り: 太い幹ほど根元が広がる。t=0 で最大、すぐ絞る。
      const flare = branch.depth === 0 ? 1 + 0.5 * Math.pow(1 - t, 4) : 1;
      const radius = (branch.radiusStart + (branch.radiusEnd - branch.radiusStart) * t) * flare;
      const ringSway = branch.swayStart + (branch.sway - branch.swayStart) * t;

      for (let sideIndex = 0; sideIndex < SIDES; sideIndex += 1) {
        const angle = (sideIndex / SIDES) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = frame.unit[0] * cos + frame.v[0] * sin;
        const ny = frame.unit[1] * cos + frame.v[1] * sin;
        const nz = frame.unit[2] * cos + frame.v[2] * sin;
        positions.push(px + nx * radius, py + ny * radius, pz + nz * radius);
        normals.push(nx, ny, nz);
        sway.push(ringSway);
        phase.push(branch.phase);
        depth.push(branch.depth / 5);
        barkUv.push(t, sideIndex / SIDES);
      }
    }

    for (let ring = 0; ring < RINGS; ring += 1) {
      for (let sideIndex = 0; sideIndex < SIDES; sideIndex += 1) {
        const next = (sideIndex + 1) % SIDES;
        const a = baseIndex + ring * SIDES + sideIndex;
        const b = baseIndex + ring * SIDES + next;
        const c = baseIndex + (ring + 1) * SIDES + sideIndex;
        const d = baseIndex + (ring + 1) * SIDES + next;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aSway", new THREE.Float32BufferAttribute(sway, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  geometry.setAttribute("aDepth01", new THREE.Float32BufferAttribute(depth, 1));
  geometry.setAttribute("aBarkUv", new THREE.Float32BufferAttribute(barkUv, 2));
  geometry.setIndex(indices);
  return geometry;
}

function startBackdrop(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
  initialIntensity: AmbientIntensity,
  getIntensity: () => AmbientIntensity,
  options: { animate: boolean },
): () => void {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  const cameraZ = 50;
  camera.position.set(0, 0.5, cameraZ);

  const viewHeightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraZ;
  const view = { width: viewHeightAtZero, height: viewHeightAtZero };

  // --- 空 ---------------------------------------------------------------
  const skyScene = new THREE.Scene();
  const skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1.6 },
      uSun: { value: new THREE.Vector2(0.8, 0.8) },
      cZenith: { value: new THREE.Color(...SKY_COLORS.zenith) },
      cMiddle: { value: new THREE.Color(...SKY_COLORS.middle) },
      cHorizon: { value: new THREE.Color(...SKY_COLORS.horizon) },
      cSun: { value: new THREE.Color(...SKY_COLORS.sun) },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
  sky.frustumCulled = false;
  skyScene.add(sky);

  // --- 草原 -------------------------------------------------------------
  const groundGeometry = new THREE.PlaneGeometry(600, 600, 1, 1);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      cNear: { value: new THREE.Color(...GROUND_COLORS.near) },
      cFar: { value: new THREE.Color(...GROUND_COLORS.far) },
      cHaze: { value: new THREE.Color(...GROUND_COLORS.haze) },
      uTreeXZ: { value: new THREE.Vector2(0, 0) },
      uTreeRadius: { value: 9 },
    },
    vertexShader: GROUND_VERTEX,
    fragmentShader: GROUND_FRAGMENT,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(0, GROUND_Y, -120);
  scene.add(ground);

  // --- 木 ---------------------------------------------------------------
  const tree = growTree();
  const treeGeometry = buildTreeGeometry(THREE, tree);
  const treeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      cBarkNear: { value: new THREE.Color(...BARK_COLORS.near) },
      cBarkFar: { value: new THREE.Color(...BARK_COLORS.far) },
      cHaze: { value: new THREE.Color(...BARK_COLORS.haze) },
    },
    vertexShader: TREE_VERTEX,
    fragmentShader: TREE_FRAGMENT,
  });
  const treeMesh = new THREE.Mesh(treeGeometry, treeMaterial);
  treeMesh.scale.setScalar(TREE_SCALE);
  treeMesh.position.set(18, GROUND_Y, TREE_DEPTH);
  treeMesh.frustumCulled = false;
  scene.add(treeMesh);

  // --- 花 ---------------------------------------------------------------
  const petalTexture = new THREE.TextureLoader().load(petalUrl);
  petalTexture.colorSpace = THREE.SRGBColorSpace;

  // 5 弁の花は canvas に描いてテクスチャにする（外部 fetch なし）。
  const blossomCanvas = drawBlossomSprite();
  const blossomTexture = blossomCanvas
    ? new THREE.CanvasTexture(blossomCanvas)
    : petalTexture;
  blossomTexture.colorSpace = THREE.SRGBColorSpace;

  const blossomGeometry = new THREE.InstancedBufferGeometry();
  {
    const quad = [
      [-0.5, -0.5, 0, 0],
      [0.5, -0.5, 1, 0],
      [-0.5, 0.5, 0, 1],
      [-0.5, 0.5, 0, 1],
      [0.5, -0.5, 1, 0],
      [0.5, 0.5, 1, 1],
    ];
    const positions = new Float32Array(18);
    const uvs = new Float32Array(12);
    quad.forEach(([x, y, u, v], index) => {
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    });
    blossomGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    blossomGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  const blossomCount = tree.blossoms.length;
  const centers = new Float32Array(blossomCount * 3);
  const sizes = new Float32Array(blossomCount);
  const phases = new Float32Array(blossomCount);
  const tints = new Float32Array(blossomCount);
  const rotations = new Float32Array(blossomCount);
  tree.blossoms.forEach((blossom, index) => {
    centers[index * 3] = blossom.position[0];
    centers[index * 3 + 1] = blossom.position[1];
    centers[index * 3 + 2] = blossom.position[2];
    sizes[index] = blossom.size;
    phases[index] = blossom.phase;
    tints[index] = blossom.tint;
    rotations[index] = blossom.phase * 1.9;
  });
  blossomGeometry.setAttribute("aCenter", new THREE.InstancedBufferAttribute(centers, 3));
  blossomGeometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1));
  blossomGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  blossomGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(tints, 1));
  blossomGeometry.setAttribute("aRotation", new THREE.InstancedBufferAttribute(rotations, 1));
  blossomGeometry.instanceCount = blossomCount;

  const blossomMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      uMap: { value: blossomTexture },
      cPetal: { value: new THREE.Color(1.0, 0.95, 0.96) },
      cPetalDeep: { value: new THREE.Color(0.96, 0.74, 0.8) },
    },
    vertexShader: BLOSSOM_VERTEX,
    fragmentShader: BLOSSOM_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const blossoms = new THREE.Mesh(blossomGeometry, blossomMaterial);
  blossoms.scale.setScalar(TREE_SCALE);
  blossoms.position.copy(treeMesh.position);
  blossoms.frustumCulled = false;
  scene.add(blossoms);

  // --- 手前の草 ---------------------------------------------------------
  // 画面下端のすぐ外に生えている草。手前の枠として置くと、草原の広さが出る。
  const grassCount = 26;
  const grassGeometry = new THREE.InstancedBufferGeometry();
  {
    // 3 段に絞った葉。根元は広く、穂先はほぼ点。
    const positions = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0,
      -0.34, 0.55, 0, 0.34, 0.55, 0,
      0.02, 1, 0, 0.16, 1, 0,
    ]);
    const uvs = new Float32Array([0, 0, 1, 0, 0, 0.55, 1, 0.55, 0, 1, 1, 1]);
    const indices = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5];
    grassGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    grassGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    grassGeometry.setIndex(indices);
  }
  const grassOffsets = new Float32Array(grassCount * 3);
  const grassScales = new Float32Array(grassCount);
  const grassPhases = new Float32Array(grassCount);
  for (let index = 0; index < grassCount; index += 1) {
    // 手前ほど大きく。地面（y = GROUND_Y）から生える。
    const depth = Math.random();
    grassOffsets[index * 3] = (Math.random() * 2 - 1) * 26;
    grassOffsets[index * 3 + 1] = GROUND_Y;
    grassOffsets[index * 3 + 2] = 26 - depth * 8;
    grassScales[index] = 1.8 + Math.random() * 3.6;
    grassPhases[index] = Math.random() * Math.PI * 2;
  }
  grassGeometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grassOffsets, 3));
  grassGeometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(grassScales, 1));
  grassGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(grassPhases, 1));
  grassGeometry.instanceCount = grassCount;
  const grassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      cBase: { value: new THREE.Color(0.2, 0.28, 0.14) },
      cTip: { value: new THREE.Color(0.5, 0.6, 0.34) },
    },
    vertexShader: GRASS_VERTEX,
    fragmentShader: GRASS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.frustumCulled = false;
  grass.renderOrder = 4;
  scene.add(grass);

  // --- 舞う花びら -------------------------------------------------------
  const petalCapacity = 96;
  const petal = createPetalGeometry(THREE, petalCapacity);
  const petalUniforms = {
    uTime: { value: 0 },
    uGust: { value: 0.5 },
    uView: { value: new THREE.Vector2(view.width, view.height) },
    uSpanScale: { value: 1.3 },
  };
  const petalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...petalUniforms,
      uMap: { value: petalTexture },
      uTint: { value: new THREE.Color(...DAWN_PETAL_TINT) },
      uAerialTint: { value: new THREE.Color(1.0, 0.94, 0.93) },
      uClearInner: { value: 0 },
      uClearOuter: { value: 0 },
      uClearStrength: { value: 0 },
      uFarKeep: { value: 1 },
      uOpacityScale: { value: 0.9 },
      uLodBias: { value: 1.6 },
    },
    vertexShader: PETAL_VERTEX,
    fragmentShader: PETAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const petals = new THREE.Mesh(petal.geometry, petalMaterial);
  petals.frustumCulled = false;
  scene.add(petals);

  let quality = initialAmbientQualityState(initialIntensity);
  let currentIntensity = initialIntensity;
  let canvasWidth = 0;
  let canvasHeight = 0;

  const applyPetals = (intensity: AmbientIntensity, tier: 0 | 1 | 2 | 3) => {
    const seeds = splitPetalBands(createScenePetals(intensity, tier)).backdrop;
    petal.write(seeds);
  };

  const applyLayout = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, quality.tier >= 2 ? 1 : 1.5);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (width !== canvasWidth || height !== canvasHeight) {
      canvasWidth = width;
      canvasHeight = height;
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    const heightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraZ;
    view.height = heightAtZero;
    view.width = heightAtZero * camera.aspect;
    petalUniforms.uView.value.set(view.width, view.height);
    skyMaterial.uniforms.uAspect.value = camera.aspect;

    // 木は画面の右へ。文字のカラム（中央）に幹を置かない。
    treeMesh.position.set(view.width * 0.3, GROUND_Y, TREE_DEPTH);
    blossoms.position.copy(treeMesh.position);
    groundMaterial.uniforms.uTreeXZ.value.set(treeMesh.position.x, treeMesh.position.z);
    groundMaterial.uniforms.uTreeRadius.value = view.height * 0.2;
  };

  applyLayout();
  applyPetals(currentIntensity, quality.tier);

  let elapsedSeconds = 0;
  let lastFrameMs = 0;
  let lastDrawMs = 0;
  let frameId = 0;
  let pending = false;
  let running = true;
  let paused = document.hidden || !document.hasFocus();

  const draw = (time: number) => {
    const gust = edohiganWind(time);
    skyMaterial.uniforms.uTime.value = time;
    groundMaterial.uniforms.uTime.value = time;
    treeMaterial.uniforms.uTime.value = time;
    treeMaterial.uniforms.uGust.value = gust;
    blossomMaterial.uniforms.uTime.value = time;
    blossomMaterial.uniforms.uGust.value = gust;
    petalUniforms.uTime.value = time;
    petalUniforms.uGust.value = gust;
    grassMaterial.uniforms.uTime.value = time;
    grassMaterial.uniforms.uGust.value = gust;

    renderer.render(skyScene, skyCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
  };

  const schedule = () => {
    if (!running || paused || pending) {
      return;
    }
    pending = true;
    frameId = window.requestAnimationFrame(() => {
      pending = false;
      render();
    });
  };

  const render = () => {
    if (!running) {
      return;
    }
    const now = performance.now();
    const frameMs = lastFrameMs === 0 ? 0 : now - lastFrameMs;
    lastFrameMs = now;
    if (paused) {
      return;
    }

    const intensityNow = getIntensity();
    if (intensityNow !== currentIntensity) {
      currentIntensity = intensityNow;
      quality = initialAmbientQualityState(intensityNow);
      applyPetals(currentIntensity, quality.tier);
      applyLayout();
    }

    elapsedSeconds = nextElapsedSeconds(elapsedSeconds, frameMs, true);
    const previousTier = quality.tier;
    quality = updateAmbientQuality(quality, frameMs);
    if (quality.tier !== previousTier) {
      applyPetals(currentIntensity, quality.tier);
      applyLayout();
    }

    const interval = ambientQualityFrameIntervalMs(quality.tier);
    if (interval > 0 && now - lastDrawMs < interval) {
      schedule();
      return;
    }
    lastDrawMs = now;
    draw(elapsedSeconds);
    schedule();
  };

  const pause = () => {
    paused = true;
    if (pending) {
      window.cancelAnimationFrame(frameId);
    }
    pending = false;
  };
  const resume = () => {
    paused = document.hidden || !document.hasFocus();
    if (paused) {
      pause();
      return;
    }
    lastFrameMs = 0;
    schedule();
  };

  const onResize = () => applyLayout();
  const onVisibility = () => resume();
  const onFocus = () => resume();
  const onBlur = () => pause();

  if (options.animate) {
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
  }

  draw(0);
  const redrawWhenStill = () => {
    if (!options.animate) {
      draw(0);
    }
  };
  petalTexture.onUpdate = redrawWhenStill;

  if (options.animate) {
    schedule();
  }

  return () => {
    running = false;
    if (pending) {
      window.cancelAnimationFrame(frameId);
    }
    pending = false;
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    petalTexture.onUpdate = null;
    sky.geometry.dispose();
    skyMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
    treeGeometry.dispose();
    treeMaterial.dispose();
    blossomGeometry.dispose();
    blossomMaterial.dispose();
    petal.geometry.dispose();
    petalMaterial.dispose();
    grassGeometry.dispose();
    grassMaterial.dispose();
    petalTexture.dispose();
    if (blossomTexture !== petalTexture) {
      blossomTexture.dispose();
    }
    renderer.dispose();
  };
}
