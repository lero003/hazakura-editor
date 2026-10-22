/**
 * 江戸彼岸の情景 — 仕上げのパイプライン / Post pipeline for the Edohigan scene.
 *
 * 「動画と見紛う」ために足りないのは、形ではなく**光の扱い**だった。
 * ここでは 1 フレームを 4 段に分けて仕上げる:
 *
 *   1. シーンを depth 付きの RenderTarget へ描く
 *   2. 明部だけを半分の解像度へ抜き、ぼかして**ブルーム**にする
 *   3. 深度から**被写界深度**（ピントは木、遠景と足元はぼける）を作る
 *   4. グレーディング・粒子・ビネットを載せて画面へ出す
 *
 * すべて同一オリジンの手続きで、外部テクスチャは読まない。
 */

type ThreeModule = typeof import("three");

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(tDiffuse, vUv).rgb;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float keep = smoothstep(uThreshold, uThreshold + 0.25, luma);
    gl_FragColor = vec4(color * keep, 1.0);
  }
`;

const BLUR_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  varying vec2 vUv;

  void main() {
    // 9 タップのガウス。半分の解像度で回すので、これで十分に広がる。
    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    vec3 sum = texture2D(tDiffuse, vUv).rgb * weights[0];
    for (int index = 1; index < 5; index++) {
      vec2 offset = uDirection * float(index) * 1.6;
      sum += texture2D(tDiffuse, vUv + offset).rgb * weights[index];
      sum += texture2D(tDiffuse, vUv - offset).rgb * weights[index];
    }
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  precision highp float;

  #include <packing>

  uniform sampler2D tDiffuse;
  uniform sampler2D tBloom;
  uniform sampler2D tRays;
  uniform sampler2D tDepth;
  uniform float uRayStrength;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uBloomStrength;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uTime;
  uniform float uExposure;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv;

    // --- 被写界深度 -----------------------------------------------------
    float depth = texture2D(tDepth, uv).x;
    float viewZ = -perspectiveDepthToViewZ(depth, uNear, uFar);
    // ピントは木。そこから離れるほど像を散らす。
    float coc = clamp(abs(viewZ - uFocus) / uAperture, 0.0, 1.0);
    coc = pow(coc, 1.6) * 0.62;

    vec3 color = texture2D(tDiffuse, uv).rgb;
    if (coc > 0.02) {
      // 12 方向の円盤。半径は CoC に比例。
      float radius = coc * 6.0 / uResolution.y;
      vec3 sum = color;
      float total = 1.0;
      for (int index = 0; index < 12; index++) {
        float angle = float(index) * 0.5235988 + coc * 3.0;
        float ring = 0.55 + 0.45 * fract(float(index) * 0.618);
        vec2 offset = vec2(cos(angle), sin(angle)) * radius * ring;
        sum += texture2D(tDiffuse, uv + offset).rgb;
        total += 1.0;
      }
      color = sum / total;
    }

    // --- ブルームと光条 ------------------------------------------------
    vec3 bloom = texture2D(tBloom, uv).rgb;
    color += bloom * uBloomStrength;

    float rays = texture2D(tRays, uv).r;
    color += vec3(1.0, 0.94, 0.82) * rays * uRayStrength;

    // --- グレーディング -------------------------------------------------
    color *= uExposure;
    // 影をわずかに寒く、ハイライトを暖かく。
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(color, color * vec3(0.94, 0.98, 1.08), (1.0 - smoothstep(0.0, 0.55, luma)) * 0.5);
    color = mix(color, color * vec3(1.06, 1.01, 0.94), smoothstep(0.55, 1.0, luma) * 0.5);
    // 彩度は控えめに。上げすぎると「CG の緑」に見える。
    color = mix(vec3(luma), color, 1.14);
    // コントラストの S カーブ。表示色（sRGB）に対して掛けるので、
    // フィルミックな肩ではなく素直な smoothstep に寄せる。
    color = max(color - 0.01, vec3(0.0)) / 0.99;
    color = clamp(color, 0.0, 1.0);
    vec3 shaped = color * color * (3.0 - 2.0 * color);
    color = mix(color, shaped, 0.34);
    // 褪せたフィルムのように、黒を少し持ち上げて暖色へ寄せる。
    // 締めるだけだと「晴れた 3D の昼」に見え、朝の記憶の色にならない。
    color = color * 0.992 + 0.005;
    color *= vec3(1.012, 1.0, 0.985);

    // --- ビネット -------------------------------------------------------
    vec2 centered = (uv - 0.5) * vec2(1.0, uResolution.y / uResolution.x);
    float vignette = 1.0 - smoothstep(0.35, 0.95, length(centered) * 1.55) * uVignette;
    color *= vignette;

    // --- 粒子 -----------------------------------------------------------
    float grain = hash(uv * uResolution + fract(uTime) * 120.0) - 0.5;
    color += grain * uGrain;

    gl_FragColor = vec4(color, 1.0);
  }
`;


