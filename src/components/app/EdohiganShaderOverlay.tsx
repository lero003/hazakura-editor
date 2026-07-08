import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * EdohiganShaderOverlay
 *
 * 江戸彼岸（静謐）— 最上級・静かだが追随を許さないほど凝った背景。
 *
 * 派手さ（キラキラ・強光・高彩度）は出さず、計算と層の数で上質さを作る:
 *   多帯域の春霞空 → 三重ドメインワープ雲 → 極薄の光の気配
 *   → パララックス空気層 → 浮遊する微粒子 → 桜花弁 3 層
 *   → 手でそっと流す春風 (マウス) → 紙の粒子
 *
 * Boot と語彙同期。テクスチャ無し WebGL2 クアッド。
 * intensity off / reduced-motion では描画しない。
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

// 桜花弁 SDF (Boot 同期)
float petalSdf(vec2 pos) {
  vec2 p = pos;
  float tip = smoothstep(0.0, 0.85, p.y);
  p.x = abs(p.x) + tip * tip * 0.15;
  float mid = 1.0 + 0.30 * clamp(p.y, -0.4, 0.75);
  p.x /= max(mid, 0.5);
  p.y *= 1.22;
  p.y += 0.05;
  float d = length(p) - 0.57;
  d += max(-pos.y - 0.48, 0.0) * 0.62;
  return d;
}

// 二重ドメインワープ雲 — 重いが静か
float softCloud(vec2 uv, float aspect, float t, float scale, float lo, float hi) {
  vec2 p = uv * vec2(aspect, 1.0) * scale + vec2(t * 0.007, t * 0.0018);
  vec2 q = vec2(fbm(p, 5), fbm(p + vec2(5.2, 1.3), 5));
  vec2 r = vec2(
    fbm(p + 1.8 * q + vec2(1.7, 9.2) + t * 0.008, 6),
    fbm(p + 1.8 * q + vec2(8.3, 2.8) - t * 0.006, 6)
  );
  float n = fbm(p + 1.5 * r, 7);
  float c = smoothstep(lo, hi, n);
  // 帯状に置き、地平を埋めない
  c *= smoothstep(0.14, 0.46, uv.y) * smoothstep(1.02, 0.52, uv.y);
  // 水平方向にもう一段のうねり
  c *= 0.75 + 0.25 * smoothstep(0.2, 0.8, fbm(vec2(uv.x * aspect * 0.6 + t * 0.01, 3.1), 3));
  return c;
}

// 浮遊する微粒子 (雪でもボケ玉でもない — 春の空気中の粒)
void drawMotes(
  vec2 uv,
  float aspect,
  float motion,
  float mouseWake,
  vec2 mouseVel,
  out float alpha,
  out vec3 col
) {
  alpha = 0.0;
  col = vec3(0.0);
  float t = u_time * 0.4;
  float scale = 11.0;
  vec2 p = uv * vec2(aspect, 1.0) * scale;
  p.y += t * 0.035 * motion * scale;
  p.x += t * 0.02 * motion * scale + sin(t * 0.15 + uv.y * 4.0) * 0.4;
  p += mouseVel * mouseWake * scale * 0.8;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float aa = 1.3 * scale / max(u_resolution.y, 1.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = cell + vec2(float(i), float(j));
      float r0 = hashCell(id + 101.0);
      if (r0 > 0.18) continue;
      float r1 = hashCell(id + 17.3);
      float r2 = hashCell(id + 33.9);
      vec2 local = f - vec2(float(i), float(j)) + (vec2(r1, r2) - 0.5) * 0.7;
      local.x += sin(t * 0.9 + r0 * 6.0) * 0.08 * motion;
      float rad = 0.04 + r2 * 0.05;
      float d = length(local) - rad;
      float m = 1.0 - smoothstep(-aa, aa * 2.0, d);
      m *= 0.25 + r1 * 0.2;
      if (m < 0.001) continue;
      // 暖白〜ごく薄い桜。雪の純白を避ける
      vec3 c = mix(vec3(0.96, 0.93, 0.92), vec3(0.94, 0.88, 0.90), r1 * 0.5);
      col = mix(col, c, m);
      alpha = max(alpha, m);
    }
  }
}

