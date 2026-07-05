import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * EdohiganShaderOverlay
 *
 * 江戸彼岸ジョークテーマのための背景レイヤ。フルスクリーンの `<canvas>` に
 * WebGL2 で「青空を舞い落ちる桜の花吹雪」を描く。
 *
 * アーキテクチャ (EdohiganBootSequence と同じ単一クアッド方式):
 *   ポイントスプライト (gl.POINTS) も速度場テクスチャも使わず、フルスクリーン
 *   クアッド1枚のフラグメントシェーダーで FBM ノイズベースの花吹雪を描く。
 *   テクスチャを使わないことで macOS/WKWebView での安定性を最大化する
 *   (BootSequence が動いた実績のある構造と完全一致)。
 *
 * マウス連動:
 *   u_mouse / u_mouseVel uniform をフラグメントシェーダーへ渡し、カーソル
 *   周辺の花びら (FBM 粒) に風を加える。テクスチャ不要の軽量実装。
 *
 * 演出の骨子:
 * - 背景: 花見の空 = 青空 (上) から薄桃 (下) へのグラデ + 白い雲
 * - 花吹雪: curl noise の風で運ばれる桜色の粒 (FBM smoothstep)
 * - 3層 depth 分離: 手前ほど大きく流れる、奥は穏やか
 *
 * 安全上の前提 (docs/security-boundary.md):
 * - 外部テクスチャ / shader の fetch はしない。すべてプロシージャル。
 * - `blob:` を生成しないので CSP 変更不要。
 * - `prefers-reduced-motion: reduce` と `intensity === "off"` では描画しない。
 *
 * v1.6 残課題: FBM 粒は明背景 (青空) では「モヤ」になり花びらとして認識しにくい。
 * 次スライスで花びらの形を明示的に描く方式 (ポイントスプライトまたは別手法) へ
 * 改善する。現状は青空 + 雲 + 桜色の粒の土台としてコミットする。
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

// 江戸彼岸フラグメントシェーダ (青空を舞う桜の花吹雪 + 雲 + マウス風)。
// EdohiganBootSequence と同じ FBM/curl 構造。テクスチャを使わない。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform vec2 u_mouse;       // 0..1 正規化マウス座標 (上が +1)。lerp 補間済み。
uniform vec2 u_mouseVel;    // 0..1 正規化マウス速度 (かき回す擾乱の強さに)

// 2D ハッシュ / value noise (プロシージャル、外部テクスチャ不要)
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
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += amp * valueNoise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

