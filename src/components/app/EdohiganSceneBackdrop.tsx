import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";
import { useReducedMotion } from "../../hooks/app/useReducedMotion";
import { EdohiganAmbient } from "./EdohiganAmbient";
import {
  createScenePetals,
  sceneIntensityProfile,
  splitPetalBands,
  edohiganWind,
  pointerCameraOffset,
  DAWN_PETAL_TINT,
  type SceneIntensityProfile,
} from "../../features/theme/edohiganScene";
import {
  PETAL_FRAGMENT,
  PETAL_VERTEX,
  createPetalGeometry,
} from "../../features/theme/edohiganPetalShader";
import {
  WIND_GLSL,
  growTree,
} from "../../features/theme/edohiganTree";
import { buildTreeGeometry } from "../../features/theme/edohiganTreeGeometry";
import {
  ambientQualityFrameIntervalMs,
  initialAmbientQualityState,
  updateAmbientQuality,
} from "../../features/theme/ambientQuality";
import { nextElapsedSeconds } from "../../features/theme/ambientRenderBudget";
import petalUrl from "../../assets/themes/edohigan-petal.webp";
import { drawBlossomSprite } from "../../features/theme/edohiganBlossomSprite";
import { createEdohiganPost } from "../../features/theme/edohiganPost";
import {
  EDOHIGAN_SUN_DIRECTION,
  EDOHIGAN_SUN_DIRECTION_GLSL,
} from "../../features/theme/edohiganLighting";

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
    // 2 層に分け、手前の層ほど暗く・輪郭を細かくして奥行きを出す。
    float ridgeFar =
      valueNoise(vec2(uv.x * 19.0, 0.5)) * 0.012 + valueNoise(vec2(uv.x * 53.0, 2.0)) * 0.005;
    float ridgeNear =
      valueNoise(vec2(uv.x * 34.0, 7.0)) * 0.016 + valueNoise(vec2(uv.x * 96.0, 4.0)) * 0.007;
    // 梢の粒。帯の中に縦のムラを足して「木の並び」に見せる。
    float crowns = 0.75 + 0.25 * valueNoise(vec2(uv.x * 180.0, 11.0));
    float farBand = smoothstep(0.468, 0.478, uv.y)
                  * (1.0 - smoothstep(0.502 + ridgeFar, 0.510 + ridgeFar, uv.y));
    float nearBand = (smoothstep(0.456, 0.466, uv.y)
                  * (1.0 - smoothstep(0.494 + ridgeNear, 0.502 + ridgeNear, uv.y))) * crowns;
    color = mix(color, vec3(0.62, 0.68, 0.6), farBand * 0.32);
    color = mix(color, vec3(0.42, 0.5, 0.42), nearBand * 0.42);

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
    // 9 タップを広めに取り、枝の細い影を「硬い縁」にしない。
    vec4 lightSpace = uLightViewProj * vec4(vWorld, 1.0);
    vec3 shadowCoord = lightSpace.xyz / lightSpace.w * 0.5 + 0.5;
    float shadowMask = 0.0;
    if (shadowCoord.x > 0.0 && shadowCoord.x < 1.0 && shadowCoord.y > 0.0 && shadowCoord.y < 1.0) {
      vec2 texel = vec2(1.0 / 1024.0) * 4.0;
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
      // 影のテクスチャの縁で影が直線に切れないよう、外周を 0 へ落とす。
      float border = min(
        min(shadowCoord.x, 1.0 - shadowCoord.x),
        min(shadowCoord.y, 1.0 - shadowCoord.y)
      );
      shadowMask *= smoothstep(0.0, 0.14, border);
    }
    color *= 1.0 - shadowMask * uShadowStrength;
    // 影は黒ではなく、空の青を返す（暖色の光に対する寒色の影）。
    color = mix(color, color * vec3(0.9, 0.96, 1.02), shadowMask * 0.75);

    // 樹冠の影。太陽は右上なので、影は左下へ長く落ちる。
    // 一枚の楕円ではなく、葉のムラを重ねて「木の影」らしくする。
    vec2 canopyCenter = uTreeXZ + vec2(-uTreeRadius * 0.9, uTreeRadius * 0.5);
    float canopy = 1.0 - smoothstep(
      0.1,
      1.0,
      length((vWorld.xz - canopyCenter) / vec2(uTreeRadius * 2.6, uTreeRadius * 1.5))
    );
    float mottle = valueNoise(vWorld.xz * 0.55 + 3.0);
    color *= 1.0 - canopy * (0.07 + mottle * 0.15);

    // 遠景は霞へ溶かす。
    float haze = smoothstep(0.74, 1.0, depth) * 0.62;
    color = mix(color, cHaze, haze);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const TREE_VERTEX = /* glsl */ `
  precision highp float;

  attribute float aSway;
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
    // 同じ接点は同じ変位。枝ごとの位相で分岐を引き離さない。
    vec3 baseWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    p += edohiganTreeDisplacement(baseWorld, aSway, uTime, uGust, uWindScale);

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

  const vec3 SUN_DIR = ${EDOHIGAN_SUN_DIRECTION_GLSL};

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
    vec3 normal = normalize(vNormalW);

    // 奥の枝ほど空気の色へ寄せる。
    vec3 color = mix(cBarkNear, cBarkFar, vDepth01 * 0.55);
    color = mix(color, cHaze, vDepth01 * 0.1);

    // 樹皮。桜の幹は縦のひびより、横へ走る皮目（lenticel）が目立つ。
    // u は枝に沿った長さ（m）なので、太い幹と細い枝で模様の密度が揃う。
    float u = vBarkUv.x;
    float v = vBarkUv.y;
    float broad = valueNoise(vec2(u * 1.7, v * 2.6));
    float cracks = valueNoise(vec2(u * 2.1, v * 34.0));
    float crevice = smoothstep(0.48, 0.72, cracks);
    float lent = valueNoise(vec2(u * 21.0, v * 9.0));
    float lenticel = smoothstep(0.58, 0.72, lent);

    // 面のムラ。ひびは暗く、皮目はコルク色に明るく。
    // 皮目は広いムラで疎密を付ける（一様に並ぶと編み物に見える）。
    color *= 0.7 + broad * 0.26 + (1.0 - crevice) * 0.1;
    color += vec3(0.075, 0.058, 0.045) * lenticel * (0.3 + broad * 1.1);
    color *= mix(0.72, 1.0, 1.0 - crevice);

    // 逆光。正面は沈み、太陽側（右上）の面だけが持ち上がる。
    float light = clamp(dot(normal, SUN_DIR), 0.0, 1.0);
    color *= 0.66 + light * 0.4;
    // 梢は花の間へ溶かす。真っ黒な骨格が淡い花より先に目に入らないようにする。
    color *= mix(1.0, 0.8, smoothstep(0.22, 0.8, vDepth01));
    // 空の照り返し。下側へわずかに青を返す。
    color += vec3(0.026, 0.036, 0.05) * clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);

    // 逆光の縁。太陽は木の後ろ（右上）なので、輪郭だけが淡く光る。
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    color += vec3(1.0, 0.86, 0.7) * rim * pow(light, 0.7) * 0.3;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BLOSSOM_VERTEX = /* glsl */ `
  precision highp float;

  attribute vec3 aCenter;
  attribute vec3 aAnchor;
  attribute float aSway;
  attribute float aSize;
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
    // 花の中心ではなく、付いている枝の位置・しなり量で動かす。
    vec3 anchorWorld = (modelMatrix * vec4(aAnchor, 1.0)).xyz;
    vec3 center = aCenter + edohiganTreeDisplacement(anchorWorld, aSway, uTime, uGust, uWindScale);

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
    // 太陽は右上・木の奥。花の向きとの角度で、樹冠の右側が明るく左側が沈む。
    vec3 sunDir = ${EDOHIGAN_SUN_DIRECTION_GLSL};
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
    color *= mix(0.44, 1.12, vAo);
    // 向きによる明暗。影側は少し青く、陽側は暖かく。
    color *= mix(0.56, 1.08, vLit);
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
  near: [0.135, 0.095, 0.085],
  far: [0.215, 0.155, 0.14],
  haze: [0.85, 0.82, 0.78],
} as const;