vec3 drawPetals(
  vec2 uv,
  float aspect,
  float motion,
  vec2 mouseVel,
  float mouseWake,
  float scale,
  float sizeBase,
  float density,
  float drift,
  float fall,
  float follow,
  float gust,
  float timeScale,
  vec3 tipCol,
  vec3 rootCol,
  out float alpha
) {
  alpha = 0.0;
  vec3 col = vec3(0.0);
  float t = u_time * timeScale;

  vec2 p = uv * vec2(aspect, 1.0) * scale;
  p.x += t * drift * motion * scale;
  p.y += t * fall * motion * scale;
  p.x += sin(t * 0.11 + uv.y * 2.2) * 0.35;
  // カーソル近傍でグリッドもわずかに流れる
  p += mouseVel * mouseWake * scale * 0.35;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float aa = 1.25 * scale / max(u_resolution.y, 1.0);
  float velMag = length(mouseVel);

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

      vec2 local = (f - offset) + (vec2(r1, r2) - 0.5) * 0.6;
      float phase = t * (0.4 + r4 * 0.55) + id.x * 1.1 + id.y * 0.7;
      // ひらひら (雪の縦落ちではない)
      local.x += sin(phase) * 0.16 * motion;
      local.y += cos(phase * 0.75 + r5) * 0.07 * motion;
      local.x += sin(t * 0.2 + r2 * 6.28) * 0.05 * motion;

      vec2 toMouse = (u_mouse - uv) * vec2(aspect, 1.0);
      local -= toMouse * mouseWake * follow * scale * 0.28;
      local += mouseVel * mouseWake * scale * gust * (1.0 + velMag * 6.0);

      float sz = sizeBase * (0.8 + r3 * 0.45);
      float spin = (0.1 + r2 * 0.14) * motion + velMag * mouseWake * 1.1 * gust;
      float angle = r1 * 6.28 + t * spin + sin(phase * 0.45) * 0.28;
      vec2 petalLocal = rot2(angle) * (local / max(sz, 1e-4));

      float d = petalSdf(petalLocal) * sz;
      float mask = 1.0 - smoothstep(-aa, aa, d);
      if (mask <= 0.001) continue;

      float rootMix = clamp(-petalLocal.y * 0.55 + 0.42, 0.0, 1.0);
      vec3 petalCol = mix(tipCol, rootCol, rootMix * 0.75);
      // 柔らかい陰影 (紙の上の厚み)
      float shade = smoothstep(-0.2, 0.5, d / max(sz, 1e-4));
      petalCol *= mix(0.90, 1.0, shade);
      // ごく弱い半透明の芯
      float core = smoothstep(0.5, -0.15, d / max(sz, 1e-4));
      petalCol = mix(petalCol, tipCol, core * 0.18);

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

  // ========== 1. 多帯域の春霞空 (低彩度・上質) ==========
  vec3 skyTop = vec3(0.68, 0.75, 0.82);
  vec3 skyUpper = vec3(0.78, 0.82, 0.86);
  vec3 skyMid = vec3(0.88, 0.87, 0.87);
  vec3 skyLow = vec3(0.93, 0.90, 0.89);
  vec3 skyBot = vec3(0.94, 0.91, 0.90); // 和紙へ溶ける地平
  float hy = clamp(uv.y, 0.0, 1.0);
  vec3 sky = mix(skyBot, skyLow, smoothstep(0.0, 0.28, hy));
  sky = mix(sky, skyMid, smoothstep(0.22, 0.55, hy));
  sky = mix(sky, skyUpper, smoothstep(0.48, 0.78, hy));
  sky = mix(sky, skyTop, smoothstep(0.7, 1.0, hy));
  // 水平方向のわずかな色温度差 (安い単色ベタを避ける)
  float warmShift = fbm(vec2(uv.x * aspect * 0.8, uv.y * 0.5 + t * 0.01), 4);
  sky = mix(sky, sky * vec3(1.02, 0.99, 0.98), (warmShift - 0.5) * 0.08);

  // 遠方の光の気配 (ディスク・多条 rays なし)
  vec2 lightPos = vec2(0.74, 0.80);
  vec2 lightVec = (uv - lightPos) * vec2(aspect, 1.0);
  float lightD = length(lightVec);
  float softHalo = exp(-lightD * 3.8) * 0.12 + exp(-lightD * 1.6) * 0.05;
  sky += vec3(1.0, 0.97, 0.94) * softHalo * u_intensity;
  // ごく弱い単軸の光の筋 (1本だけ・低コントラスト)
  float shaft = pow(max(dot(normalize(lightVec + 1e-4), normalize(vec2(-0.2, -1.0))), 0.0), 28.0);
  shaft *= smoothstep(0.95, 0.1, lightD) * 0.06 * u_intensity;
  sky += vec3(1.0, 0.96, 0.93) * shaft;

  vec3 col = sky;

  // ========== 2. 雲 3 層 (パララックス・低コントラストで「見える」) ==========
  // far
  float c0 = softCloud(uv, aspect, t * 0.45, 0.75, 0.36, 0.60);
  float s0 = fbm(uv * vec2(aspect, 1.0) * 0.7 + t * 0.004, 5);
  vec3 cloud0 = mix(vec3(0.78, 0.81, 0.86), vec3(0.97, 0.97, 0.98), smoothstep(0.25, 0.75, s0));
  float e0 = smoothstep(0.08, 0.38, c0) * (1.0 - smoothstep(0.38, 0.88, c0));
  cloud0 = mix(cloud0, vec3(0.96, 0.92, 0.93), e0 * 0.14);
  col = mix(col, cloud0, c0 * 0.58);

  // mid
  float c1 = softCloud(uv + vec2(0.04, -0.02), aspect, t * 0.7, 1.25, 0.38, 0.62);
  float s1 = fbm(uv * vec2(aspect, 1.0) * 1.2 + 3.0, 5);
  vec3 cloud1 = mix(vec3(0.80, 0.82, 0.87), vec3(0.98, 0.98, 0.99), smoothstep(0.2, 0.78, s1));
  float e1 = smoothstep(0.08, 0.36, c1) * (1.0 - smoothstep(0.36, 0.82, c1));
  cloud1 = mix(cloud1, vec3(0.97, 0.93, 0.94), e1 * 0.16);
  col = mix(col, cloud1, c1 * 0.48);

  // near (薄い手前の筋)
  float c2 = softCloud(uv + vec2(-0.06, 0.03), aspect, t * 1.05, 1.95, 0.42, 0.66);
  float s2 = fbm(uv * vec2(aspect, 1.0) * 1.9 + t * 0.012, 4);
  vec3 cloud2 = mix(vec3(0.84, 0.85, 0.88), vec3(0.99, 0.99, 0.995), smoothstep(0.25, 0.8, s2));
  float e2 = smoothstep(0.1, 0.4, c2) * (1.0 - smoothstep(0.4, 0.8, c2));
  cloud2 = mix(cloud2, vec3(0.98, 0.94, 0.95), e2 * 0.12);
  col = mix(col, cloud2, c2 * 0.32);

  // 雲の下のごく弱い影 (立体)
  float underCloud = (c0 * 0.4 + c1 * 0.35) * smoothstep(0.55, 0.25, uv.y);
  col *= 1.0 - underCloud * 0.04;

  // ========== 3. パララックス空気層 2 枚 ==========
  vec2 airUv0 = uv + vec2(t * 0.004, t * 0.002);
  float air0 = fbm(airUv0 * vec2(aspect, 1.0) * 1.8, 6);
  air0 = smoothstep(0.4, 0.7, air0) * 0.07;
  col = mix(col, vec3(0.94, 0.92, 0.92), air0);

  vec2 airUv1 = uv * 1.15 + vec2(-t * 0.006, t * 0.003) + u_mouseVel * 0.02;
  float air1 = fbm(airUv1 * vec2(aspect, 1.0) * 3.1 + 2.0, 5);
  air1 = smoothstep(0.45, 0.72, air1) * 0.05;
  // 極薄桜 — 霧にしない
  col = mix(col, vec3(0.95, 0.91, 0.92), air1);

  // 水平の薄い霞帯 (遠近)
  float band = sin(uv.y * 9.0 + fbm(vec2(uv.x * aspect, uv.y * 2.0 + t * 0.02), 3) * 2.0);
  band = smoothstep(0.55, 0.95, band) * 0.03 * smoothstep(0.2, 0.7, uv.y);
  col = mix(col, vec3(0.96, 0.94, 0.94), band);

  // マウス
  float mouseDist = length((uv - u_mouse) * vec2(aspect, 1.0));
  float mouseWake = smoothstep(0.4, 0.0, mouseDist);
  float velMag = length(u_mouseVel);

  // ========== 4. 微粒子 ==========
  float moteA = 0.0;
  vec3 moteC = vec3(0.0);
  drawMotes(uv, aspect, motion, mouseWake, u_mouseVel, moteA, moteC);
  col = mix(col, moteC, clamp(moteA, 0.0, 1.0) * 0.55);

  // ========== 5. 花弁 3 層 (静かだが存在感あり) ==========
  vec3 petalTip = vec3(0.985, 0.955, 0.955);
  vec3 petalRoot = vec3(0.91, 0.78, 0.82);
  vec3 petalFar = mix(petalTip, petalRoot, 0.18);

  float aFar = 0.0;
  vec3 pFar = drawPetals(
    uv, aspect, motion, u_mouseVel, mouseWake,
    12.0, 0.12, 0.22, 0.022, 0.02,
    0.2, 0.4, 0.42,
    petalFar, mix(petalRoot, petalTip, 0.3),
    aFar
  );
  float aMid = 0.0;
  vec3 pMid = drawPetals(
    uv, aspect, motion, u_mouseVel, mouseWake,
    7.2, 0.17, 0.18, 0.03, 0.028,
    0.4, 0.7, 0.55,
    petalTip, petalRoot,
    aMid
  );
  float aFg = 0.0;
  vec3 pFg = drawPetals(
    uv, aspect, motion, u_mouseVel, mouseWake,
    4.5, 0.23, 0.14, 0.04, 0.035,
    0.65, 1.15, 0.68,
    petalTip, petalRoot,
    aFg
  );

  col = mix(col, pFar, clamp(aFar, 0.0, 1.0) * 0.48);
  col = mix(col, pMid, clamp(aMid, 0.0, 1.0) * 0.62);
  col = mix(col, pFg,  clamp(aFg, 0.0, 1.0) * 0.78);

  // ========== 6. 手の春風 (控えめだが確実に分かる) ==========
  vec3 wakeCol = mix(vec3(1.0, 0.98, 0.96), vec3(0.98, 0.94, 0.95), 0.35);
  col += wakeCol * mouseWake * (0.035 + velMag * 0.2) * u_intensity;
  // wake 内の空気をわずかに明るく
  col = mix(col, col * 1.02 + vec3(0.01, 0.008, 0.008), mouseWake * 0.12 * (0.5 + velMag * 3.0));

  // ========== 7. ビネット + 紙の粒子 ==========
  float vig = smoothstep(1.45, 0.48, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.93, 1.0, vig);

  // 紙の繊維風ノイズ (時間変化を極小に)
  float fiber = fbm(uv * vec2(aspect, 1.0) * 48.0 + 0.02 * sin(t * 0.05), 3);
  col += (fiber - 0.5) * 0.018;
  float grain = (hash21(floor(uv * u_resolution * 0.45) + fract(t * 0.02)) - 0.5) * 0.01;
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
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "unknown compile error";
    console.warn("[EdohiganShaderOverlay] shader compile failed:", info);
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
    const info = gl.getProgramInfoLog(program) ?? "unknown link error";
    console.warn("[EdohiganShaderOverlay] program link failed:", info);
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

const INTENSITY_VALUE: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0.8,
  normal: 1.15,
  dramatic: 1.45,
};

