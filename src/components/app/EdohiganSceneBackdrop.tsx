import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
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
import {
  WIND_GLSL,
  growTree,
  type Tree,
  type TreeBranch,
} from "../../features/theme/edohiganTree";
import {
  ambientQualityFrameIntervalMs,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "../../features/theme/ambientQuality";
import { nextElapsedSeconds } from "../../features/theme/ambientRenderBudget";
import petalUrl from "../../assets/themes/edohigan-petal.webp";

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

  void main() {
    vec2 uv = vUv;

    // 昼前の空。上は淡い青、地平は暖かい白。
    vec3 color = mix(cHorizon, cMiddle, smoothstep(0.0, 0.42, uv.y));
    color = mix(color, cZenith, smoothstep(0.38, 1.0, uv.y));

    // 太陽。木の後ろへ置き、花を逆光で透かす。
    vec2 d = (uv - uSun) * vec2(uAspect, 1.0);
    float r = length(d);
    color = mix(color, cSun, clamp(exp(-r * 10.0) * 0.85 + exp(-r * 2.8) * 0.32, 0.0, 1.0));

    // ごく淡い雲の帯。動かすと空気が動いて見える。
    float bands = sin(uv.y * 34.0 + uv.x * 5.0 + uTime * 0.02) * 0.5 + 0.5;
    bands *= smoothstep(0.55, 0.95, uv.y) * (1.0 - smoothstep(0.9, 1.0, uv.y));
    color += vec3(1.0, 0.98, 0.96) * bands * 0.03;

    // 地平の霞。
    float haze = (1.0 - smoothstep(0.0, 0.18, uv.y)) * 0.5;
    color = mix(color, vec3(1.0, 0.96, 0.9), haze);

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

    // 遠景は霞へ溶かす。
    float haze = smoothstep(0.55, 1.0, depth);
    color = mix(color, cHaze, haze);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const TREE_VERTEX = /* glsl */ `
  precision highp float;

  attribute float aSway;
  attribute float aPhase;
  attribute float aDepth01;

  uniform float uTime;
  uniform float uGust;

  varying float vDepth01;
  varying vec3 vNormalW;

  ${WIND_GLSL}

  void main() {
    vec3 p = position;
    // 根元は動かない。先端ほど大きくしなる。
    float weight = aSway * aSway;
    float s = edohiganSway(uTime, aPhase, uGust);
    p.x += s * weight * 0.62;
    p.z += s * weight * 0.16;
    p.y += sin(uTime * 0.45 + aPhase * 2.0) * 0.05 * weight;

    vDepth01 = aDepth01;
    vNormalW = normalize(mat3(modelMatrix) * normal);
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

  void main() {
    // 奥の枝ほど空気の色へ寄せる。
    vec3 color = mix(cBarkNear, cBarkFar, vDepth01 * 0.55);
    color = mix(color, cHaze, vDepth01 * 0.12);

    // 太陽側の面をわずかに明るく。
    float light = clamp(dot(normalize(vNormalW), normalize(vec3(-0.35, 0.75, 0.55))), 0.0, 1.0);
    color *= 0.82 + light * 0.34;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BLOSSOM_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aPhase;
  attribute float aTint;

  uniform float uTime;
  uniform float uGust;

  varying vec2 vUv;
  varying float vTint;
  varying float vShade;

  ${WIND_GLSL}

  void main() {
    vUv = uv;
    float s = edohiganSway(uTime, aPhase, uGust);
    // 木と同じ風に乗せる。花は枝先なので重みは最大。
    vec3 center = aCenter + vec3(s * 0.62, sin(uTime * 0.9 + aPhase * 3.0) * 0.05, s * 0.16);

    // カメラを向く板（ビルボード）。
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 pos = center + (right * position.x + up * position.y) * aSize;

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
    // 花びら 1 枚を 3 方向へ回して重ね、5 弁の花に近い塊に見せる。
    vec2 uv2 = vec2(0.5 + (vUv.x - 0.5) * 0.5 - (vUv.y - 0.5) * 0.866,
                    0.5 + (vUv.x - 0.5) * 0.866 + (vUv.y - 0.5) * 0.5);
    vec2 uv3 = vec2(0.5 + (vUv.x - 0.5) * 0.5 + (vUv.y - 0.5) * 0.866,
                    0.5 - (vUv.x - 0.5) * 0.866 + (vUv.y - 0.5) * 0.5);
    float a = max(texture2D(uMap, vUv).a, max(texture2D(uMap, uv2).a, texture2D(uMap, uv3).a));

    float alpha = a * vShade;
    if (alpha < 0.02) discard;

    vec3 color = mix(cPetalDeep, cPetal, vTint);
    gl_FragColor = vec4(color * (0.86 + vShade * 0.24), alpha);
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
  haze: [0.93, 0.92, 0.84],
} as const;

const BARK_COLORS = {
  near: [0.07, 0.05, 0.05],
  far: [0.18, 0.13, 0.14],
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

  if (!active || failed) {
    return null;
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

const TREE_SCALE = 1.35;
const GROUND_Y = -9;
const TREE_DEPTH = -6;

/** 木の骨格を、頂点ごとの揺れ重みを持つ管メッシュにする。 */
function buildTreeGeometry(THREE: typeof import("three"), tree: Tree) {
  const positions: number[] = [];
  const normals: number[] = [];
  const sway: number[] = [];
  const phase: number[] = [];
  const depth: number[] = [];
  const indices: number[] = [];

  const SIDES = 6;
  const RINGS = 3;

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

  const branchPhase = (branch: TreeBranch) => branch.phase;

  for (const branch of tree.branches) {
    const start = branch.start as unknown as [number, number, number];
    const end = branch.end as unknown as [number, number, number];
    const delta: [number, number, number] = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
    const length = Math.hypot(...delta) || 1;
    const normalized: [number, number, number] = [delta[0] / length, delta[1] / length, delta[2] / length];
    const { unit, v } = basis(normalized);
    const baseIndex = positions.length / 3;

    for (let ring = 0; ring <= RINGS; ring += 1) {
      const t = ring / RINGS;
      const radius = branch.radiusStart + (branch.radiusEnd - branch.radiusStart) * t;
      const cx = start[0] + delta[0] * t;
      const cy = start[1] + delta[1] * t;
      const cz = start[2] + delta[2] * t;
      const ringSway = branch.swayStart + (branch.sway - branch.swayStart) * t;
      for (let side = 0; side < SIDES; side += 1) {
        const angle = (side / SIDES) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = unit[0] * cos + v[0] * sin;
        const ny = unit[1] * cos + v[1] * sin;
        const nz = unit[2] * cos + v[2] * sin;
        positions.push(cx + nx * radius, cy + ny * radius, cz + nz * radius);
        normals.push(nx, ny, nz);
        sway.push(ringSway);
        phase.push(branchPhase(branch));
        depth.push(branch.depth / 5);
      }
    }

    for (let ring = 0; ring < RINGS; ring += 1) {
      for (let side = 0; side < SIDES; side += 1) {
        const next = (side + 1) % SIDES;
        const a = baseIndex + ring * SIDES + side;
        const b = baseIndex + ring * SIDES + next;
        const c = baseIndex + (ring + 1) * SIDES + side;
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
      uSun: { value: new THREE.Vector2(0.72, 0.62) },
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
  tree.blossoms.forEach((blossom, index) => {
    centers[index * 3] = blossom.position[0];
    centers[index * 3 + 1] = blossom.position[1];
    centers[index * 3 + 2] = blossom.position[2];
    sizes[index] = blossom.size;
    phases[index] = blossom.phase;
    tints[index] = blossom.tint;
  });
  blossomGeometry.setAttribute("aCenter", new THREE.InstancedBufferAttribute(centers, 3));
  blossomGeometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1));
  blossomGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  blossomGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(tints, 1));
  blossomGeometry.instanceCount = blossomCount;

  const blossomMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      uMap: { value: petalTexture },
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
      uAerialTint: { value: new THREE.Color(1.0, 0.93, 0.9) },
      uClearInner: { value: 0 },
      uClearOuter: { value: 0 },
      uClearStrength: { value: 0 },
      uFarKeep: { value: 1 },
      uOpacityScale: { value: 0.95 },
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
    petalTexture.dispose();
    renderer.dispose();
  };
}
