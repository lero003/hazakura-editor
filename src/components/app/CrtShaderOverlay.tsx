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
// - 水平ノイズ線バースト (sync 違い風の細い高輝度帯)
// - 全体の低周波フリッカー (管の明滅)
// 描画先は背景レイヤなので、最終色は (描画色 * 強度) + 黒。
//
// ノイズ目立ちの仕組み: u_intensity でベース輝度は一次、ノイズ係数は
// noiseAmp = pow(u_intensity, NOISE_POWER) で累乗効かせる。高強度ほど
// 背景に対するノイズのコントラストが優先して上がる。低コントラスト
// ディスプレイでも砂嵐・粒・線が判別しやすくなる。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;

// === 演出パラメータ (調整用) ===
// ベース輝度。背景が明るくなりすぎないよう u_intensity 一次。
const float BASE_G_COEF   = 0.075;
// ノイズ係数の累乗指数。>1 で高強度ほどノイズが相対的に強く効く。
const float NOISE_POWER   = 1.6;
// 雪 (粗い砂嵐) と粒 (細かい grain) のベース係数。
const float SNOW_COEF     = 0.055;
const float GRAIN_COEF    = 0.034;
// スキャンライン。SCAN_LINES は画面内の本数、流れは SCAN_DRIFT Hz。
const float SCAN_LINES    = 520.0;
const float SCAN_DRIFT    = 2.4;
const float SCAN_AMP      = 0.06;   // 走査線コントラスト
// バンド変調 (太い縞の揺らぎ)。
const float BAND_LINES    = 90.0;
const float BAND_RATE     = 1.1;
const float BAND_AMP      = 0.30;
// グリッチ帯。GLITCH_BANDS は y 方向の分割数、閾値を下げると発生頻度が上がる。
const float GLITCH_RATE   = 1.9;    // 発生タイミングの変動レート
const float GLITCH_BANDS  = 18.0;
const float GLITCH_SLOT   = 3.0;    // 帯の入れ替えレート
const float GLITCH_THRESH = 0.80;   // 0.80 に下げて発生を多く
const float GLITCH_SHIFT  = 0.11;   // ずれ量 (UV 空間)
// バレル歪み係数。
const float BARREL_COEF   = 0.42;
// 色収差ベース係数 (u_intensity で効く)。
const float CA_COEF       = 0.009;
// 水平ノイズ線バースト (sync 違い風)。間欠的に細い高輝度帯が数本流れる。
const float LINE_RATE     = 0.45;   // 発生判定を回すレート (Hz 相当)
const float LINE_THRESH   = 0.78;   // これを超えるとバースト発生
const float LINE_DECAY    = 9.0;    // 帯の本数/減衰傾き
const float LINE_BRIGHT   = 0.22;   // 帯の最大輝度 (noiseAmp で増幅)
const float LINE_WOBBLE   = 35.0;   // 帯の y 座標の揺らぎ周波数
// 全体フリッカー (管の明滅)。CSS の crtFlicker と重複しすぎないよう穏やか。
const float FLICKER_RATE  = 4.7;
const float FLICKER_AMP   = 0.06;   // u_intensity で増幅

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

  // ノイズ系は高強度ほど相対的に強く効くように累乗で増幅する。
  float noiseAmp = pow(u_intensity, NOISE_POWER);

  // 不定期グリッチ: 数秒おきに横帯がずれる。ノイズで帯の発生位置を決める。
  float glitchPhase = valueNoise(vec2(floor(u_time * GLITCH_RATE), 7.0));
  float glitchBand = step(GLITCH_THRESH, valueNoise(vec2(floor(uv.y * GLITCH_BANDS), floor(u_time * GLITCH_SLOT))));
  float glitchShift = (glitchPhase - 0.5) * GLITCH_SHIFT * glitchBand;

  // バレル歪み: 中心からの距離で UV を膨らませる (強め)
  vec2 cc = (uv - 0.5) + vec2(glitchShift, 0.0);
  cc.x *= aspect;
  float r2 = dot(cc, cc);
  float distort = 1.0 + r2 * (BARREL_COEF * u_intensity);
  cc *= distort;
  cc.x /= aspect;
  uv = cc + 0.5;

  // 画面外へはみ出したら黒 (ビネット端)
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // 色収差: R/G/B を大きく異なる係数でサンプリング位置へずらす。
  float ca = CA_COEF * u_intensity;
  float rUv = uv.x + ca;
  float bUv = uv.x - ca;

  // phosphor グリーンの縞模様をノイズで変調。揺らぎで走査線が流れる。
  float scanLine = sin(uv.y * SCAN_LINES + u_time * SCAN_DRIFT);
  float band = 0.5 + 0.5 * sin(uv.y * BAND_LINES + u_time * BAND_RATE);
  float snow = hash21(floor(uv * u_resolution.xy * 0.5) + floor(u_time * 30.0));
  float grain = hash21(floor(uv * u_resolution.xy) + floor(u_time * 60.0));

  float baseG = BASE_G_COEF * u_intensity;
  float scan = 0.72 + BAND_AMP * band + (SCAN_AMP * u_intensity) * scanLine;
  float green = baseG * scan + snow * SNOW_COEF * noiseAmp + grain * GRAIN_COEF * noiseAmp;

  // 水平ノイズ線バースト: LINE_RATE ごとに乱数を引き、LINE_THRESH 超えで
  // 発生。発生中は y を揺らしながら細い高輝度帯を数本足す (sync 違い風)。
  float lineSlot = floor(u_time * LINE_RATE);
  float lineRoll = valueNoise(vec2(lineSlot, 13.0));
  float lineActive = step(LINE_THRESH, lineRoll);
  // 帯の y 座標を時間で揺らす。薄いガウシアン風の断面で細く光らせる。
  float lineY = fract(valueNoise(vec2(lineSlot, 23.0)) + u_time * 0.15);
  float lineWobble = sin(uv.y * LINE_WOBBLE + u_time * 8.0) * 0.5 + 0.5;
  float lineDist = abs(uv.y - lineY);
  float lineBeam = exp2(-lineDist * LINE_DECAY) * lineWobble;
  green += lineBeam * LINE_BRIGHT * noiseAmp * lineActive;

  float red = green * 0.55 * (1.0 - abs(rUv - uv.x) * 40.0);
  float blue = green * 0.6 * (1.0 - abs(bUv - uv.x) * 40.0);

  // 中心は暗め、端は強いビネットで落とす
  float vignette = smoothstep(1.05, 0.32, length(cc) * 1.12);
  vec3 col = vec3(max(red, 0.0), green, max(blue, 0.0)) * vignette;

  // 全体の低周波フリッカー。管が明滅する感じ。高強度ほど振幅が大きい。
  float flicker = 1.0 - FLICKER_AMP * u_intensity * (0.5 + 0.5 * sin(u_time * FLICKER_RATE));
  col *= flicker;

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

