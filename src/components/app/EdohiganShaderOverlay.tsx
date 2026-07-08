import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * EdohiganShaderOverlay
 *
 * 江戸彼岸（静謐）— 深海越えを狙う「彼岸の春風」背景。
 *
 * 深海が「水」なら江戸彼岸は「風」。空・雲・光・花粉・花弁が同じ baseFlow に乗り、
 * 手で払うと世界全体が流れて余韻で戻る。
 *
 * 深海から借りる骨格 (パターン参照、描画は固有):
 *   - JS 保持の低解像度 velocity field → RG8 テクスチャ
 *   - 減衰 + 隣接拡散 + 簡易アドベクション
 *   - curl ambient + userFlow を全層に加算
 *
 * 深海にない勝ち筋:
 *   - SDF 桜花弁 (読める形)
 *   - パララックス雲 (第二のキャラクター)
 *   - 薄暮の彼岸空
 *
 * 安全: 外部 fetch なし / blob なし / reduced-motion & intensity off で停止。
 * AA: 分岐ループ内 fwidth 禁止。
 */

type EdohiganShaderOverlayProps = {
  intensity: AmbientIntensity;
};

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform vec2 u_mouse;
uniform vec2 u_mouseVel;
uniform sampler2D u_flowField;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hashCell(vec2 id) {
  return hash21(id * 1.37 + vec2(7.1, 3.3));
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
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

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += amp * valueNoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return v;
}

vec2 curl(vec2 p) {
  float eps = 0.001;
  float n_x_p = fbm(p + vec2(eps, 0.0), 3);
  float n_x_m = fbm(p - vec2(eps, 0.0), 3);
  float n_y_p = fbm(p + vec2(0.0, eps), 3);
  float n_y_m = fbm(p - vec2(0.0, eps), 3);
  float dx = (n_x_p - n_x_m) / (2.0 * eps);
  float dy = (n_y_p - n_y_m) / (2.0 * eps);
  return vec2(dy, -dx);
}

// 桜花弁 SDF — 無理な切れ込みは使わない。
// 柔らかい雫形 (先端やや広く、根部へ細る)。回転しても破綻しないアフィンのみ。
float petalSdf(vec2 pos) {
  vec2 p = pos;
  // 縦長 + 先端 (+y) でわずかに広がる (0除算なし)
  float widen = 0.72 + 0.28 * clamp(p.y * 0.55 + 0.45, 0.0, 1.0);
  p.x /= max(widen, 0.4);
  p.y = p.y * 1.15 + 0.06;
  float d = length(p) - 0.5;
  // 根部を自然に細く (距離場を壊さない緩いバイアス)
  d += smoothstep(0.15, -0.65, pos.y) * 0.22;
  return d;
}

// 風に流れる雲 (domain warp + flow ドリフト)
float windCloud(
  vec2 uv,
  float aspect,
  float t,
  vec2 flow,
  float scale,
  float lo,
  float hi,
  float parallax
) {
  vec2 drift = flow * parallax;
  vec2 p = (uv + drift) * vec2(aspect, 1.0) * scale + vec2(t * 0.012, t * 0.003);
  vec2 q = vec2(fbm(p, 4), fbm(p + 5.2, 4));
  vec2 r = vec2(
    fbm(p + 1.7 * q + t * 0.01, 5),
    fbm(p + 1.7 * q + 8.3, 5)
  );
  float n = fbm(p + 1.4 * r, 6);
  // 強い風で雲が薄く裂ける
  float windMag = length(flow);
  float dens = smoothstep(lo + windMag * 0.08, hi + windMag * 0.05, n);
  dens *= smoothstep(0.08, 0.4, uv.y) * smoothstep(1.05, 0.45, uv.y);
  return dens;
}