const RAY_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2 uSun;
  uniform float uAspect;
  uniform float uDecay;
  varying vec2 vUv;

  void main() {
    // 太陽へ向かって明部を積む。これが「木々を抜けた光の筋」になる。
    const int STEPS = 24;
    vec2 delta = (vUv - uSun) / float(STEPS) * 0.72;
    vec2 coord = vUv;
    float illumination = 1.0;
    float sum = 0.0;
    for (int index = 0; index < STEPS; index++) {
      coord -= delta;
      vec3 texel = texture2D(tDiffuse, coord).rgb;
      float luma = dot(texel, vec3(0.299, 0.587, 0.114));
      // 空全体ではなく、太陽と、枝の隙間から漏れる強い光だけを源にする。
      // これをしないと放射が「全体のかすみ」になって筋が出ない。
      // 雲や明るい地面まで光源にすると画面全体が白い霞になる。
      // 太陽の周囲だけを積み、光の筋と日陰の階調を分ける。
      float sunDistance = length((coord - uSun) * vec2(uAspect, 1.0));
      float source = smoothstep(0.86, 0.99, luma) * exp(-sunDistance * 12.0);
      sum += source * illumination;
      illumination *= uDecay;
    }
    gl_FragColor = vec4(vec3(sum / float(STEPS) * 3.4), 1.0);
  }
`;

export type EdohiganPost = {
  /** シーンを描く先。呼び出し側はここへレンダリングする。 */
  renderTarget: import("three").WebGLRenderTarget;
  /** ポスト処理を通して画面へ出す。 */
  present: (time: number) => void;
  /** 光条の強さ（強度設定に追従させる）。 */
  setRayStrength: (value: number) => void;
  /** ピント面の距離。木の位置に合わせる。 */
  setFocus: (value: number) => void;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
};

export function createEdohiganPost(
  THREE: ThreeModule,
  renderer: import("three").WebGLRenderer,
  width: number,
  height: number,
): EdohiganPost {
  const sceneTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  sceneTarget.depthTexture = new THREE.DepthTexture(width, height);
  sceneTarget.depthTexture.type = THREE.UnsignedIntType;

  const halfWidth = Math.max(1, Math.floor(width / 2));
  const halfHeight = Math.max(1, Math.floor(height / 2));

  const brightTarget = new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const blurTarget = new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const blurTargetB = new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const rayTarget = new THREE.WebGLRenderTarget(halfWidth, halfHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });

  const quad = new THREE.PlaneGeometry(2, 2);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const brightMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: sceneTarget.texture },
      uThreshold: { value: 0.75 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BRIGHT_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: brightTarget.texture },
      uDirection: { value: new THREE.Vector2(1 / halfWidth, 0) },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BLUR_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const rayMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: brightTarget.texture },
      uSun: { value: new THREE.Vector2(0.8, 0.8) },
      uAspect: { value: width / height },
      uDecay: { value: 0.94 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: RAY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: sceneTarget.texture },
      tBloom: { value: blurTargetB.texture },
      tRays: { value: rayTarget.texture },
      uRayStrength: { value: 0.55 },
      tDepth: { value: sceneTarget.depthTexture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uNear: { value: 0.1 },
      uFar: { value: 400 },
      uFocus: { value: 56 },
      uAperture: { value: 165 },
      uBloomStrength: { value: 0.2 },
      uGrain: { value: 0.026 },
      uVignette: { value: 0.28 },
      uTime: { value: 0 },
      uExposure: { value: 1.02 },
    },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  const quadScene = new THREE.Scene();
  const quadMesh = new THREE.Mesh(quad, brightMaterial);
  quadMesh.frustumCulled = false;
  quadScene.add(quadMesh);

  const pass = (material: import("three").ShaderMaterial, target: import("three").WebGLRenderTarget | null) => {
    quadMesh.material = material;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(quadScene, camera);
  };

  const present = (time: number) => {
    compositeMaterial.uniforms.uTime.value = time;

    pass(brightMaterial, brightTarget);

    // 光条は「明部の位置」から放射状に積む。
    rayMaterial.uniforms.tDiffuse.value = brightTarget.texture;
    pass(rayMaterial, rayTarget);

    blurMaterial.uniforms.tDiffuse.value = brightTarget.texture;
    // RT は初期化後に resize される。生成時の寸法ではなく、入力の現在の 1px を使う。
    blurMaterial.uniforms.uDirection.value.set(1 / brightTarget.width, 0);
    pass(blurMaterial, blurTarget);

    blurMaterial.uniforms.tDiffuse.value = blurTarget.texture;
    blurMaterial.uniforms.uDirection.value.set(0, 1 / blurTarget.height);
    pass(blurMaterial, blurTargetB);

    pass(compositeMaterial, null);
  };

  const setSize = (nextWidth: number, nextHeight: number) => {
    sceneTarget.setSize(nextWidth, nextHeight);
    const nextHalfWidth = Math.max(1, Math.floor(nextWidth / 2));
    const nextHalfHeight = Math.max(1, Math.floor(nextHeight / 2));
    brightTarget.setSize(nextHalfWidth, nextHalfHeight);
    blurTarget.setSize(nextHalfWidth, nextHalfHeight);
    blurTargetB.setSize(nextHalfWidth, nextHalfHeight);
    rayTarget.setSize(nextHalfWidth, nextHalfHeight);
    compositeMaterial.uniforms.uResolution.value.set(nextWidth, nextHeight);
    rayMaterial.uniforms.uAspect.value = nextWidth / nextHeight;
  };

  const dispose = () => {
    sceneTarget.dispose();
    sceneTarget.depthTexture?.dispose();
    brightTarget.dispose();
    blurTarget.dispose();
    blurTargetB.dispose();
    rayTarget.dispose();
    rayMaterial.dispose();
    quad.dispose();
    brightMaterial.dispose();
    blurMaterial.dispose();
    compositeMaterial.dispose();
  };

  const setRayStrength = (value: number) => {
    compositeMaterial.uniforms.uRayStrength.value = value;
  };

  const setFocus = (value: number) => {
    compositeMaterial.uniforms.uFocus.value = value;
  };

  return { renderTarget: sceneTarget, present, setRayStrength, setFocus, setSize, dispose };
}
