import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";
import {
  ambientMinFrameIntervalMs,
  resolveAmbientDevicePixelRatio,
} from "../../features/theme/ambientRenderBudget";

/**
 * EdohiganShaderOverlay
 *
 * 江戸彼岸 — 「葉桜の余白に、光が差す」。
 *
 * 深海（水）の骨格は借りない。主役は **木漏れ日**：葉の隙間を通って紙に落ちる光。
 * 舞うのは花びらではなく **葉の影**で、画面の大半は余白のまま動かない。
 * 「葉桜」= 花が終わったあとの桜。花吹雪ではなく、葉と光が残る——という
 * このエディタの静けさをそのまま背景にした一枚。
 *
 * 合成は soft-light（薄く）。シェーダは
 *   「白に近い = 何もしない / 明るい = 光 / 暗い = 葉の翳り」を返す。
 * カーソルに反応するのは光の粒だけ（動きそのものは風＝速度場に任せる）。
 *
 * 安全: 外部 fetch なし / blob なし / reduced-motion & intensity off で停止。
 * AA: 分岐ループ内 fwidth 禁止（固定幅の smoothstep のみ）。
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

/* ============================================================================
   江戸彼岸 / Hazakura — 「葉桜の余白に、光が差す」

   このテーマだけの一枚。深海（水）の骨格は借りない。
   主役は **木漏れ日（komorebi）**＝葉の隙間を通って紙に落ちる光。
   舞う花びらではなく、**葉の影**がゆっくり紙の上を渡っていく。

   ハザクラエディタらしさ:
     - 「葉桜」= 花が終わったあとの桜。花吹雪ではなく、葉と光が残る。
     - 「余白」= 画面の大半は空。動くものは少なく、遅い（60〜90s でひと巡り）。
     - 「静けさ」= 彩度は低く、明度は紙の近く。読む文字を絶対に邪魔しない。
     - 「書く面」= 紙の繊維と、左上から差す光の向き。

   合成は soft-light（薄い）。したがってこのシェーダは
     「白に近い = 何もしない / 明るい = 光 / 暗い = 葉の翳り」を返す。
   安全: 外部 fetch なし / blob なし / reduced-motion と intensity off で停止。
   AA: 分岐ループ内で fwidth を使わない（すべて固定幅の smoothstep）。
   ============================================================================ */

#define LEAF_COUNT 9
#define MOTE_COUNT 20

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
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

/* 4 オクターブ固定（ループ上限は const）。 */
float fbm4(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * valueNoise(p);
    p = rot2(0.69) * p * 2.03;
    amp *= 0.5;
  }
  return sum;
}

/* 3 オクターブ（粗いまだらのため）。 */
float fbm3(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amp * valueNoise(p);
    p = rot2(0.69) * p * 2.06;
    amp *= 0.5;
  }
  return sum;
}

/* 木漏れ日と葉の翳りは **同じ場** から作る（光の当たる所に翳りは無い）。
   p は「画面の短辺 = 1」の座標。スケールは 1 セル ≈ 画面の 1/7（≈180px）——
   大きすぎると一枚の塊になり、細かすぎると汚れに見える。 */
float canopyField(vec2 p) {
  vec2 w = vec2(fbm4(p * 2.0 + 11.3), fbm4(p * 2.0 - 4.7));
  return fbm3(p * 4.6 + (w - 0.5) * 1.25);
}

/* 葉の形: 先 (+x) へ細る楕円。p はローカル座標（長辺 = x）。 */
float leafShape(vec2 p) {
  float taper = mix(1.5, 7.0, smoothstep(-0.52, 0.58, p.x));
  return length(vec2(p.x, p.y * taper)) - 0.5;
}

