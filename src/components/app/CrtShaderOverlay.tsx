import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * CrtShaderOverlay
 *
 * Ghostty シェーダー風の「あえて読みにくい」CRT 演出のための背景レイヤ。
 * フルスクリーンの `<canvas>` に WebGL2 で CRT 曲率・色収差・スキャン
 * ライン揺らぎ・薄いフィルムノイズを描く。`.app-shell` の背景の上、
 * コンテンツの下 (`z-index: var(--z-base)`) に固定される。
 *
 * 安全上の前提 (docs/security-boundary.md):
 * - 外部テクスチャ / shader の fetch はしない。ノイズはプロシージャル。
 * - `blob:` を生成しないので CSP 変更不要。JS はバンドル = `'self'`。
 * - `prefers-reduced-motion: reduce` と `intensity === "off"` では描画しない。
 *
 * パフォーマンス:
 * - rAF ループは crt テーマ時のみ稼働。アンマウントで cancel + context loss を処理。
 * - devicePixelRatio は 2 に cap し、Retina 大画面での負荷を抑える。
 */

type CrtShaderOverlayProps = {
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

// CRT 風フラグメントシェーダ (全開・「あえて読みにくい」ジョーク演出)。
// - バレル歪み (barrel distortion) で画面端を強く湾曲
// - RGB チャンネルを大きくずらして色収差 (chromatic aberration)
// - 走査線 + 時間揺らぎで CRT スキャンライン
// - プロシージャルノイズで粒状感 + 不定期グリッチ帯
// 描画先は背景レイヤなので、最終色は (描画色 * 強度) + 黒。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;

// 2D ハッシュ / value noise (プロシージャル、外部テクスチャ不要)
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 値ノイズ: 滑らかなランダム
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

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);

  // 不定期グリッチ: 数秒おきに横帯がずれる。ノイズで帯の発生位置を決める。
  float glitchPhase = valueNoise(vec2(floor(u_time * 1.7), 7.0));
  float glitchBand = step(0.86, valueNoise(vec2(floor(uv.y * 18.0), floor(u_time * 3.0))));
  float glitchShift = (glitchPhase - 0.5) * 0.08 * glitchBand;

  // バレル歪み: 中心からの距離で UV を膨らませる (強め)
  vec2 cc = (uv - 0.5) + vec2(glitchShift, 0.0);
  cc.x *= aspect;
  float r2 = dot(cc, cc);
  float distort = 1.0 + r2 * (0.42 * u_intensity);
  cc *= distort;
  cc.x /= aspect;
  uv = cc + 0.5;

  // 画面外へはみ出したら黒 (ビネット端)
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // 色収差: R/G/B を大きく異なる係数でサンプリング位置へずらす。
  float ca = 0.008 * u_intensity;
  float rUv = uv.x + ca;
  float bUv = uv.x - ca;

  // phosphor グリーンの縞模様をノイズで変調。揺らぎで走査線が流れる。
  float scanLine = sin(uv.y * 520.0 + u_time * 2.4);
  float band = 0.5 + 0.5 * sin(uv.y * 90.0 + u_time * 1.1);
  float snow = hash21(floor(uv * u_resolution.xy * 0.5) + floor(u_time * 30.0));
  float grain = hash21(floor(uv * u_resolution.xy) + floor(u_time * 60.0));

  float baseG = 0.075 * u_intensity;
  float scan = 0.72 + 0.28 * band + 0.05 * scanLine;
  float green = baseG * scan + snow * 0.03 * u_intensity + grain * 0.018 * u_intensity;

  float red = green * 0.55 * (1.0 - abs(rUv - uv.x) * 40.0);
  float blue = green * 0.6 * (1.0 - abs(bUv - uv.x) * 40.0);

  // 中心は暗め、端は強いビネットで落とす
  float vignette = smoothstep(1.05, 0.32, length(cc) * 1.12);
  vec3 col = vec3(max(red, 0.0), green, max(blue, 0.0)) * vignette;

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
  subtle: 0.7,
  normal: 1.1,
  dramatic: 1.5,
};

export function CrtShaderOverlay({ intensity }: CrtShaderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // intensity を ref で保持し、effect はマウント時 1 回だけ走らせる。
  // 依存配列を [intensity] にすると、intensity 変更のたびに GL コンテキストを
  // 再構築することになり、WKWebView で描画が止まることがあるため。
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    // intensity === "off" ではシェーダーを描画しない (AmbientBackground と同じガード)
    if (intensityRef.current === "off") {
      return;
    }

    // prefers-reduced-motion ではアニメーションを止める。
    // CSS 側でも canvas を非表示にするが、JS からも起動しないことで
    // rAF ループの負荷を完全にゼロにする。
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
      // WebGL2 未サポート (WKWebView でも稀)。canvas は描画されず、
      // CSS の前景スキャンライン (.crt-overlay) のみで CRT 感を演出する。
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

    // devicePixelRatio を 2 に cap (Retina 26インチ想定の負荷対策)
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
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      // 描画ごとに最新の intensity を ref から読む
      gl.uniform1f(intensityLocation, INTENSITY_VALUE[intensityRef.current]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = window.requestAnimationFrame(render);
    };
    frameId = window.requestAnimationFrame(render);

    // タブ切り替え等で非表示になった後、戻ったときに rAF を再開する。
    // WKWebView では非表示中に rAF が止まり、戻っても再開しないことがある。
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
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLoss);
      // 注: WEBGL_lose_context による明示的な loseContext() は行わない。
      // WKWebView で canvas の描画が永続的に止まることがあるため、
      // リソース削除だけにとどめる。
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  // intensity === "off" のときは canvas を描かない (CSS も非表示になる)
  if (intensity === "off") {
    return null;
  }

  return <canvas className="crt-canvas" ref={canvasRef} aria-hidden="true" />;
}
