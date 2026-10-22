import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
import { EdohiganAmbient } from "./EdohiganAmbient";
import {
  createScenePetals,
  sceneIntensityProfile,
  splitPetalBands,
  edohiganWind,
  DAWN_PETAL_TINT,
  type SceneIntensityProfile,
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
import { createEdohiganPost } from "../../features/theme/edohiganPost";

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

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * valueNoise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
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

    // 太陽の芯。木の枝の向こうで白く飛ぶ。
    float disc = smoothstep(0.028, 0.012, r);
    color = mix(color, vec3(1.0, 0.99, 0.95), disc * 0.95);
    // アナモルフィックな筋。横にだけ伸びる弱いフレア。
    float streak = exp(-abs(d.y) * 90.0) * exp(-abs(d.x) * 3.2) * 0.18;
    color += vec3(1.0, 0.95, 0.86) * streak;

    // 雲。ゆっくり流れる FBM。太陽の側は暖かく、下側は灰色に。
    vec2 cloudUv = vec2(uv.x * 2.4 + uTime * 0.004, uv.y * 3.6 - uTime * 0.0012);
    float dense = fbm(cloudUv * 1.5 + 11.0);
    float wisps = fbm(cloudUv * 3.4 + 4.0);
    float cloud = smoothstep(0.44, 0.68, dense * 0.85 + wisps * 0.45);
    // 地平近くと天頂は薄くする（帯状に浮かせる）。
    cloud *= smoothstep(0.36, 0.55, uv.y) * (1.0 - smoothstep(0.9, 1.0, uv.y));
    float sunNear = 1.0 - smoothstep(0.0, 0.75, r);
    vec3 cloudColor = mix(vec3(0.78, 0.8, 0.86), vec3(1.0, 0.98, 0.94), uv.y * 0.6 + sunNear * 0.5);
    color = mix(color, cloudColor, cloud * 0.72);

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
  uniform sampler2D uShadowMap;
  uniform mat4 uLightViewProj;
  uniform float uShadowStrength;

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
    // 大きなムラ（枯れ草・土・湿った窪み）を 2 つのスケールで重ねる。
    float broadPatch = valueNoise(p * 0.021 + 11.0);
    float finePatch = valueNoise(p * 0.06 + 3.0);

    float depth = clamp((10.0 - vWorld.z) / 110.0, 0.0, 1.0);
    vec3 color = mix(cNear, cFar, depth);
    color *= 0.86 + n * 0.24 + fine * 0.08;

    // 乾いた株。緑に麦わら色を混ぜる（一様な緑を崩す）。
    // valueNoise の平均は 0.5。閾値は分布の裾に置き、面全体を枯らさない。
    float blended = broadPatch * 0.7 + finePatch * 0.45;
    float dry = smoothstep(0.66, 0.86, blended);
    color = mix(color, vec3(0.5, 0.46, 0.27), dry * 0.26);

    // 土の見える窪み。
    float soil = smoothstep(0.45, 0.3, blended);
    color = mix(color, vec3(0.3, 0.26, 0.19), soil * 0.3);

    // 陽の当たる面を少し明るく。
    color += vec3(0.06, 0.05, 0.02) * smoothstep(0.55, 0.95, n);

    // 木の根元の影。楕円に薄く落として、木が地面に立っているように見せる。
    float rootShadow = 1.0 - smoothstep(
      0.15,
      1.0,
      length((vWorld.xz - uTreeXZ) / vec2(uTreeRadius, uTreeRadius * 0.5))
    );
    color *= 1.0 - rootShadow * 0.34;

    // 木そのものの影。ライト視点で描いたシルエットを投影する。
    // 4 タップで少しぼかし、輪郭を硬くしすぎない。
    vec4 lightSpace = uLightViewProj * vec4(vWorld, 1.0);
    vec3 shadowCoord = lightSpace.xyz / lightSpace.w * 0.5 + 0.5;
    float shadowMask = 0.0;
    if (shadowCoord.x > 0.0 && shadowCoord.x < 1.0 && shadowCoord.y > 0.0 && shadowCoord.y < 1.0) {
      // 影は 9 タップでぼかす。枝の細い影がギザギザにならないように。
      vec2 texel = vec2(1.0 / 1024.0) * 2.4;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(-1.0, -1.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(0.0, -1.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(1.0, -1.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(-1.0, 0.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(1.0, 0.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(-1.0, 1.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(0.0, 1.0) * texel).r;
      shadowMask += texture2D(uShadowMap, shadowCoord.xy + vec2(1.0, 1.0) * texel).r;
      shadowMask /= 9.0;
    }
    color *= 1.0 - shadowMask * uShadowStrength;

    // 樹冠の影。太陽は右上なので、影は左下へ長く落ちる。
    // 一枚の楕円ではなく、葉のムラを重ねて「木の影」らしくする。
    vec2 canopyCenter = uTreeXZ + vec2(-uTreeRadius * 0.9, uTreeRadius * 0.5);
    float canopy = 1.0 - smoothstep(
      0.1,
      1.0,
      length((vWorld.xz - canopyCenter) / vec2(uTreeRadius * 2.6, uTreeRadius * 1.5))
    );
    float mottle = valueNoise(vWorld.xz * 0.55 + 3.0);
    color *= 1.0 - canopy * (0.08 + mottle * 0.18);

    // 遠景は霞へ溶かす。
    float haze = smoothstep(0.74, 1.0, depth) * 0.62;
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
  uniform float uWindScale;

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
    float s = edohiganSway(uTime, aPhase + spatial, uGust) * uWindScale;
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
    // 奥の枝ほど空気の色へ寄せる。
    vec3 color = mix(cBarkNear, cBarkFar, vDepth01 * 0.55);
    color = mix(color, cHaze, vDepth01 * 0.12);

    // 樹皮のムラ。縦に伸びる筋と、広いまだらを重ねる。
    // floor() で区切ると四角い斑になるので、滑らかな value noise を使う。
    float streak = valueNoise(vec2(vBarkUv.x * 140.0, vBarkUv.y * 5.0));
    float broad = valueNoise(vec2(vBarkUv.x * 18.0, vBarkUv.y * 2.0));
    float fine = valueNoise(vec2(vBarkUv.x * 320.0, vBarkUv.y * 12.0));
    color *= 0.72 + streak * 0.2 + broad * 0.22 + fine * 0.1;

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
  attribute float aShade;
  attribute float aTilt;
  attribute vec3 aNormal;

  uniform float uTime;
  uniform float uGust;
  uniform float uWindScale;

  varying vec2 vUv;
  varying float vTint;
  varying float vShade;
  varying float vAo;
  varying float vLit;

  ${WIND_GLSL}

  void main() {
    vUv = uv;
    // 木と同じ空間位相を使う（同じ風の中にいる）。
    vec3 centerWorld = (modelMatrix * vec4(aCenter, 1.0)).xyz;
    float spatial = (centerWorld.x + centerWorld.z * 0.6) * 0.11;
    float s = edohiganSway(uTime, aPhase + spatial, uGust) * uWindScale;
    // 木と同じ風に乗せる。花は枝先なので重みは最大。
    vec3 center = aCenter + vec3(s * 0.62, sin(uTime * 0.9 + aPhase * 3.0) * 0.05, s * 0.16);

    // 花ごとに向きを変える（全部同じ向きだと並んで見える）。
    float c = cos(aRotation);
    float sn = sin(aRotation);
    vec2 turned = vec2(c * position.x - sn * position.y, sn * position.x + c * position.y);

    // カメラを向く板（ビルボード）。
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    // 少しだけ傾ける。全部が正面向きだと「貼った紙」に見える。
    turned.y *= mix(1.0, 0.55, aTilt);
    vec3 pos = center + (right * turned.x + up * turned.y) * aSize
             + up * (aTilt * aSize * 0.18);

    vTint = aTint;
    vShade = 0.75 + 0.25 * position.y;
    vAo = aShade;
    // 太陽は右上。花の向きとの角度で、樹冠の右側が明るく左側が沈む。
    vec3 sunDir = normalize(vec3(0.62, 0.55, -0.55));
    vLit = clamp(dot(normalize(aNormal), sunDir) * 0.5 + 0.62, 0.0, 1.0);
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
  varying float vAo;
  varying float vLit;

  void main() {
    vec4 sprite = texture2D(uMap, vUv);
    float alpha = sprite.a * vShade;
    if (alpha < 0.02) discard;

    // 花の色はスプライト由来。個体差だけ tint で寄せる。
    vec3 color = sprite.rgb * mix(cPetalDeep, cPetal, vTint);
    // 樹冠の奥は沈め、梢は空を透かして明るく。
    color *= mix(0.52, 1.08, vAo);
    // 向きによる明暗。影側は少し青く、陽側は暖かく。
    color *= mix(0.62, 1.1, vLit);
    color = mix(color * vec3(0.92, 0.95, 1.05), color * vec3(1.05, 1.0, 0.96), vLit);
    gl_FragColor = vec4(color * (0.88 + vShade * 0.2), alpha);
  }
`;


const GRASS_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec3 aOffset;
  attribute float aScale;
  attribute float aPhase;
  attribute float aTint;
  attribute vec2 aShape; // x: 幅 / y: 傾き

  uniform float uTime;
  uniform float uGust;
  uniform float uWindScale;

  varying vec2 vUv;
  varying float vShade;
  varying float vTint;

  ${WIND_GLSL}

  void main() {
    vUv = uv;
    float s = edohiganSway(uTime, aPhase, uGust) * uWindScale;
    float weight = position.y * position.y;

    // カメラの右方向へ向ける（板の向きを揃えない）。
    vec3 right = vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]);
    vec3 local = right * (position.x * aScale * 0.22 * aShape.x)
               + vec3(0.0, position.y * aScale, 0.0);
    // 株ごとに傾ける。全部まっすぐだと「同じ型を並べた」に見える。
    local += right * (aShape.y * weight * aScale * 0.28);
    vec3 pos = aOffset + local + vec3(s * weight * aScale * 0.35, 0.0, 0.0);

    vShade = position.y;
    vTint = aTint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRASS_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 cBase;
  uniform vec3 cTip;

  varying vec2 vUv;
  varying float vShade;
  varying float vTint;

  void main() {
    // 根元は濃く、穂先は淡く。輪郭は上下でぼかす。
    float alpha = smoothstep(0.0, 0.12, vShade) * (1.0 - smoothstep(0.72, 1.0, vShade));
    if (alpha < 0.02) discard;
    vec3 color = mix(cBase, cTip, vShade);
    // 個体差。黄色く枯れた株と、青い株を混ぜる。
    color *= 0.8 + vTint * 0.35;
    color.r += vTint * 0.04;
    gl_FragColor = vec4(color, alpha * 0.45);
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
  haze: [0.9, 0.9, 0.78],
} as const;

const BARK_COLORS = {
  near: [0.16, 0.11, 0.1],
  far: [0.26, 0.19, 0.18],
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

  // 仕上げ（被写界深度・ブルーム・グレーディング）。深度付きの RT を持つ。
  const post = createEdohiganPost(THREE, renderer, 1, 1);

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

  // 影は「ライトから見たシルエット」を別パスで描く。木と同じ風の uniform を
  // 共有するので、影も一緒に揺れる。
  const shadowTarget = new THREE.WebGLRenderTarget(1024, 1024, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });
  const sunDirection = new THREE.Vector3(0.55, 0.8, 0.35).normalize();
  const shadowCamera = new THREE.OrthographicCamera(-40, 40, 40, -40, 1, 260);

  // --- 草原 -------------------------------------------------------------
  const groundGeometry = new THREE.PlaneGeometry(2400, 2400, 1, 1);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      cNear: { value: new THREE.Color(...GROUND_COLORS.near) },
      cFar: { value: new THREE.Color(...GROUND_COLORS.far) },
      cHaze: { value: new THREE.Color(...GROUND_COLORS.haze) },
      uTreeXZ: { value: new THREE.Vector2(0, 0) },
      uTreeRadius: { value: 9 },
      uShadowMap: { value: shadowTarget.texture },
      uLightViewProj: { value: new THREE.Matrix4() },
      uShadowStrength: { value: 0.34 },
    },
    vertexShader: GROUND_VERTEX,
    fragmentShader: GROUND_FRAGMENT,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(0, GROUND_Y, -700);
  scene.add(ground);

  // --- 木 ---------------------------------------------------------------
  const tree = growTree();
  const treeGeometry = buildTreeGeometry(THREE, tree);
  const treeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      uWindScale: { value: 1 },
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

  const shadowScene = new THREE.Scene();
  const shadowMaterial = new THREE.ShaderMaterial({
    uniforms: treeMaterial.uniforms,
    vertexShader: TREE_VERTEX,
    fragmentShader: `
      precision highp float;
      void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
  const shadowMesh = new THREE.Mesh(treeGeometry, shadowMaterial);
  shadowMesh.frustumCulled = false;
  shadowScene.add(shadowMesh);

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
  const shades = new Float32Array(blossomCount);
  const tilts = new Float32Array(blossomCount);
  const normals = new Float32Array(blossomCount * 3);
  tree.blossoms.forEach((blossom, index) => {
    centers[index * 3] = blossom.position[0];
    centers[index * 3 + 1] = blossom.position[1];
    centers[index * 3 + 2] = blossom.position[2];
    sizes[index] = blossom.size;
    phases[index] = blossom.phase;
    tints[index] = blossom.tint;
    rotations[index] = blossom.phase * 1.9;
    shades[index] = blossom.shade;
    tilts[index] = (blossom.phase * 0.618) % 1;
    normals[index * 3] = blossom.normal[0];
    normals[index * 3 + 1] = blossom.normal[1];
    normals[index * 3 + 2] = blossom.normal[2];
  });
  blossomGeometry.setAttribute("aCenter", new THREE.InstancedBufferAttribute(centers, 3));
  blossomGeometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1));
  blossomGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  blossomGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(tints, 1));
  blossomGeometry.setAttribute("aRotation", new THREE.InstancedBufferAttribute(rotations, 1));
  blossomGeometry.setAttribute("aShade", new THREE.InstancedBufferAttribute(shades, 1));
  blossomGeometry.setAttribute("aTilt", new THREE.InstancedBufferAttribute(tilts, 1));
  blossomGeometry.setAttribute("aNormal", new THREE.InstancedBufferAttribute(normals, 3));
  blossomGeometry.instanceCount = blossomCount;

  // 花も影を落とす。BLOSSOM_VERTEX は viewMatrix でビルボードを作るので、
  // 影パスでは「ライトを向いた板」になり、樹冠の影がそのまま出る。
  const blossomShadowMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: BLOSSOM_VERTEX,
    fragmentShader: `
      precision highp float;
      void main() {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const blossomMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      uWindScale: { value: 1 },
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

  blossomShadowMaterial.uniforms = blossomMaterial.uniforms;
  const blossomShadowMesh = new THREE.Mesh(blossomGeometry, blossomShadowMaterial);
  blossomShadowMesh.frustumCulled = false;
  shadowScene.add(blossomShadowMesh);

  // --- 手前の草 ---------------------------------------------------------
  // 画面下端のすぐ外に生えている草。手前の枠として置くと、草原の広さが出る。
  const grassCount = 20;
  const grassGeometry = new THREE.InstancedBufferGeometry();
  {
    // 1 インスタンス = 3 枚の葉の束。手前の草は「1 枚の板」だと形が単調なので、
    // 高さと傾きの違う葉を束ねて、株として見せる。
    const blades = [
      { x: -0.42, height: 0.78, width: 0.5, lean: -0.06 },
      { x: 0.02, height: 1.0, width: 0.42, lean: 0.03 },
      { x: 0.34, height: 0.62, width: 0.4, lean: 0.09 },
    ];
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    blades.forEach((blade, bladeIndex) => {
      const base = bladeIndex * 6;
      const half = blade.width * 0.5;
      const rings = [
        { t: 0, w: half, offset: 0 },
        { t: 0.55, w: half * 0.68, offset: blade.lean * 0.4 },
        { t: 1, w: half * 0.05, offset: blade.lean },
      ];
      for (const ring of rings) {
        positions.push(
          blade.x - ring.w + ring.offset, blade.height * ring.t, 0,
          blade.x + ring.w + ring.offset, blade.height * ring.t, 0,
        );
        uvs.push(0, ring.t, 1, ring.t);
      }
      indices.push(
        base, base + 2, base + 1, base + 1, base + 2, base + 3,
        base + 2, base + 4, base + 3, base + 3, base + 4, base + 5,
      );
    });
    grassGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    grassGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
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
    grassScales[index] = 2.2 + Math.random() * 3.8;
    grassPhases[index] = Math.random() * Math.PI * 2;
  }
  grassGeometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(grassOffsets, 3));
  grassGeometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(grassScales, 1));
  grassGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(grassPhases, 1));
  const grassTints = new Float32Array(grassCount);
  const grassShapes = new Float32Array(grassCount * 2);
  for (let index = 0; index < grassCount; index += 1) {
    grassTints[index] = Math.random();
    grassShapes[index * 2] = 0.7 + Math.random() * 0.7;
    grassShapes[index * 2 + 1] = (Math.random() * 2 - 1) * 0.9;
  }
  grassGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(grassTints, 1));
  grassGeometry.setAttribute("aShape", new THREE.InstancedBufferAttribute(grassShapes, 2));
  grassGeometry.instanceCount = grassCount;
  const grassMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      uWindScale: { value: 1 },
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

  // --- 草原の草（面ではなく、草の集まりとして見せる） ---------------------
  // 地面の板が「塗った緑」に見えないよう、数千本の葉を敷く。
  const fieldCount = 4200;
  const fieldGeometry = new THREE.InstancedBufferGeometry();
  fieldGeometry.setAttribute("position", grassGeometry.getAttribute("position"));
  fieldGeometry.setAttribute("uv", grassGeometry.getAttribute("uv"));
  fieldGeometry.setIndex(grassGeometry.getIndex());
  const fieldOffsets = new Float32Array(fieldCount * 3);
  const fieldScales = new Float32Array(fieldCount);
  const fieldPhases = new Float32Array(fieldCount);
  const fieldTints = new Float32Array(fieldCount);
  // 株ごとにまとめて生やす（一様に散らすと点々に見える）。
  const clumps = 340;
  const clumpX = new Float32Array(clumps);
  const clumpZ = new Float32Array(clumps);
  for (let index = 0; index < clumps; index += 1) {
    clumpX[index] = (Math.random() * 2 - 1) * 110;
    clumpZ[index] = 18 - Math.pow(Math.random(), 0.65) * 105;
  }
  for (let index = 0; index < fieldCount; index += 1) {
    const clump = index % clumps;
    const spread = 0.6 + (index % 7) * 0.12;
    fieldOffsets[index * 3] = clumpX[clump] + (Math.random() - 0.5) * spread * 2;
    fieldOffsets[index * 3 + 1] = GROUND_Y;
    fieldOffsets[index * 3 + 2] = clumpZ[clump] + (Math.random() - 0.5) * spread * 2;
    fieldScales[index] = 0.4 + Math.random() * 1.0;
    fieldPhases[index] = Math.random() * Math.PI * 2;
    fieldTints[index] = Math.random();
  }
  fieldGeometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(fieldOffsets, 3));
  fieldGeometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(fieldScales, 1));
  fieldGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(fieldPhases, 1));
  fieldGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(fieldTints, 1));
  const fieldShapes = new Float32Array(fieldCount * 2);
  for (let index = 0; index < fieldCount; index += 1) {
    fieldShapes[index * 2] = 0.7 + Math.random() * 0.7;
    fieldShapes[index * 2 + 1] = (Math.random() * 2 - 1) * 0.9;
  }
  fieldGeometry.setAttribute("aShape", new THREE.InstancedBufferAttribute(fieldShapes, 2));
  fieldGeometry.instanceCount = fieldCount;
  const fieldMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGust: { value: 0.5 },
      uWindScale: { value: 1 },
      cBase: { value: new THREE.Color(0.16, 0.24, 0.09) },
      cTip: { value: new THREE.Color(0.44, 0.52, 0.24) },
    },
    vertexShader: GRASS_VERTEX,
    fragmentShader: GRASS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
  field.frustumCulled = false;
  field.renderOrder = 3;
  scene.add(field);

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
  let profile = sceneIntensityProfile(initialIntensity);
  let canvasWidth = 0;
  let canvasHeight = 0;

  /** 強度に応じて、花と草の枚数・風の強さ・時間の速さを切り替える。 */
  const applyProfile = (next: SceneIntensityProfile) => {
    profile = next;
    treeMaterial.uniforms.uWindScale.value = next.wind;
    blossomMaterial.uniforms.uWindScale.value = next.wind;
    grassMaterial.uniforms.uWindScale.value = next.wind;
    fieldMaterial.uniforms.uWindScale.value = next.wind;
    const blossomTotal = blossomCount;
    blossomGeometry.instanceCount = Math.max(
      1,
      Math.round(blossomTotal * Math.max(0.2, next.blossomRatio)),
    );
    grassGeometry.instanceCount = Math.max(1, Math.round(grassCount * Math.max(0.2, next.grassRatio)));
    fieldGeometry.instanceCount = Math.max(1, Math.round(fieldCount * Math.max(0.25, next.grassRatio)));
    post.setRayStrength(next.rays);
  };

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
      post.setSize(width, height);
    }
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    const heightAtZero = 2 * Math.tan((45 * Math.PI) / 360) * cameraZ;
    view.height = heightAtZero;
    view.width = heightAtZero * camera.aspect;
    petalUniforms.uView.value.set(view.width, view.height);
    skyMaterial.uniforms.uAspect.value = camera.aspect;

    // 木は画面の右へ。文字のカラム（中央）に幹を置かない。
    // 狭い窓では木を右へ寄せ、少しだけ縮める。本文の右端に幹が重ならないため。
    const narrowWindow = camera.aspect < 1.45;
    const treeScale = TREE_SCALE * (narrowWindow ? 0.92 : 1);
    treeMesh.position.set(view.width * (narrowWindow ? 0.4 : 0.3), GROUND_Y, TREE_DEPTH);
    treeMesh.scale.setScalar(treeScale);
    blossoms.position.copy(treeMesh.position);
    blossoms.scale.setScalar(treeScale);
    groundMaterial.uniforms.uTreeXZ.value.set(treeMesh.position.x, treeMesh.position.z);
    groundMaterial.uniforms.uTreeRadius.value = view.height * 0.2;
  };

  applyLayout();
  applyPetals(currentIntensity, quality.tier);
  applyProfile(sceneIntensityProfile(currentIntensity));
  post.setRayStrength(profile.rays);

  let elapsedSeconds = 0;
  let lastFrameMs = 0;
  let lastDrawMs = 0;
  let frameId = 0;
  let pending = false;
  let running = true;
  let paused = document.hidden || !document.hasFocus();

  const draw = (time: number) => {
    const sceneTime = time * profile.timeScale;

    // ごくゆっくりしたカメラの漂い。前景の草と木のあいだに視差が出て、
    // 「止め絵」ではなく「回っている映像」に見える。
    const drift = Math.sin(sceneTime * 0.045) * profile.wind;
    const rise = Math.cos(sceneTime * 0.031) * profile.wind;
    // 横にはほとんど動かさない。動かすと、位相によっては木の幹が本文に重なる。
    // 前後のドリーと縦の揺れだけで、前景の草との視差を作る。
    camera.position.set(drift * 0.35, 0.5 + rise * 0.25, cameraZ - drift * 1.3);
    camera.lookAt(treeMesh.position.x * 0.35, 2.0, -12);
    camera.updateMatrixWorld();
    const gust = edohiganWind(sceneTime);
    skyMaterial.uniforms.uTime.value = sceneTime;
    groundMaterial.uniforms.uTime.value = sceneTime;
    treeMaterial.uniforms.uTime.value = sceneTime;
    treeMaterial.uniforms.uGust.value = gust;
    blossomMaterial.uniforms.uTime.value = sceneTime;
    blossomMaterial.uniforms.uGust.value = gust;
    petalUniforms.uTime.value = sceneTime;
    petalUniforms.uGust.value = gust;
    grassMaterial.uniforms.uTime.value = sceneTime;
    grassMaterial.uniforms.uGust.value = gust;
    fieldMaterial.uniforms.uTime.value = sceneTime;
    fieldMaterial.uniforms.uGust.value = gust;

    // 1) 影を描く（木だけ、ライト視点）
    shadowMesh.position.copy(treeMesh.position);
    shadowMesh.scale.copy(treeMesh.scale);
    shadowMesh.rotation.copy(treeMesh.rotation);
    blossomShadowMesh.position.copy(blossoms.position);
    blossomShadowMesh.scale.copy(blossoms.scale);
    blossomShadowMesh.rotation.copy(blossoms.rotation);
    // 影のインスタンス数は強度に追従させる（花を間引いたら影も間引く）。
    blossomShadowMesh.visible = blossomGeometry.instanceCount > 0;
    shadowCamera.position
      .copy(treeMesh.position)
      .addScaledVector(sunDirection, 120);
    shadowCamera.lookAt(treeMesh.position.x, treeMesh.position.y + 16, treeMesh.position.z);
    shadowCamera.updateMatrixWorld();
    groundMaterial.uniforms.uLightViewProj.value.multiplyMatrices(
      shadowCamera.projectionMatrix,
      shadowCamera.matrixWorldInverse,
    );
    const previousClear = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(shadowTarget);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(shadowScene, shadowCamera);

    // 2) 本編
    renderer.setClearColor(previousClear, previousAlpha);
    renderer.setRenderTarget(post.renderTarget);
    renderer.render(skyScene, skyCamera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
    renderer.setRenderTarget(null);
    post.present(sceneTime);
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
      applyProfile(sceneIntensityProfile(intensityNow));
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
    fieldGeometry.dispose();
    fieldMaterial.dispose();
    petalTexture.dispose();
    if (blossomTexture !== petalTexture) {
      blossomTexture.dispose();
    }
    shadowTarget.dispose();
    shadowMaterial.dispose();
    blossomShadowMaterial.dispose();
    post.dispose();
    renderer.dispose();
  };
}
