import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
import {
  createBokehPetals,
  createScenePetals,
  DAWN_PETAL_TINT,
  DAWN_SKY,
  edohiganWind,
  splitPetalBands,
} from "../../features/theme/edohiganScene";
import {
  PETAL_FRAGMENT,
  PETAL_VERTEX,
  createPetalGeometry,
} from "../../features/theme/edohiganPetalShader";
import {
  ambientQualityFrameIntervalMs,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "../../features/theme/ambientQuality";
import { nextElapsedSeconds } from "../../features/theme/ambientRenderBudget";
import petalUrl from "../../assets/themes/edohigan-petal.webp";

/**
 * 江戸彼岸 — 紙の奥に広がる夜明けの情景（three.js）。
 *
 * 「和紙の上の花」から「用紙が情景の中に浮かぶ」へ移した層。空・陽・枝・
 * 中景/遠景の花弁を描き、エディタの紙を 8 割程度の不透明度にして透かす。
 *
 * 紙の上に出るもの（近景の花弁と接地影）は `EdohiganThreeAmbient` が担当し、
 * 花弁は深度で 1 回だけ分担する（`splitPetalBands`）。
 *
 * 境界は既存のまま: 外部テクスチャの fetch なし、`blob:` なし、CSP 変更なし。
 * 画像は同梱の webp のみ。強度・品質段・reduced-motion・非表示停止は
 * 既存の ambient 予算系に合わせる。
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
  uniform float uWarmth;
  uniform vec3 cZenith;
  uniform vec3 cUpper;
  uniform vec3 cMiddle;
  uniform vec3 cHorizon;
  uniform vec3 cSun;
  uniform vec3 cHaze;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv;

    // 上から下へ: 紫 → 薔薇 → 珊瑚 → 白。夜明けの空。
    vec3 color = mix(cHorizon, cMiddle, smoothstep(0.0, 0.38, uv.y));
    color = mix(color, cUpper, smoothstep(0.3, 0.72, uv.y));
    color = mix(color, cZenith, smoothstep(0.66, 1.0, uv.y));

    // 太陽。左上手前から射す。中心は飛ばさず、白へ寄せる。
    vec2 d = uv - uSun;
    d.x *= uAspect;
    float r = length(d);
    float core = exp(-r * 22.0);
    float glow = exp(-r * 4.6);
    color = mix(color, cSun, clamp(core * 1.0 + glow * 0.42, 0.0, 1.0));

    // 光芒。角度から外へ伸びる帯を、ゆっくり呼吸させる。
    float angle = atan(d.y, d.x);
    float bands = 0.5 + 0.5 * sin(angle * 23.0 + uTime * 0.045);
    float rays = pow(bands, 7.0);
    rays *= smoothstep(0.02, 0.5, r) * (1.0 - smoothstep(0.45, 1.15, r));
    color += cSun * rays * (0.05 + 0.05 * uWarmth);

    // 樹冠の影。右上から大きな面で落ちるので、紙は一様に白くならない。
    vec2 canopyPoint = vec2(0.88, 1.02);
    vec2 canopyDelta = (uv - canopyPoint) * vec2(uAspect, 1.0);
    float canopy = smoothstep(0.35, 1.15, length(canopyDelta));
    color = mix(color * 0.74, color, canopy);

    // 下三分の一は霞。紙の下で白く溶かして、文字の背景を安定させる。
    float haze = (1.0 - smoothstep(0.0, 0.34, uv.y)) * 0.4;
    color = mix(color, cHaze, haze);

    // 8bit のバンディング対策（暗い面ではないが、空は階調が広い）。
    color += (hash21(uv * 1024.0 + fract(uTime) * 60.0) - 0.5) / 255.0;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BOKEH_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec4 aSeed;   // x: x(-1..1) / y: y(-1..1) / z: size / w: phase
  attribute vec4 aDrift;  // x: driftX / y: driftY / z: seconds / w: opacity

  uniform float uTime;
  uniform vec2 uView;

  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    float phase = uTime / max(aDrift.z, 0.001) * 6.28318 + aSeed.w;
    vec2 offset = vec2(sin(phase), cos(phase * 0.7)) * vec2(aDrift.x, aDrift.y) * uView.y;
    float x = aSeed.x * uView.x * 0.5 + offset.x;
    float y = aSeed.y * uView.y * 0.5 + offset.y;
    vec2 quad = position.xy * aSeed.z * uView.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(x + quad.x, y + quad.y, uView.y * 0.12, 1.0);
    vAlpha = aDrift.w;
  }
`;

const BOKEH_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;

  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(0.25, 1.0, d)) * vAlpha;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const SKY_COLORS = DAWN_SKY;

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

  // 失敗したら何も出さない。紙は不透明のまま（従来の見た目）に戻る。
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
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // --- 空 ---------------------------------------------------------------
  const skyScene = new THREE.Scene();
  const skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1.6 },
      uSun: { value: new THREE.Vector2(0.24, 0.82) },
      uWarmth: { value: 0.6 },
      cZenith: { value: new THREE.Color(...SKY_COLORS.zenith) },
      cUpper: { value: new THREE.Color(...SKY_COLORS.upper) },
      cMiddle: { value: new THREE.Color(...SKY_COLORS.middle) },
      cHorizon: { value: new THREE.Color(...SKY_COLORS.horizon) },
      cSun: { value: new THREE.Color(...SKY_COLORS.sun) },
      cHaze: { value: new THREE.Color(...SKY_COLORS.haze) },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
  sky.frustumCulled = false;
  skyScene.add(sky);

  // --- 情景 -------------------------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  const cameraDistance = 50;
  camera.position.set(0, 0, cameraDistance);

  const viewHeightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraDistance;
  const view = { width: viewHeightAtZero, height: viewHeightAtZero };

  const petalTexture = new THREE.TextureLoader().load(petalUrl);
  petalTexture.colorSpace = THREE.SRGBColorSpace;

  // --- 花弁 -------------------------------------------------------------
  const capacity = 160;
  const petals = createPetalGeometry(THREE, capacity);
  const sharedUniforms = {
    uTime: { value: 0 },
    uGust: { value: 0.5 },
    uView: { value: new THREE.Vector2(view.width, view.height) },
    uSpanScale: { value: 1.3 },
  };
  const petalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: petalTexture },
      uTint: { value: new THREE.Color(...DAWN_PETAL_TINT) },
      uAerialTint: { value: new THREE.Color(0.52, 0.36, 0.44) },
      uClearInner: { value: 0 },
      uClearOuter: { value: 0 },
      // 紙の奥なので中央カラムを空ける必要がない。
      uClearStrength: { value: 0 },
      uFarKeep: { value: 1 },
      uOpacityScale: { value: 0.9 },
      uLodBias: { value: 2.4 },
    },
    vertexShader: PETAL_VERTEX,
    fragmentShader: PETAL_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const petalMesh = new THREE.Mesh(petals.geometry, petalMaterial);
  petalMesh.frustumCulled = false;
  petalMesh.renderOrder = 2;
  scene.add(petalMesh);

  // --- 前景ボケ ---------------------------------------------------------
  const bokehCapacity = 8;
  const bokeh = createBokehPetals(bokehCapacity);
  const bokehGeometry = new THREE.InstancedBufferGeometry();
  const bokehSeeds = new THREE.InstancedBufferAttribute(new Float32Array(bokehCapacity * 4), 4);
  const bokehDrift = new THREE.InstancedBufferAttribute(new Float32Array(bokehCapacity * 4), 4);
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
    bokehGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    bokehGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  bokeh.forEach((item, index) => {
    bokehSeeds.setXYZW(index, item.x, item.y, item.size, item.phase);
    bokehDrift.setXYZW(index, item.driftX, item.driftY, item.seconds, item.opacity);
  });
  bokehGeometry.setAttribute("aSeed", bokehSeeds);
  bokehGeometry.setAttribute("aDrift", bokehDrift);
  bokehGeometry.instanceCount = bokeh.length;
  const bokehMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedUniforms.uTime,
      uView: sharedUniforms.uView,
      uColor: { value: new THREE.Color(1.0, 0.9, 0.86) },
    },
    vertexShader: BOKEH_VERTEX,
    fragmentShader: BOKEH_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const bokehMesh = new THREE.Mesh(bokehGeometry, bokehMaterial);
  bokehMesh.frustumCulled = false;
  bokehMesh.renderOrder = 3;
  scene.add(bokehMesh);

  let quality = initialAmbientQualityState(initialIntensity);
  let currentIntensity = initialIntensity;
  let canvasWidth = 0;
  let canvasHeight = 0;

  const applyPetals = (intensity: AmbientIntensity, tier: 0 | 1 | 2 | 3) => {
    const seeds = splitPetalBands(createScenePetals(intensity, tier)).backdrop;
    petals.write(seeds);
  };

  const applyLayout = () => {
    // 紙の奥なので解像度は控えめでよい（DPR 1.5 上限）。前景より先に軽くする。
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
    const heightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraDistance;
    view.height = heightAtZero;
    view.width = heightAtZero * camera.aspect;
    sharedUniforms.uView.value.set(view.width, view.height);
    skyMaterial.uniforms.uAspect.value = camera.aspect;

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
    skyMaterial.uniforms.uTime.value = time;
    skyMaterial.uniforms.uWarmth.value = wind;
    renderer.render(skyScene, skyCamera);
    renderer.autoClear = false;
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
    petals.geometry.dispose();
    petalMaterial.dispose();
    bokehGeometry.dispose();
    bokehMaterial.dispose();
    petalTexture.dispose();
    renderer.dispose();
  };
}