export type EdohiganSceneBackdropProps = {
  intensity: AmbientIntensity;
};

type BackdropHandle = { dispose: () => void; refresh: () => void };

export function EdohiganSceneBackdrop({ intensity }: EdohiganSceneBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  const backdropRef = useRef<BackdropHandle | null>(null);
  const [failed, setFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const active = intensity !== "off";

  useEffect(() => {
    intensityRef.current = intensity;
    backdropRef.current?.refresh();
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
    let backdrop: BackdropHandle | null = null;

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
        backdrop = startBackdrop(THREE, canvas, intensityRef.current, () => intensityRef.current, {
          animate: !reducedMotion,
        });
        backdropRef.current = backdrop;
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      if (backdropRef.current === backdrop) {
        backdropRef.current = null;
      }
      backdrop?.dispose();
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

// 樹冠の先端まで空の余白で囲み、3ペインでも木の全形を読める大きさにする。
const TREE_SCALE = 1.02;
const GROUND_Y = -10.5;
const TREE_DEPTH = -12;
const TREE_SINK = 0.45;

function startBackdrop(
  THREE: typeof import("three"),
  canvas: HTMLCanvasElement,
  initialIntensity: AmbientIntensity,
  getIntensity: () => AmbientIntensity,
  options: { animate: boolean },
): BackdropHandle {
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
  camera.position.set(0, 0.9, cameraZ);

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
  // 空の太陽（右上・木の奥）と木・花・影で同じ向きを使う。
  const sunDirection = new THREE.Vector3(...EDOHIGAN_SUN_DIRECTION).normalize();
  const shadowCamera = new THREE.OrthographicCamera(-40, 40, 40, -40, 1, 260);
  const shadowFocus = new THREE.Vector3();

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
      uShadowStrength: { value: 0.4 },
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
  // 根張りを地面へ少し沈める。地面と接する線が根のローブになり、
  // 「円錐を地面に置いた」切れ目が見えなくなる。
  treeMesh.position.set(18, GROUND_Y - TREE_SINK, TREE_DEPTH);
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
  let redrawWhenTextureLoads = () => {};
  const petalTexture = new THREE.TextureLoader().load(petalUrl, () => redrawWhenTextureLoads());
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
  const anchors = new Float32Array(blossomCount * 3);
  const blossomSways = new Float32Array(blossomCount);
  const sizes = new Float32Array(blossomCount);
  const tints = new Float32Array(blossomCount);
  const rotations = new Float32Array(blossomCount);
  const shades = new Float32Array(blossomCount);
  const tilts = new Float32Array(blossomCount);
  const normals = new Float32Array(blossomCount * 3);
  tree.blossoms.forEach((blossom, index) => {
    centers[index * 3] = blossom.position[0];
    centers[index * 3 + 1] = blossom.position[1];
    centers[index * 3 + 2] = blossom.position[2];
    anchors.set(blossom.anchor, index * 3);
    blossomSways[index] = blossom.sway;
    sizes[index] = blossom.size;
    tints[index] = blossom.tint;
    rotations[index] = blossom.phase * 1.9;
    shades[index] = blossom.shade;
    tilts[index] = (blossom.phase * 0.618) % 1;
    normals[index * 3] = blossom.normal[0];
    normals[index * 3 + 1] = blossom.normal[1];
    normals[index * 3 + 2] = blossom.normal[2];
  });
  blossomGeometry.setAttribute("aCenter", new THREE.InstancedBufferAttribute(centers, 3));
  blossomGeometry.setAttribute("aAnchor", new THREE.InstancedBufferAttribute(anchors, 3));
  blossomGeometry.setAttribute("aSway", new THREE.InstancedBufferAttribute(blossomSways, 1));
  blossomGeometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 1));
  blossomGeometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(tints, 1));
  blossomGeometry.setAttribute("aRotation", new THREE.InstancedBufferAttribute(rotations, 1));
  blossomGeometry.setAttribute("aShade", new THREE.InstancedBufferAttribute(shades, 1));
  blossomGeometry.setAttribute("aTilt", new THREE.InstancedBufferAttribute(tilts, 1));
  blossomGeometry.setAttribute("aNormal", new THREE.InstancedBufferAttribute(normals, 3));
  blossomGeometry.instanceCount = blossomCount;

  // 花も影を落とす。BLOSSOM_VERTEX は viewMatrix でビルボードを作るので、
  // 影パスでは「ライトを向いた板」になり、樹冠の影がそのまま出る。
  // 板は四角いので、テクスチャの alpha で抜かないと地面に四角い影が並ぶ。
  const blossomShadowMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: BLOSSOM_VERTEX,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vShade;
      void main() {
        if (texture2D(uMap, vUv).a * vShade < 0.3) {
          discard;
        }
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
  // 色の透けとピントを分ける。花形だけ深度へ先に描き、色は柔らかい縁を保つ。
  // 板の四隅は discard するので、空へ四角いピント面を作らない。
  const blossomDepthMaterial = new THREE.ShaderMaterial({
    uniforms: blossomMaterial.uniforms,
    vertexShader: BLOSSOM_VERTEX,
    fragmentShader: blossomShadowMaterial.fragmentShader,
    colorWrite: false,
    depthWrite: true,
  });
  const blossomDepth = new THREE.Mesh(blossomGeometry, blossomDepthMaterial);
  blossomDepth.position.copy(blossoms.position);
  blossomDepth.scale.copy(blossoms.scale);
  blossomDepth.frustumCulled = false;
  scene.add(blossomDepth);

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
    // 舞う花弁は木のまわりに寄せる。画面全体へ一様に散らすと、
    // 「どこから落ちてきたのか」が分からず背景の模様に見える。
    petal.write(seeds.map((seed) => ({ ...seed, x: seed.x * 0.55 + 0.28 })));
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
    // 少し遠く・細くして、窓辺の大木ではなく草原の向こうの一本として見せる。
    const narrowWindow = camera.aspect < 1.45;
    const treeScale = TREE_SCALE * (narrowWindow ? 0.92 : 1);
    treeMesh.position.set(
      view.width * (narrowWindow ? 0.46 : 0.38),
      GROUND_Y - TREE_SINK,
      TREE_DEPTH,
    );
    treeMesh.scale.setScalar(treeScale);
    blossoms.position.copy(treeMesh.position);
    blossoms.scale.setScalar(treeScale);
    blossomDepth.position.copy(treeMesh.position);
    blossomDepth.scale.setScalar(treeScale);
    post.setFocus(cameraZ - TREE_DEPTH);
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
  // マウス追従の目標（-1..1）と、滑らかに寄る現在値。
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  const draw = (time: number) => {
    const sceneTime = time * profile.timeScale;

    // ごくゆっくりしたカメラの漂い。前景の草と木のあいだに視差が出て、
    // 「止め絵」ではなく「回っている映像」に見える。
    const drift = Math.sin(sceneTime * 0.045) * profile.wind;
    const rise = Math.cos(sceneTime * 0.031) * profile.wind;
    // マウス追従。ポインタへ向かって少しだけカメラが寄る。
    // 木より手前の草ほど大きく動くので、平らな絵ではなく厚みが伝わる。
    pointerX += (pointerTargetX - pointerX) * 0.08;
    pointerY += (pointerTargetY - pointerY) * 0.08;
    const aim = pointerCameraOffset(pointerX, pointerY, Math.min(1.25, profile.wind));
    camera.position.set(
      drift * 0.35 + aim.x,
      0.9 + rise * 0.25 + aim.y,
      cameraZ - drift * 1.3,
    );
    camera.lookAt(
      treeMesh.position.x * 0.22 + aim.x * 0.55,
      3.6 + aim.y * 0.35,
      -12,
    );
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
    // 注視点と光源位置の基準を揃え、樹冠を狙っても光の角度を変えない。
    shadowFocus.set(treeMesh.position.x, treeMesh.position.y + 16, treeMesh.position.z);
    shadowCamera.position.copy(shadowFocus).addScaledVector(sunDirection, 120);
    shadowCamera.lookAt(shadowFocus);
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

  const applyCurrentIntensity = () => {
    const intensityNow = getIntensity();
    if (intensityNow !== currentIntensity) {
      currentIntensity = intensityNow;
      quality = initialAmbientQualityState(intensityNow);
      applyPetals(currentIntensity, quality.tier);
      applyLayout();
      applyProfile(sceneIntensityProfile(intensityNow));
    }
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

    applyCurrentIntensity();

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

  const redrawWhenStill = () => {
    if (running && !options.animate) {
      draw(0);
    }
  };
  const onResize = () => {
    applyLayout();
    redrawWhenStill();
  };
  const onVisibility = () => resume();
  const onFocus = () => resume();
  const onBlur = () => pause();
  const onPointerMove = (event: PointerEvent) => {
    pointerTargetX = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    pointerTargetY = (event.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
  };
  const onPointerLeave = () => {
    pointerTargetX = 0;
    pointerTargetY = 0;
  };

  window.addEventListener("resize", onResize);
  if (options.animate) {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
  }

  draw(0);
  // onUpdate は GPU upload 時にしか呼ばれない。静止時は画像の読込完了から再描画する。
  redrawWhenTextureLoads = redrawWhenStill;

  if (options.animate) {
    schedule();
  }

  const dispose = () => {
    running = false;
    if (pending) {
      window.cancelAnimationFrame(frameId);
    }
    pending = false;
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerleave", onPointerLeave);
    sky.geometry.dispose();
    skyMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();
    treeGeometry.dispose();
    treeMaterial.dispose();
    blossomGeometry.dispose();
    blossomMaterial.dispose();
    blossomDepthMaterial.dispose();
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
  return {
    dispose,
    refresh: () => {
      if (!running) return;
      applyCurrentIntensity();
      redrawWhenStill();
    },
  };
}
