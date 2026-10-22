import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
import { EdohiganAmbient } from "./EdohiganAmbient";
import {
  createScenePetals,
  edohiganBranchSway,
  edohiganWind,
  READING_CLEAR_INNER,
  READING_CLEAR_OUTER,
  FAR_CENTER_KEEP,
  scenePetalTargetCount,
  type ScenePetal,
} from "../../features/theme/edohiganScene";
import {
  ambientQualityDprCap,
  ambientQualityFrameIntervalMs,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "../../features/theme/ambientQuality";
import { nextElapsedSeconds } from "../../features/theme/ambientRenderBudget";
import branchUrl from "../../assets/themes/edohigan-branch.webp";
import petalUrl from "../../assets/themes/edohigan-petal.webp";

/**
 * 江戸彼岸 — three.js 情景レイヤー（スパイク）。
 *
 * CSS 版 `EdohiganAmbient` の置き換え候補。違いは「花弁が 3D 空間にいる」こと:
 *   - 遠近のある z に花弁を散らし、投影でサイズが変わる
 *   - 落下・横揺れ・自転・裏返しをすべて GPU 側で回す（1 ドローコール）
 *   - 遠景はミップの LOD バイアスでぼかす（ポストプロセス無しの簡易 DOF）
 *   - 近景の花弁は中央の本文カラムから退避する（可読性の既存契約）
 *
 * 合成は CSS の `mix-blend-mode: multiply`。紙に「影が落ちている」ように
 * 見せるためで、テキストのコントラストを壊さないための既存判断を踏襲する。
 *
 * three.js は動的 import。テーマを江戸彼岸にしていない起動では
 * チャンクを読まない（main バンドルを増やさない）。
 */

const PETAL_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec4 aSeed;   // x: 横位置(-1..1) / y: 落下の初期進行 / z: 一辺 / w: 位相
  attribute vec4 aMotion; // x: 落下速度 / y: 横揺れ周波数 / z: 自転 / w: 裏返し周波数
  attribute vec3 aExtras; // x: 深度0..1 / y: 不透明度 / z: 横揺れ振幅

  uniform float uTime;
  uniform float uGust;
  uniform vec2 uView;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vDepth;
  varying float vScreenX;

  void main() {
    vUv = uv;
    float depth = aExtras.x;

    // 画面より少し広い範囲を回す。端で消えてから再登場する。
    float span = uView.y * 1.25;
    float progress = fract(aSeed.y + uTime * aMotion.x);

    float gust = 0.6 + uGust * 0.7;
    float sway = sin(uTime * aMotion.y * 6.28318 + aSeed.w) * aExtras.z * uView.y * gust;
    float x = aSeed.x * uView.x * 0.5 + sway;
    float y = uView.y * 0.625 - progress * span;
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

const PETAL_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform float uClearInner;
  uniform float uClearOuter;
  uniform float uFarKeep;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vDepth;
  varying float vScreenX;

  void main() {
    // 遠景ほどミップを深く引く = ピントが外れた花弁。
    float lod = mix(1.7, 0.0, vDepth);
    vec4 texel = texture2D(uMap, vUv, lod);

    float distanceFromCenter = abs(vScreenX - 0.5);
    float inside = 1.0 - smoothstep(uClearInner, uClearOuter, distanceFromCenter);
    float suppress = mix(1.0 - uFarKeep, 1.0, smoothstep(0.4, 0.9, vDepth));
    float alpha = texel.a * vOpacity * (1.0 - inside * suppress);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(texel.rgb * uTint, alpha);
  }
`;

const SHADOW_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec4 aSeed;
  attribute vec4 aMotion;
  attribute vec3 aExtras;

  uniform float uTime;
  uniform float uGust;
  uniform vec2 uView;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vScreenX;

  void main() {
    vUv = uv;
    float depth = aExtras.x;
    float span = uView.y * 1.25;
    float progress = fract(aSeed.y + uTime * aMotion.x);
    float gust = 0.6 + uGust * 0.7;
    float sway = sin(uTime * aMotion.y * 6.28318 + aSeed.w) * aExtras.z * uView.y * gust;
    float x = aSeed.x * uView.x * 0.5 + sway;
    // 花弁より少し下・奥へずらす。紙の上に落ちた影に見せる。
    float y = uView.y * 0.625 - progress * span - aSeed.z * uView.y * 0.4;
    float z = mix(-uView.y * 0.55, uView.y * 0.08, depth) - uView.y * 0.02;

    float size = aSeed.z * uView.y * 1.05;
    vec2 quad = position.xy * size;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(x + quad.x, y + quad.y, z, 1.0);
    vScreenX = gl_Position.x / gl_Position.w * 0.5 + 0.5;
    float edge = smoothstep(0.0, 0.09, progress) * smoothstep(1.0, 0.88, progress);
    vOpacity = edge * (0.2 + depth * 0.8);
  }
`;

const SHADOW_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uShadowColor;
  uniform float uClearInner;
  uniform float uClearOuter;

  varying vec2 vUv;
  varying float vOpacity;
  varying float vScreenX;

  void main() {
    // 接地影は近景の花弁だけ。中景・遠景に置くと「紙の汚れ」に見える。
    if (vOpacity < 0.62) discard;
    // 花弁が中央カラムで消えているのに影だけ残ると、紙に汚れが浮く。
    float inside = 1.0 - smoothstep(uClearInner, uClearOuter, abs(vScreenX - 0.5));
    float d = length(vUv - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(0.1, 1.0, d)) * 0.07 * vOpacity * (1.0 - inside);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uShadowColor, alpha);
  }
`;

const BRANCH_VERTEX = /* glsl */ `
  precision highp float;

  uniform float uSway;   // ラジアン相当の振れ
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 p = position;
    // 根元 (uv.y = 0) を軸に、先端ほど大きくしなる。
    float bend = uv.y * uv.y * uSway * 26.0;
    p.x += bend;
    p.y += sin(bend * 3.0) * uv.y * 0.12;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const BRANCH_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    float alpha = texel.a * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(texel.rgb * uTint, alpha);
  }
