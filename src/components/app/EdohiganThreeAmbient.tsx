import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
import { EdohiganAmbient } from "./EdohiganAmbient";
import {
  createScenePetals,
  edohiganBranchSway,
  edohiganWind,
  splitPetalBands,
  READING_CLEAR_INNER,
  READING_CLEAR_OUTER,
  FAR_CENTER_KEEP,
} from "../../features/theme/edohiganScene";
import {
  PETAL_FRAGMENT,
  PETAL_VERTEX,
  createPetalGeometry,
} from "../../features/theme/edohiganPetalShader";
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
 * 江戸彼岸 — 紙の手前を横切る近景の花弁（three.js）。
 *
 * 情景の本体は `EdohiganSceneBackdrop`（紙の奥）にある。ここはその手前側で、
 * **近景の花弁と、紙に落ちる接地影だけ**を描く。紙の上に乗るので
 * `mix-blend-mode: multiply` で影として合成し、中央の本文カラムからは退避する。
 *
 * three.js は動的 import。テーマを江戸彼岸にしていない起動では
 * チャンクを読まない（main バンドルを増やさない）。
 */

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

    // 花弁と同じ式で動かす（影だけ別の軌道にいると即座にバレる）。
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

  uniform float uSway;
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
    depth: false,
    stencil: false,
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

  const petalTexture = new THREE.TextureLoader().load(petalUrl);
  petalTexture.colorSpace = THREE.SRGBColorSpace;
  const branchTexture = new THREE.TextureLoader().load(branchUrl);
  branchTexture.colorSpace = THREE.SRGBColorSpace;

  const capacity = 96;
  const petal = createPetalGeometry(THREE, capacity);
  const shadow = createPetalGeometry(THREE, capacity);

  const sharedUniforms = {
    uTime: { value: 0 },
    uGust: { value: 0.5 },
    uView: { value: new THREE.Vector2(view.width, view.height) },
    uSpanScale: { value: 1.25 },
  };

  const petalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: petalTexture },
      // 紙に乗算するので、花弁そのものの色ではなく「影の色」に寄せる。
      uTint: { value: new THREE.Color(0.78, 0.5, 0.55) },
      uAerialTint: { value: new THREE.Color(0.82, 0.56, 0.6) },
      uClearInner: { value: READING_CLEAR_INNER },
      uClearOuter: { value: READING_CLEAR_OUTER },
      uClearStrength: { value: 1 },
      uFarKeep: { value: FAR_CENTER_KEEP },
      uOpacityScale: { value: 1 },
      uLodBias: { value: 1.2 },
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

  // --- 枝花（紙の上のシルエット） -------------------------------------
  // 奥の空に暗い枝を置いても、半透明の紙の前では影が薄い。紙の上に
  // multiply で直接置く方が「窓辺の枝」として確実に立つ。
  const branchGeometry = new THREE.PlaneGeometry(1, 1, 24, 24);
  branchGeometry.translate(0.5, 0.5, 0);
  const makeBranch = (opacity: number) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: branchTexture },
        uTint: { value: new THREE.Color(0.42, 0.26, 0.3) },
        uOpacity: { value: opacity },
        uSway: { value: 0 },
      },
      vertexShader: BRANCH_VERTEX,
      fragmentShader: BRANCH_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(branchGeometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    return { mesh, material };
  };
  const nearBranch = makeBranch(0.62);
  const farBranch = makeBranch(0.34);
  farBranch.mesh.scale.x = -1;
  scene.add(nearBranch.mesh, farBranch.mesh);

  const petals = new THREE.Mesh(petal.geometry, petalMaterial);
  const shadows = new THREE.Mesh(shadow.geometry, shadowMaterial);
  petals.frustumCulled = false;
  shadows.frustumCulled = false;
  petals.renderOrder = 2;
  shadows.renderOrder = 1;
  scene.add(shadows, petals);

  let quality = initialAmbientQualityState(initialIntensity);
  let currentIntensity = initialIntensity;
  let canvasWidth = 0;
  let canvasHeight = 0;

  const applyPetals = (intensity: AmbientIntensity, tier: 0 | 1 | 2 | 3) => {
    const seeds = splitPetalBands(createScenePetals(intensity, tier)).foreground;
    petal.write(seeds);
    shadow.write(seeds);
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

    const nearWidth = Math.min(view.width * 0.34, view.height * 0.46);
    const nearHeight = nearWidth * 0.9;
    nearBranch.mesh.scale.set(nearWidth, nearHeight, 1);
    nearBranch.mesh.position.set(
      -view.width * 0.5 - nearWidth * 0.06,
      -view.height * 0.5 - nearHeight * 0.24,
      4,
    );
    nearBranch.mesh.rotation.z = 0.04;

    const farWidth = Math.min(view.width * 0.3, view.height * 0.4);
    const farHeight = farWidth * 0.9;
    // 右上は鏡像で置く（scale.x を負にして、原点から左へ伸ばす）。
    farBranch.mesh.scale.set(-farWidth, farHeight, 1);
    farBranch.mesh.position.set(
      view.width * 0.5 + farWidth * 0.04,
      view.height * 0.5 - farHeight * 0.66,
      2,
    );
    farBranch.mesh.rotation.z = -0.1;
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
    const sway = edohiganBranchSway(time);
    sharedUniforms.uTime.value = time;
    sharedUniforms.uGust.value = wind;
    nearBranch.material.uniforms.uSway.value = sway * 1.4;
    farBranch.material.uniforms.uSway.value = sway * 0.8;
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

  draw(0);
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
    branchGeometry.dispose();
    nearBranch.material.dispose();
    farBranch.material.dispose();
    petal.geometry.dispose();
    shadow.geometry.dispose();
    petalMaterial.dispose();
    shadowMaterial.dispose();
    branchTexture.dispose();
    petalTexture.dispose();
    renderer.dispose();
  };
}