// 段階の数値マッピング。off/subtle は据え置き、normal/dramatic を底上げして
// コントラスト低ディスプレイでもノイズが目立つようにする。シェーダー内で
// ノイズ係数は u_intensity の累乗で効かせるので、dramatic の高さが効く。
const INTENSITY_VALUE: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0.7,
  normal: 1.2,
  dramatic: 1.8,
};

export function CrtShaderOverlay({ intensity }: CrtShaderOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // intensity を ref で保持し、描画ループ内で毎フレーム読む。
  // subtle/normal/dramatic 間の切替は ref 経由で即時反映し、GL コンテキストの
  // 再構築を避ける (WKWebView で再構築すると描画が止まることがあるため)。
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  // off↔on の境界だけ effect を再実行する。subtle/normal/dramatic 間の変化では
  // 再構築しない。かつて effect 依存を [] にしていたため、初回 intensity === "off"
  // で一度も GL 初期化が走らず、その後 off→on で canvas は出ても描画ループが
  // 始まらない不具合があった (実機で深海/CRT 演出が復帰しない)。
  const isActive = intensity !== "off";

  useEffect(() => {
    // intensity === "off" ではシェーダーを描画しない (AmbientBackground と同じガード)
    if (!isActive) {
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
  }, [isActive]);

  // intensity === "off" のときは canvas を描かない (CSS も非表示になる)
  if (!isActive) {
    return null;
  }

  return <canvas className="crt-canvas" ref={canvasRef} aria-hidden="true" />;
}