vec3 drawPetals(
  vec2 uv,
  float aspect,
  float motion,
  vec2 baseFlow,
  vec2 mouseVel,
  float mouseWake,
  float scale,
  float sizeBase,
  float density,
  float fall,
  float drift,
  float flowMul,
  float timeScale,
  vec3 tipCol,
  vec3 rootCol,
  out float alpha
) {
  alpha = 0.0;
  vec3 col = vec3(0.0);
  float t = u_time * timeScale;

  // グリッド全体を風で運ぶ (落下よりドリフト主)
  vec2 p = uv * vec2(aspect, 1.0) * scale;
  p += baseFlow * flowMul * scale * 0.55;
  p.y += t * fall * motion * scale;
  p.x += t * drift * motion * scale;
  p.x += sin(t * 0.18 + uv.y * 2.5) * 0.4;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float aa = 1.2 * scale / max(u_resolution.y, 1.0);
  float velMag = length(mouseVel);
  float flowMag = length(baseFlow);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 offset = vec2(float(i), float(j));
      vec2 id = cell + offset;
      float r0 = hashCell(id);
      if (r0 > density) continue;

      float r1 = hashCell(id + 7.7);
      float r2 = hashCell(id + 13.3);
      float r3 = hashCell(id + 21.1);
      float r4 = hashCell(id + 29.7);
      float r5 = hashCell(id + 41.3);

      vec2 local = (f - offset) + (vec2(r1, r2) - 0.5) * 0.55;
      float phase = t * (0.35 + r4 * 0.4) + id.x * 1.1 + id.y * 0.7;
      // ひらひら (形を壊さない程度)
      local.x += sin(phase) * 0.10 * motion;
      local.y += cos(phase * 0.75 + r5) * 0.05 * motion;

      // 位置移動のみ。ローカルへ強い flow を足すと形が歪んで見えるので抑える
      local += baseFlow * flowMul * scale * 0.25;
      local += mouseVel * mouseWake * scale * flowMul * (0.6 + velMag * 4.0);

      float sz = sizeBase * (0.82 + r3 * 0.4);
      // ゆっくり翻る (高速スピンは変なシルエットの元)
      float spin = (0.06 + r2 * 0.08) * motion;
      spin += flowMag * 0.35 * flowMul + velMag * mouseWake * 0.6;
      float angle = r1 * 6.28 + t * spin + sin(phase * 0.4) * 0.2;
      vec2 petalLocal = rot2(angle) * (local / max(sz, 1e-4));

      float d = petalSdf(petalLocal) * sz;
      float mask = 1.0 - smoothstep(-aa, aa, d);
      if (mask <= 0.001) continue;

      // 先端白寄り・根部薄紅 (グラデは穏やか)
      float rootMix = clamp(-petalLocal.y * 0.45 + 0.35, 0.0, 1.0);
      vec3 petalCol = mix(tipCol, rootCol, rootMix * 0.65);
      float shade = smoothstep(-0.1, 0.45, d / max(sz, 1e-4));
      petalCol *= mix(0.92, 1.02, shade);

      col = mix(col, petalCol, mask);
      alpha = max(alpha, mask * 0.9);
    }
  }
  return col;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float motion = u_intensity / 1.2;
  float t = u_time;

  // === 春風場: curl + 速度場 + 斜めバイアス ===
  vec2 flowPos = uv * vec2(aspect, 1.0) * 2.4 + vec2(t * 0.07, t * 0.04);
  vec2 baseFlow = curl(flowPos) * 0.52 * motion;
  // 春の斜め風 (雪の真下落下を避ける)
  baseFlow += vec2(0.14, -0.06) * motion;
  float sway = valueNoise(uv * vec2(aspect, 1.0) * 1.4 + t * 0.06);
  baseFlow.x += (sway - 0.5) * 0.2 * motion;

  // ユーザー速度場 (深海と同型: 0.5 中心)
  vec2 userFlow = texture(u_flowField, uv).rg * 2.0 - 1.0;
  // Y: texture は UV 下=0。シェーダー uv.y も下=0 ならそのままだが
  // 本プロジェクトの v_uv は a_position から 0.5+ で上が +1 側。
  // 深海は mouse を 1-y で渡している。flow グリッドも gy = (1-ny)*H で下=0。
  // texture(uv) の v は上が 1 なので、WebGL テクスチャは上が v=1。
  // flow 書き込み: gy = (1-ny)*H で ny=clientY/H 下向き増加 → 画面下が gy=0。
  // GLSL v_uv: y=0 が下、y=1 が上。テクスチャ v=0 が下端に対応するよう
  // アップロード行順と一致させる必要あり。深海は tex をそのまま uv で読む。
  baseFlow += userFlow * (1.0 + 0.45 * motion);

  float mouseDist = length((uv - u_mouse) * vec2(aspect, 1.0));
  float mouseWake = smoothstep(0.45, 0.0, mouseDist);
  float velMag = length(u_mouseVel);
  float flowMag = length(baseFlow);

  // === 1. 薄暮の彼岸空 ===
  // 上: 藍紫 / 中: 藤 / 下: 薄紅 — 深海 teal と差別化、演出が立つ暗さ
  vec3 skyTop = vec3(0.22, 0.20, 0.38);
  vec3 skyMid = vec3(0.42, 0.28, 0.42);
  vec3 skyLow = vec3(0.62, 0.38, 0.42);
  vec3 skyBot = vec3(0.72, 0.48, 0.48);
  float hy = clamp(uv.y, 0.0, 1.0);
  vec3 sky = mix(skyBot, skyLow, smoothstep(0.0, 0.3, hy));
  sky = mix(sky, skyMid, smoothstep(0.25, 0.65, hy));
  sky = mix(sky, skyTop, smoothstep(0.55, 1.0, hy));
  // 色温度のうねり
  float warm = fbm(vec2(uv.x * aspect * 0.7, uv.y + t * 0.015), 4);
  sky = mix(sky, sky * vec3(1.08, 0.95, 0.98), (warm - 0.5) * 0.12);

  // 春光の気配 (右上) — ディスクは薄く、shaft は flow で湾曲
  vec2 lightPos = vec2(0.78, 0.88);
  vec2 lightVec = (uv - lightPos) * vec2(aspect, 1.0);
  lightVec += baseFlow * 0.25; // 風で光が歪む
  float lightD = length(lightVec);
  float halo = exp(-lightD * 3.2) * 0.35 + exp(-lightD * 1.4) * 0.12;
  sky += vec3(1.0, 0.82, 0.78) * halo * u_intensity;

  // 柔らかい光の筋 2 本
  float ang = atan(lightVec.y, lightVec.x);
  float shaft = 0.0;
  shaft += pow(max(cos(ang * 3.0 + t * 0.12 + baseFlow.x * 2.0), 0.0), 14.0) * 0.45;
  shaft += pow(max(cos(ang * 5.5 - t * 0.08), 0.0), 18.0) * 0.28;
  shaft *= smoothstep(1.1, 0.08, lightD) * (0.08 + flowMag * 0.06);
  sky += vec3(1.0, 0.85, 0.8) * shaft * u_intensity;

  vec3 col = sky;

  // === 2. 雲 3 層 (同じ風) ===
  float c0 = windCloud(uv, aspect, t * 0.5, baseFlow, 0.85, 0.34, 0.58, 0.12);
  float s0 = fbm((uv + baseFlow * 0.08) * vec2(aspect, 1.0) * 0.8, 4);
  vec3 cloud0 = mix(vec3(0.35, 0.28, 0.38), vec3(0.85, 0.78, 0.82), smoothstep(0.3, 0.75, s0));
  cloud0 = mix(cloud0, vec3(0.92, 0.72, 0.78), smoothstep(0.1, 0.4, c0) * (1.0 - smoothstep(0.4, 0.85, c0)) * 0.25);
  col = mix(col, cloud0, c0 * 0.72);

  float c1 = windCloud(uv + vec2(0.05, -0.02), aspect, t * 0.85, baseFlow, 1.4, 0.36, 0.6, 0.2);
  float s1 = fbm(uv * vec2(aspect, 1.0) * 1.3 + 2.0, 4);
  vec3 cloud1 = mix(vec3(0.4, 0.3, 0.38), vec3(0.9, 0.82, 0.85), smoothstep(0.25, 0.8, s1));
  cloud1 = mix(cloud1, vec3(0.95, 0.78, 0.82), 0.12);
  col = mix(col, cloud1, c1 * 0.55);

  float c2 = windCloud(uv + vec2(-0.04, 0.03), aspect, t * 1.2, baseFlow, 2.1, 0.4, 0.64, 0.32);
  col = mix(col, vec3(0.88, 0.8, 0.84), c2 * 0.35);

  // 雲下の影
  col *= 1.0 - (c0 * 0.35 + c1 * 0.25) * smoothstep(0.65, 0.2, uv.y) * 0.12;

  // === 3. 霞・花粉 (flow で運ばれる) ===
  vec2 hazeUv = uv + baseFlow * 0.06;
  float haze = fbm(hazeUv * vec2(aspect, 1.0) * 2.8 + t * 0.04, 4);
  haze = smoothstep(0.42, 0.7, haze) * 0.14;
  col = mix(col, vec3(0.78, 0.52, 0.55), haze);

  // 花粉 FBM 粒 (暖色・3層、深海チリに対抗)
  vec2 pFg = uv + baseFlow * 1.5 * 0.08 + u_mouseVel * mouseWake * 0.04;
  pFg += vec2(fbm(pFg * 6.0 + t * 0.1, 3), fbm(pFg * 6.0 - t * 0.08, 3)) * 0.01 * motion;
  float pollenFg = smoothstep(0.5, 0.72, fbm(pFg * vec2(aspect, 1.0) * 4.0 + t * 0.06, 3));
  vec2 pNear = uv + baseFlow * 1.1 * 0.06;
  float pollenNear = smoothstep(0.45, 0.68, fbm(pNear * vec2(aspect, 1.0) * 5.5 + t * 0.04, 4));
  vec2 pFar = uv + baseFlow * 0.5 * 0.04;
  float pollenFar = smoothstep(0.48, 0.65, fbm(pFar * vec2(aspect, 1.0) * 7.0 - t * 0.02, 3));

  col += vec3(0.95, 0.72, 0.78) * pollenFg * 0.18 * u_intensity;
  col += vec3(0.88, 0.62, 0.7) * pollenNear * 0.11 * u_intensity;
  col += vec3(0.7, 0.48, 0.55) * pollenFar * 0.06 * u_intensity;

  // === 4. 彼岸の風の帯 (異質な演出の核) ===
  // 花弁の代わりに「形を無理に作らない」桜色の絹筋。flow に沿って流れる。
  // 深海のチリとも雪とも違う、江戸彼岸固有の気配。
  vec2 ribbonUv = uv + baseFlow * 0.1;
  float ribbonNoise = fbm(ribbonUv * vec2(aspect, 1.0) * 3.2 + t * 0.05, 4);
  // flow 方向へ座標を伸ばして筋にする
  vec2 flowDir = normalize(baseFlow + vec2(0.2, -0.05));
  float along = dot((uv - 0.5) * vec2(aspect, 1.0), flowDir);
  float across = dot((uv - 0.5) * vec2(aspect, 1.0), vec2(-flowDir.y, flowDir.x));
  float ribbon = smoothstep(0.55, 0.82, ribbonNoise);
  ribbon *= exp(-across * across * 28.0) * 0.55; // 細い帯
  ribbon *= 0.5 + 0.5 * sin(along * 9.0 + t * 0.4 + ribbonNoise * 4.0);
  ribbon *= smoothstep(0.1, 0.5, uv.y) * smoothstep(1.0, 0.35, uv.y);
  // 第2の帯 (位相ずらし)
  float ribbon2 = smoothstep(0.5, 0.78, fbm(ribbonUv * vec2(aspect, 1.0) * 4.5 + 3.0, 3));
  ribbon2 *= exp(-pow(across + 0.08, 2.0) * 40.0) * 0.35;
  ribbon2 *= 0.5 + 0.5 * sin(along * 12.0 - t * 0.5);
  float ribbons = (ribbon + ribbon2) * (0.7 + flowMag * 0.8 + mouseWake * 0.4);
  col += vec3(0.95, 0.65, 0.72) * ribbons * 0.28 * u_intensity;

  // === 5. 花弁 2 層 — 雫形・少なめ・ゆっくり (形が読める枚数) ===
  vec3 tip = vec3(0.99, 0.94, 0.95);
  vec3 root = vec3(0.9, 0.62, 0.7);

  float aFar = 0.0;
  vec3 farP = drawPetals(
    uv, aspect, motion, baseFlow, u_mouseVel, mouseWake,
    9.5, 0.14, 0.16, 0.03, 0.035, 0.55, 0.45,
    mix(tip, root, 0.15), mix(root, tip, 0.3), aFar
  );
  float aFg = 0.0;
  vec3 fgP = drawPetals(
    uv, aspect, motion, baseFlow, u_mouseVel, mouseWake,
    5.2, 0.2, 0.12, 0.045, 0.05, 1.0, 0.65,
    tip, root, aFg
  );

  col = mix(col, farP, clamp(aFar, 0.0, 1.0) * 0.5);
  col = mix(col, fgP,  clamp(aFg, 0.0, 1.0) * 0.78);

  // === 6. 手の陽光 ===
  vec3 wake = mix(vec3(1.0, 0.9, 0.85), vec3(1.0, 0.8, 0.85), 0.4);
  col += wake * mouseWake * (0.1 + velMag * 0.45 + flowMag * 0.15) * u_intensity;

  // ビネット
  float vig = smoothstep(1.4, 0.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.82, 1.0, vig);

  // ごく薄い grain (暗背景向け)
  float grain = (hash21(floor(uv * u_resolution * 0.4) + fract(t * 0.03)) - 0.5) * 0.015;
  col += grain;

  col = clamp(col, 0.0, 1.0);
  fragColor = vec4(col, 1.0);
}
`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(
      "[EdohiganShaderOverlay] shader compile failed:",
      gl.getShaderInfoLog(shader) ?? "unknown",
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | null {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(
      "[EdohiganShaderOverlay] program link failed:",
      gl.getProgramInfoLog(program) ?? "unknown",
    );
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

const INTENSITY_VALUE: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0.85,
  normal: 1.2,
  dramatic: 1.6,
};

// 速度場グリッド (深海パターン参照、余韻は春風向けにやや長め)
const FLOW_GRID_W = 48;
const FLOW_GRID_H = 27;
const FLOW_CELLS = FLOW_GRID_W * FLOW_GRID_H;

function createFlowField(): Float32Array {
  const arr = new Float32Array(FLOW_CELLS * 2);
  arr.fill(0.5);
  return arr;
}

export function EdohiganShaderOverlay({ intensity }: EdohiganShaderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  const isActive = intensity !== "off";

  useEffect(() => {
    if (!isActive) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const intensityLocation = gl.getUniformLocation(program, "u_intensity");
    const mouseLocation = gl.getUniformLocation(program, "u_mouse");
    const mouseVelLocation = gl.getUniformLocation(program, "u_mouseVel");
    const flowFieldLocation = gl.getUniformLocation(program, "u_flowField");

    // === 速度場テクスチャ (深海と同型パターン) ===
    const flowTex = gl.createTexture();
    const flowA = createFlowField();
    const flowB = createFlowField();
    let flowRead = flowA;
    let flowWrite = flowB;
    const flowBytes = new Uint8Array(FLOW_CELLS * 2).fill(128);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, flowTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG8,
      FLOW_GRID_W,
      FLOW_GRID_H,
      0,
      gl.RG,
      gl.UNSIGNED_BYTE,
      flowBytes,
    );

    const mouseTargetRef = { x: 0.5, y: 0.5 };
    const mouseSmoothRef = { x: 0.5, y: 0.5 };
    const mousePrevRawRef = { x: 0.5, y: 0.5 };
    const mouseVelSmoothRef = { x: 0, y: 0 };
    let mouseInitialized = false;

    // 春風: 深海よりやや強く・広めで「払った感」
    const FLOW_FORCE_BOOST = 9.5;
    const FLOW_RADIUS = 3.5;
    const onMouseMove = (event: MouseEvent) => {
      const nx = event.clientX / Math.max(window.innerWidth, 1);
      const ny = event.clientY / Math.max(window.innerHeight, 1);
      if (!mouseInitialized) {
        mousePrevRawRef.x = nx;
        mousePrevRawRef.y = ny;
        mouseTargetRef.x = nx;
        mouseTargetRef.y = ny;
        mouseSmoothRef.x = nx;
        mouseSmoothRef.y = ny;
        mouseInitialized = true;
        return;
      }
      const vx = nx - mousePrevRawRef.x;
      const vy = ny - mousePrevRawRef.y;
      const gx = nx * FLOW_GRID_W;
      const gy = (1.0 - ny) * FLOW_GRID_H;
      const x0 = Math.max(0, Math.floor(gx - FLOW_RADIUS));
      const x1 = Math.min(FLOW_GRID_W - 1, Math.ceil(gx + FLOW_RADIUS));
      const y0 = Math.max(0, Math.floor(gy - FLOW_RADIUS));
      const y1 = Math.min(FLOW_GRID_H - 1, Math.ceil(gy + FLOW_RADIUS));
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx + 0.5 - gx;
          const dy = yy + 0.5 - gy;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > FLOW_RADIUS * FLOW_RADIUS) continue;
          const fall = Math.exp(-dist2 / (2.0 * (FLOW_RADIUS * 0.5) ** 2));
          const idx = (yy * FLOW_GRID_W + xx) * 2;
          flowRead[idx] = Math.max(
            0,
            Math.min(1, flowRead[idx] + vx * FLOW_FORCE_BOOST * fall),
          );
          flowRead[idx + 1] = Math.max(
            0,
            Math.min(1, flowRead[idx + 1] + vy * FLOW_FORCE_BOOST * fall),
          );
        }
      }
      mouseTargetRef.x = nx;
      mouseTargetRef.y = ny;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let startTime = performance.now();
    let frameId = 0;
    let running = true;

    // 余韻は深海より長め (減衰弱め)
    const FLOW_DAMPING = 0.005;
    const FLOW_DIFFUSE = 0.13;
    const FLOW_ADVECT = 0.55;
    const stepFlowField = () => {
      for (let yy = 0; yy < FLOW_GRID_H; yy++) {
        for (let xx = 0; xx < FLOW_GRID_W; xx++) {
          const idx = (yy * FLOW_GRID_W + xx) * 2;
          const curVx = flowRead[idx] * 2 - 1;
          const curVy = flowRead[idx + 1] * 2 - 1;
          const srcX = xx - curVx * FLOW_ADVECT;
          const srcY = yy - curVy * FLOW_ADVECT;
          const sx = Math.max(0, Math.min(FLOW_GRID_W - 1.001, srcX));
          const sy = Math.max(0, Math.min(FLOW_GRID_H - 1.001, srcY));
          const x0 = Math.floor(sx);
          const y0 = Math.floor(sy);
          const fx = sx - x0;
          const fy = sy - y0;
          const x1 = Math.min(FLOW_GRID_W - 1, x0 + 1);
          const y1 = Math.min(FLOW_GRID_H - 1, y0 + 1);
          const i00 = (y0 * FLOW_GRID_W + x0) * 2;
          const i10 = (y0 * FLOW_GRID_W + x1) * 2;
          const i01 = (y1 * FLOW_GRID_W + x0) * 2;
          const i11 = (y1 * FLOW_GRID_W + x1) * 2;
          const v00x = flowRead[i00] * 2 - 1;
          const v00y = flowRead[i00 + 1] * 2 - 1;
          const v10x = flowRead[i10] * 2 - 1;
          const v10y = flowRead[i10 + 1] * 2 - 1;
          const v01x = flowRead[i01] * 2 - 1;
          const v01y = flowRead[i01 + 1] * 2 - 1;
          const v11x = flowRead[i11] * 2 - 1;
          const v11y = flowRead[i11 + 1] * 2 - 1;
          const topX = v00x + (v10x - v00x) * fx;
          const topY = v00y + (v10y - v00y) * fx;
          const botX = v01x + (v11x - v01x) * fx;
          const botY = v01y + (v11y - v01y) * fx;
          let vx = topX + (botX - topX) * fy;
          let vy = topY + (botY - topY) * fy;
          vx *= 1 - FLOW_DAMPING;
          vy *= 1 - FLOW_DAMPING;
          let sumX = 0;
          let sumY = 0;
          let count = 0;
          if (xx > 0) {
            const n = (yy * FLOW_GRID_W + (xx - 1)) * 2;
            sumX += flowRead[n] * 2 - 1;
            sumY += flowRead[n + 1] * 2 - 1;
            count++;
          }
          if (xx < FLOW_GRID_W - 1) {
            const n = (yy * FLOW_GRID_W + (xx + 1)) * 2;
            sumX += flowRead[n] * 2 - 1;
            sumY += flowRead[n + 1] * 2 - 1;
            count++;
          }
          if (yy > 0) {
            const n = ((yy - 1) * FLOW_GRID_W + xx) * 2;
            sumX += flowRead[n] * 2 - 1;
            sumY += flowRead[n + 1] * 2 - 1;
            count++;
          }
          if (yy < FLOW_GRID_H - 1) {
            const n = ((yy + 1) * FLOW_GRID_W + xx) * 2;
            sumX += flowRead[n] * 2 - 1;
            sumY += flowRead[n + 1] * 2 - 1;
            count++;
          }
          if (count > 0) {
            vx += (sumX / count - vx) * FLOW_DIFFUSE;
            vy += (sumY / count - vy) * FLOW_DIFFUSE;
          }
          flowWrite[idx] = vx * 0.5 + 0.5;
          flowWrite[idx + 1] = vy * 0.5 + 0.5;
        }
      }
      const tmp = flowRead;
      flowRead = flowWrite;
      flowWrite = tmp;
    };

    const render = () => {
      if (!running) return;
      const time = (performance.now() - startTime) / 1000;
      stepFlowField();

      const velX = mouseTargetRef.x - mousePrevRawRef.x;
      const velY = mouseTargetRef.y - mousePrevRawRef.y;
      mousePrevRawRef.x = mouseTargetRef.x;
      mousePrevRawRef.y = mouseTargetRef.y;
      mouseVelSmoothRef.x += (velX - mouseVelSmoothRef.x) * 0.14;
      mouseVelSmoothRef.y += (velY - mouseVelSmoothRef.y) * 0.14;
      mouseSmoothRef.x += (mouseTargetRef.x - mouseSmoothRef.x) * 0.07;
      mouseSmoothRef.y += (mouseTargetRef.y - mouseSmoothRef.y) * 0.07;

      for (let i = 0; i < FLOW_CELLS * 2; i++) {
        flowBytes[i] = flowRead[i] * 255;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, flowTex);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        FLOW_GRID_W,
        FLOW_GRID_H,
        gl.RG,
        gl.UNSIGNED_BYTE,
        flowBytes,
      );

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(intensityLocation, INTENSITY_VALUE[intensityRef.current]);
      // 深海と同様: clientY 下向き → UV 上が +1
      gl.uniform2f(mouseLocation, mouseSmoothRef.x, 1.0 - mouseSmoothRef.y);
      gl.uniform2f(mouseVelLocation, mouseVelSmoothRef.x, -mouseVelSmoothRef.y);
      if (flowFieldLocation) {
        gl.uniform1i(flowFieldLocation, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = window.requestAnimationFrame(render);
    };
    frameId = window.requestAnimationFrame(render);

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && running && frameId === 0) {
        startTime = performance.now();
        frameId = window.requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleContextLoss = () => {
      running = false;
      frameId = 0;
    };
    canvas.addEventListener("webglcontextlost", handleContextLoss);

    return () => {
      running = false;
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLoss);
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
      gl.deleteTexture(flowTex);
    };
  }, [isActive]);

  if (!isActive) return null;

  return <canvas className="edohigan-canvas" ref={canvasRef} aria-hidden="true" />;
}