`;

export type EdohiganThreeAmbientProps = {
  intensity: AmbientIntensity;
};

export function EdohiganThreeAmbient({ intensity }: EdohiganThreeAmbientProps) {
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
        teardown = startScene(THREE, canvas, intensityRef.current, () => intensityRef.current, {
          // 動きを減らす設定では静止画 1 枚だけ描く（rAF は回さない）。
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
    // WebGL2 / three が使えない環境では CSS 版へ戻す（見た目は従来どおり）。
    return <EdohiganAmbient intensity={intensity} />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="edohigan-scene"
      data-intensity={intensity}
      aria-hidden="true"
    />
  );
}

/**
 * 実際の three.js シーン。React から切り離してあるので、
 * 失敗時は呼び出し側が CSS 版へフォールバックできる。
 */
function startScene(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
  initialIntensity: AmbientIntensity,
  getIntensity: () => AmbientIntensity,
  options: { animate: boolean },
): () => void {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  const cameraDistance = 50;
  camera.position.set(0, 0, cameraDistance);

  const viewHeightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraDistance;
  const view = { width: viewHeightAtZero, height: viewHeightAtZero };

  // --- 花弁 -------------------------------------------------------------
  const petalTexture = new THREE.TextureLoader().load(petalUrl);
  petalTexture.colorSpace = THREE.SRGBColorSpace;

  const maxPetals = 96;
  const positions = new Float32Array(6 * 3);
  const uvs = new Float32Array(6 * 2);
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

  const seedData = new Float32Array(maxPetals * 4);
  const motionData = new Float32Array(maxPetals * 4);
  const extrasData = new Float32Array(maxPetals * 3);

  const seedAttribute = new THREE.InstancedBufferAttribute(seedData, 4);
  const motionAttribute = new THREE.InstancedBufferAttribute(motionData, 4);
  const extrasAttribute = new THREE.InstancedBufferAttribute(extrasData, 3);

  const buildGeometry = () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute("aSeed", seedAttribute);
    geometry.setAttribute("aMotion", motionAttribute);
    geometry.setAttribute("aExtras", extrasAttribute);
    geometry.instanceCount = 0;
    return geometry;
  };

  const petalGeometry = buildGeometry();
  const shadowGeometry = buildGeometry();

  const sharedUniforms = {
    uTime: { value: 0 },
    uGust: { value: 0.5 },
    uView: { value: new THREE.Vector2(view.width, view.height) },
  };

  const petalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: petalTexture },
      uTint: { value: new THREE.Color(0.82, 0.56, 0.6) },
      uClearInner: { value: READING_CLEAR_INNER },
      uClearOuter: { value: READING_CLEAR_OUTER },
      uFarKeep: { value: FAR_CENTER_KEEP },
    },
    vertexShader: PETAL_VERTEX,
    fragmentShader: PETAL_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const shadowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uShadowColor: { value: new THREE.Color(0.5, 0.33, 0.36) },
      uClearInner: { value: READING_CLEAR_INNER },
      uClearOuter: { value: READING_CLEAR_OUTER },
    },
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const petals = new THREE.Mesh(petalGeometry, petalMaterial);
  const shadows = new THREE.Mesh(shadowGeometry, shadowMaterial);
  petals.frustumCulled = false;
  shadows.frustumCulled = false;
  petals.renderOrder = 2;
  shadows.renderOrder = 1;
  scene.add(shadows, petals);

  // --- 枝花 -------------------------------------------------------------
  const branchTexture = new THREE.TextureLoader().load(branchUrl);
  branchTexture.colorSpace = THREE.SRGBColorSpace;
  const branchGeometry = new THREE.PlaneGeometry(1, 1, 24, 24);
  // 根元（左下）を原点にする。
  branchGeometry.translate(0.5, 0.5, 0);
  const branchMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: branchTexture },
      uTint: { value: new THREE.Color(0.76, 0.66, 0.67) },
      uOpacity: { value: 0.42 },
      uSway: { value: 0 },
    },
    vertexShader: BRANCH_VERTEX,
    fragmentShader: BRANCH_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const branch = new THREE.Mesh(branchGeometry, branchMaterial);
  branch.frustumCulled = false;
  branch.renderOrder = 0;
  scene.add(branch);

  let quality = initialAmbientQualityState(initialIntensity);
  let currentIntensity = initialIntensity;
  let canvasWidth = 0;
  let canvasHeight = 0;

  const applyPetals = (intensity: AmbientIntensity, tier: 0 | 1 | 2 | 3) => {
    const count = scenePetalTargetCount(intensity, tier);
    const seeds = createScenePetals(intensity, 1).slice(0, count);
    seeds.forEach((petal: ScenePetal, index: number) => {
      seedData[index * 4] = petal.x;
      seedData[index * 4 + 1] = petal.start01;
      seedData[index * 4 + 2] = petal.size;
      seedData[index * 4 + 3] = petal.phase;
      motionData[index * 4] = petal.fall;
      motionData[index * 4 + 1] = petal.swayHz;
      motionData[index * 4 + 2] = petal.spin;
      motionData[index * 4 + 3] = petal.flipHz;
      extrasData[index * 3] = petal.depth01;
      extrasData[index * 3 + 1] = petal.opacity;
      extrasData[index * 3 + 2] = petal.sway;
    });
    seedAttribute.needsUpdate = true;
    motionAttribute.needsUpdate = true;
    extrasAttribute.needsUpdate = true;
    petalGeometry.instanceCount = seeds.length;
    shadowGeometry.instanceCount = seeds.length;
  };

  const applyLayout = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, ambientQualityDprCap(quality.tier));
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
    const heightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraDistance;
    view.height = heightAtZero;
    view.width = heightAtZero * camera.aspect;
    sharedUniforms.uView.value.set(view.width, view.height);

    const branchWidth = Math.min(view.width * 0.22, view.height * 0.34);
    const branchHeight = Math.min(view.height * 0.42, branchWidth * 1.45);
    branch.scale.set(branchWidth, branchHeight, 1);
    branch.position.set(-view.width * 0.5 - branchWidth * 0.06, -view.height * 0.5 - branchHeight * 0.06, 2);
    branchMaterial.uniforms.uOpacity.value = 0.34;
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
    const wind = edohiganWind(time);
    sharedUniforms.uTime.value = time;
    sharedUniforms.uGust.value = wind;
    branchMaterial.uniforms.uSway.value = edohiganBranchSway(time);
    renderer.render(scene, camera);
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

  // 最初の 1 枚は必ず描く（reduced-motion でも「静止した花の情景」は残す）。
  draw(0);
  // テクスチャは非同期。静止画のときは読み込み後にもう一度だけ描く。
  const redrawWhenStill = () => {
    if (!options.animate) {
      draw(0);
    }
  };
  petalTexture.onUpdate = redrawWhenStill;
  branchTexture.onUpdate = redrawWhenStill;

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
    branchTexture.onUpdate = null;
    petalGeometry.dispose();
    shadowGeometry.dispose();
    branchGeometry.dispose();
    petalMaterial.dispose();
    shadowMaterial.dispose();
    branchMaterial.dispose();
    petalTexture.dispose();
    branchTexture.dispose();
    renderer.dispose();
  };
}