/* 舞う葉。影なので「明度を落とす」側にだけ寄与する。 */
float driftingLeaves(
  vec2 uv,
  float aspect,
  float t,
  float motion,
  vec2 flow,
  out float petalHits
) {
  float shade = 0.0;
  petalHits = 0.0;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  for (int i = 0; i < LEAF_COUNT; i++) {
    float fi = float(i);
    float r1 = hash21(vec2(fi, 3.71));
    float r2 = hash21(vec2(fi, 9.13));
    float r3 = hash21(vec2(fi, 17.37));

    // 落ちる速さは一枚ずつ違う。位相を散らして常に数枚が画面にある。
    float fall = (0.011 + r1 * 0.013) * motion;
    float phase = fract(r2 + t * fall);
    float y = mix(-0.12, 1.12, phase);
    // 横はゆっくり漂い、風（速度場）に少し流される。
    float x = fract(r3 + 0.055 * sin(t * 0.055 + r1 * 6.28) + flow.x * 0.22);
    vec2 pos = vec2((x - 0.5) * aspect, y - 0.5);

    float size = (0.045 + r3 * 0.030) * mix(1.0, 1.35, motion * 0.35);
    vec2 local = (p - pos) / max(size, 1e-4);
    if (dot(local, local) > 4.5) {
      continue;
    }

    // ゆっくり翻る（速いスピンは不自然なシルエットになる）。
    float tumbling = 0.22 * sin(t * (0.05 + r2 * 0.05) + r1 * 6.28);
    vec2 spinLocal = rot2(tumbling) * local;

    float d = leafShape(spinLocal);
    // 影の輪郭。柔らかいが形は読める幅に（広げすぎると「染み」になる）。
    float body = 1.0 - smoothstep(-0.06, 0.02, d);
    if (body <= 0.002) {
      continue;
    }

    // 主脈: 葉の中央をうっすら明るく抜く（影の中の筋）。
    float vein = 1.0 - smoothstep(0.008, 0.045, abs(spinLocal.y));
    // 影は「紙の上に落ちる葉の影」として読める濃さにする（薄すぎると模様にしか見えない）。
    float depth = mix(0.58, 0.40, clamp(r2, 0.0, 1.0));
    float amount = body * (depth - vein * depth * 0.40);
    shade += amount;

    // 遅れて落ちてくる花びらを 2 枚だけ（葉桜＝終わりかけの花）。
    petalHits += step(0.72, r1) * body;
  }
  return clamp(shade, 0.0, 0.70);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float motion = clamp(u_intensity / 1.2, 0.0, 1.5);
  float t = u_time;
  vec2 flow = texture(u_flowField, uv).rg * 2.0 - 1.0;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // multiply 合成なので 1.0 = 紙のまま。ここから**引いた分だけが影**になる。
  // 光は「影を引かなかった場所」として現れる（紙の上の木漏れ日はそう見える）。
  vec3 col = vec3(1.0);

  // 光の向き（左上から差す）。紙の上をゆっくり横切る。
  float sunDir = 1.0 - clamp(uv.x * 0.72 + (1.0 - uv.y) * 0.52, 0.0, 1.0);
  col -= vec3(0.075, 0.066, 0.056) * (1.0 - sunDir);

  // 木漏れ日（主役）。風でわずかに流れる。
  float field = canopyField(p + flow * 0.30 + vec2(t * 0.010, -t * 0.007));
  // 葉の隙間 = 明るい側。1 つの場から光と翳りを同時に作る（光に翳りは無い）。
  // 影を引かない場所＝紙がそのまま見える場所が「光」。multiply では明るくはできないが、
  // 影の無い面が隣接することで光として読める（紙の上の木漏れ日の見え方と同じ）。
  float shade = smoothstep(0.50, 0.18, field);
  // 実測（合成後の画素）で効きが 3% 程度しか出ていなかったので、影の濃さを上げる。
  col -= vec3(0.360, 0.330, 0.310) * shade * motion;

  // 舞う葉（影として落ちる）。
  float petalHits;
  float leaves = driftingLeaves(uv, aspect, t, motion, flow, petalHits);
  col -= vec3(0.80, 0.87, 0.76) * leaves * motion;

  // 遅れて落ちる花びらも、紙の上では薄い影として落ちる。
  float petals = smoothstep(0.0, 1.0, petalHits) * 0.5;
  col -= vec3(0.300, 0.276, 0.266) * petals * motion;

  // 埃（光の粒）。数が少なく、遅い。
  for (int i = 0; i < MOTE_COUNT; i++) {
    float fi = float(i);
    float r1 = hash21(vec2(fi, 2.11));
    float r2 = hash21(vec2(fi, 5.37));
    float r3 = hash21(vec2(fi, 13.9));
    float y = fract(r2 + t * (0.006 + r1 * 0.010) * motion);
    float x = fract(r3 + 0.03 * sin(t * 0.05 + r1 * 6.28) + flow.x * 0.18);
    vec2 pos = vec2((x - 0.5) * aspect, y - 0.5);
    float d = length(p - pos) / (0.0035 + r2 * 0.0035);
    float mote = exp(-d * d * 1.6);
    // カーソルの近くだけ、ほんの少しだけ強く光る。
    float near = 1.0 - smoothstep(0.10, 0.32, length(p - (u_mouse - 0.5) * vec2(aspect, 1.0)));
    col -= vec3(0.150, 0.138, 0.130) * mote * motion * (0.55 + near * 0.45);
  }

  // ディザ: 広い面積の低コントラスト勾配は 8bit でバンディングするため、
  // 画面座標のハッシュで ±0.5/255 だけ散らす（模様ではなくノイズ）。
  float dither = hash21(gl_FragCoord.xy) - 0.5;
  col += dither * (1.6 / 255.0);

  // 端をわずかに落とす（余白の形）。
  col -= vec3(0.070) * smoothstep(0.62, 1.15, length(p * 1.05)) * motion;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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

    // Q-THM-1: share the same intensity-aware DPR cap as the other
    // resident WebGL overlays. Edohigan is calm, but it is still a
    // full-screen canvas and must not bypass the common budget.
    const resize = () => {
      const dpr = resolveAmbientDevicePixelRatio(intensityRef.current);
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
    let lastDrawMs = 0;

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
      const now = performance.now();
      const minInterval = ambientMinFrameIntervalMs(intensityRef.current);
      if (minInterval > 0 && now - lastDrawMs < minInterval) {
        frameId = window.requestAnimationFrame(render);
        return;
      }
      lastDrawMs = now;
      const time = (now - startTime) / 1000;
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