// curl noise: FBM の勾配を90度回転したベクトル場。花びらを運ぶ風を作る。
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

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);

  float motion = u_intensity / 1.2;

  // === 背景: 花見の空 ===
  // 青空 (上) から薄桃 (下) へのグラデーション。
  vec3 skyBlue = vec3(0.55, 0.78, 0.92);     // 青空
  vec3 skyPale = vec3(0.92, 0.88, 0.93);     // 地平線付近の薄桃
  vec3 sky = mix(skyPale, skyBlue, pow(uv.y, 0.7));

  // 白い雲: 低周波 FBM でふんわりとした雲を描く。
  // 花びら (高周波) と周波数帯を明確に分離するため、雲は特に低周波 (0.9) に。
  vec2 cloudUv = uv * vec2(aspect, 1.0) * 0.9 + vec2(u_time * 0.01, 0.0);
  float cloud = fbm(cloudUv, 4);
  cloud = smoothstep(0.45, 0.72, cloud);
  cloud *= smoothstep(0.2, 1.0, uv.y);
  vec3 cloudColor = vec3(1.0, 0.98, 0.97);
  sky = mix(sky, cloudColor, cloud * 0.6);

  vec3 col = sky;

  // === 風 (curl flow) ===
  vec2 flowPos = uv * vec2(aspect, 1.0) * 2.6 + vec2(u_time * 0.08, u_time * 0.05);
  vec2 baseFlow = curl(flowPos);
  baseFlow *= 0.58 * motion;

  // 下降バイアス: 花びらは風と重力で下へ運ばれる
  float fallField = valueNoise(uv * vec2(aspect, 1.0) * 1.5 + u_time * 0.07);
  baseFlow.y -= (fallField - 0.3) * 0.27 * motion;

  // カーソル周辺の明るみ (春の陽光)
  float mouseDist = length((uv - u_mouse) * vec2(aspect, 1.0));
  float mouseWake = smoothstep(0.35, 0.0, mouseDist);

  // === 3層 depth 分離の花吹雪 ===
  // 深海の閾値 (0.55-0.78) は暗背景向けで、明るい青空では粒が少なすぎる。
  // 閾値を下げ (0.40-0.60 系) て粒密度を上げ、スケールも雲 (0.9) と大きく
  // 分離 (5-12) してパターンが被らないようにする。

  // 前景層: 大きく流れる花びら粒
  float tFg = u_time * 1.8;
  vec2 fgFlow = baseFlow * 1.7;
  fgFlow += u_mouseVel * mouseWake * 2.8;
  vec2 driftedFg = uv + fgFlow * 0.085;
  driftedFg += vec2(
    fbm(driftedFg * vec2(aspect, 1.0) * 7.0 + tFg * 0.10, 3),
    fbm(driftedFg * vec2(aspect, 1.0) * 7.0 + 5.0 - tFg * 0.08, 3)
  ) * 0.011 * motion - 0.0055 * motion;
  float dustFg = fbm(driftedFg * vec2(aspect, 1.0) * 5.0 + tFg * 0.05, 3);
  float particleFg = smoothstep(0.42, 0.60, dustFg);

  // 中景層
  float tNear = u_time * 1.3;
  vec2 nearFlow = baseFlow * 1.3;
  nearFlow += u_mouseVel * mouseWake * 2.2;
  vec2 driftedNear = uv + nearFlow * 0.075;
  driftedNear += vec2(
    fbm(driftedNear * vec2(aspect, 1.0) * 9.0 + tNear * 0.09, 3),
    fbm(driftedNear * vec2(aspect, 1.0) * 9.0 + 5.0 - tNear * 0.07, 3)
  ) * 0.0095 * motion - 0.0048 * motion;
  float dustNear = fbm(driftedNear * vec2(aspect, 1.0) * 7.0 + tNear * 0.04, 4);
  float particleNear = smoothstep(0.40, 0.58, dustNear);

  // 奥層: 穏やか
  float tFar = u_time * 0.8;
  vec2 farFlow = baseFlow * 0.55;
  farFlow += u_mouseVel * mouseWake * 0.6;
  vec2 driftedFar = uv + farFlow * 0.035;
  float dustFar = fbm(driftedFar * vec2(aspect, 1.0) * 11.0 - tFar * 0.025, 3);
  float particleFar = smoothstep(0.42, 0.58, dustFar);

  // 花びらの色: 桜色ベース。青空背景に対してコントラストを持たせる。
  float lightReach = mix(0.65, 1.25, pow(uv.y, 0.85));

  vec3 petalFgColor = vec3(0.92, 0.55, 0.68);    // 前景: 濃い桜色
  vec3 petalNearColor = vec3(0.94, 0.70, 0.80);
  vec3 petalFarColor = vec3(0.92, 0.82, 0.88);   // 奥: 淡い藤桜

  // 加算合成ではなく、花びらが存在する場所では背景を桜色で上書き近くにする。
  // こうしないと明るい青空背景に足しても埋もれてしまう。
  col = mix(col, petalFgColor * lightReach, particleFg * 0.85);
  col = mix(col, petalNearColor * lightReach, particleNear * 0.6);
  col = mix(col, petalFarColor * lightReach, particleFar * 0.35);

  // カーソル周辺の柔らかな明るみ (春の陽光)
  col += vec3(1.0, 0.95, 0.88) * mouseWake * 0.15 * u_intensity;

  // ビネット
  float vig = smoothstep(1.25, 0.45, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.90, 1.0, vig);

  // Reinhard トーンマッピングは使わない。明るい背景 (青空) では
  // Reinhard が中間調を圧縮し、花びらと背景のコントラストを潰してしまう。
  // 代わりに clamp して白飛びだけを防ぐ。
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

    // フルスクリーンクアッド
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

    // マウス位置 (0..1、上が +1) を ref で保持し、rAF ループ内で線形補間。
    const mouseTargetRef = { x: 0.5, y: 0.5 };
    const mouseSmoothRef = { x: 0.5, y: 0.5 };
    const mousePrevRawRef = { x: 0.5, y: 0.5 };
    const mouseVelSmoothRef = { x: 0, y: 0 };
    let mouseInitialized = false;
    const onMouseMove = (event: MouseEvent) => {
      const nx = event.clientX / Math.max(window.innerWidth, 1);
      // clientY は下が +1 なので反転して UV 空間 (上が +1) へ揃える。
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

      // マウス速度: 直前の生の位置との差分。動かしている瞬間だけ非ゼロ。
      const velX = mouseTargetRef.x - mousePrevRawRef.x;
      const velY = mouseTargetRef.y - mousePrevRawRef.y;
      mousePrevRawRef.x = mouseTargetRef.x;
      mousePrevRawRef.y = mouseTargetRef.y;
      mouseVelSmoothRef.x += (velX - mouseVelSmoothRef.x) * 0.12;
      mouseVelSmoothRef.y += (velY - mouseVelSmoothRef.y) * 0.12;
      // マウス位置を滑らかに補間 (lerp)
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