export function EdohiganShaderOverlay({ intensity }: EdohiganShaderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  const isActive = intensity !== "off";

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      return;
    }

    const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) {
      return;
    }

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

    const mouseTargetRef = { x: 0.5, y: 0.5 };
    const mouseSmoothRef = { x: 0.5, y: 0.5 };
    const mousePrevRawRef = { x: 0.5, y: 0.5 };
    const mouseVelSmoothRef = { x: 0, y: 0 };
    let mouseInitialized = false;
    const onMouseMove = (event: MouseEvent) => {
      const nx = event.clientX / Math.max(window.innerWidth, 1);
      const ny = 1.0 - event.clientY / Math.max(window.innerHeight, 1);
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

    const render = () => {
      if (!running) {
        return;
      }
      const time = (performance.now() - startTime) / 1000;

      const velX = mouseTargetRef.x - mousePrevRawRef.x;
      const velY = mouseTargetRef.y - mousePrevRawRef.y;
      mousePrevRawRef.x = mouseTargetRef.x;
      mousePrevRawRef.y = mouseTargetRef.y;
      mouseVelSmoothRef.x += (velX - mouseVelSmoothRef.x) * 0.16;
      mouseVelSmoothRef.y += (velY - mouseVelSmoothRef.y) * 0.16;
      mouseVelSmoothRef.x *= 0.955;
      mouseVelSmoothRef.y *= 0.955;
      mouseSmoothRef.x += (mouseTargetRef.x - mouseSmoothRef.x) * 0.06;
      mouseSmoothRef.y += (mouseTargetRef.y - mouseSmoothRef.y) * 0.06;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(intensityLocation, INTENSITY_VALUE[intensityRef.current]);
      gl.uniform2f(mouseLocation, mouseSmoothRef.x, mouseSmoothRef.y);
      gl.uniform2f(mouseVelLocation, mouseVelSmoothRef.x, mouseVelSmoothRef.y);
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
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return <canvas className="edohigan-canvas" ref={canvasRef} aria-hidden="true" />;
}
