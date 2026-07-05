import { useEffect, useRef, useState } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * ShinkaiBootSequence
 *
 * 深海ジョークテーマへの切り替え (false → true) で流れる 2.4 秒の
 * 「海へ潜る」起動演出。ShinkaiShaderOverlay と同じ WebGL 語彙
 * (4本の光の柱・深度グラデ・Reinhard) で描き、ブート終了後に通常画面へ
 * 連続的に繋がる。光の柱が上端から静かに伸び、伸び切ったらフェードアウト
 * して edit 画面へ移行するシンプル演出 (粒子・流れは持たない)。
 *
 * ストーリー (海へ潜る):
 *   descend (0.0〜1.1s)  : 真暗な海。上端から4本の光柱が静かに差し込む
 *   awaken  (1.1〜1.5s)  : 光が水中へ広がる
 *   rise    (1.5〜1.7s)  : 世界が開く
 *   surface (1.7〜2.4s)  : ブート全面がフェードアウト、背面 canvas が現れる
 *   done    (2.4s)
 *
 * 設計上のポイント:
 *   - WebGL2 コンテキスト取得・シェーダーコンパイルは発火時に 1 回だけ。
 *     phase ごとに再取得しない (コンテキストの再取得は重く、同一 canvas への
 *     再 getContext は null を返すリスクがあるため)。
 *   - 描画ループは phase 非依存。performance.now() の絶対経過時間から
 *     u_progress (0..1) を計算して駆動する。
 *   - phase state は CSS クラス (.shinkai-boot-${phase}) と canvas マスク
 *     連動 (.shinkai-boot-surface) のためだけに使う。
 *
 * ガード:
 *   - prefers-reduced-motion: reduce → 即 done (演出スキップ)
 *   - intensity === "off" → 即 done (他 shinkai 演出と一貫)
 *   - trigger が true のままでも初回マウントで一度だけ発火する
 *     (アプリ起動時に shinkai テーマなら自動発生)
 */

type ShinkaiBootSequenceProps = {
  intensity: AmbientIntensity;
  trigger: boolean;
};

type Phase = "descend" | "awaken" | "rise" | "surface" | "done";

const PHASE_TIMINGS: { phase: Phase; at: number }[] = [
  { phase: "descend", at: 0 },
  { phase: "awaken", at: 1100 },
  { phase: "rise", at: 1500 },
  { phase: "surface", at: 1700 },
  { phase: "done", at: 2400 },
];

const TOTAL_MS = PHASE_TIMINGS[PHASE_TIMINGS.length - 1].at; // 2400

// === 深度グラデ配色 (ShinkaiShaderOverlay と共有) ===
// shallow/deep を両シェーダーで同一に保ち、ブート終了時に edit 画面へ
// 連続的に繋がるようにする。変更時は ShinkaiShaderOverlay.tsx 側も更新すること
// (両ファイルに同名定数として保持。ズレは diff で検出可能)。
const SHALLOW_WATER_COLOR = "vec3(0.12, 0.38, 0.46)";
const DEEP_WATER_COLOR = "vec3(0.015, 0.09, 0.16)";

function computeInitialPhase(
  intensity: AmbientIntensity,
  trigger: boolean,
): Phase {
  if (!trigger) {
    return "done";
  }
  if (intensity === "off") {
    return "done";
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "done";
  }
  return "descend";
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 深海起動演出用フラグメントシェーダー。
// ShinkaiShaderOverlay の本命シェーダーから、速度場・mousemove 連動・
// カーソル明るみ・前景粒子・curl flow を除外し、光の柱 (4本) と深度グラデ
// のみを残した最小構成。u_progress (0..1) で「光の柱が伸びる → フェード」
// のシンプルなストーリーを駆動する。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform float u_progress;  // 0..1: ブート全体の進行度

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

// 光の柱 (god rays): 水面から斜めに差し込む4本の光柱。
// rayReach (0..1) で柱の下降長さを制御し、descend phase で柱が伸びる様を描く。
// 揺れ・時間変動を持たせず、静かに伸びるだけのシンプル演出。
float godRays(vec2 uv, float aspect, float intensity, float rayReach) {
  const int RAY_COUNT = 4;
  float total = 0.0;
  const float RAY_BASE_WIDTH = 0.045;
  const float RAY_TILT = 0.18;
  const float RAY_DECAY = 1.8;

  for (int i = 0; i < RAY_COUNT; i++) {
    float fi = float(i);
    float rayX = (fi + 0.5) / float(RAY_COUNT);
    // 時間揺らぎなし。柱は固定位置から静かに伸びる。
    float axisX = rayX + (1.0 - uv.y) * RAY_TILT * (0.6 + 0.4 * sin(fi * 2.1));
    float dx = (uv.x - axisX) * aspect;
    // 柱ごとに固定の太さ変動 (時間依存なし)。hash21 で決定論的に。
    float width = RAY_BASE_WIDTH * (0.8 + 0.4 * hash21(vec2(fi * 3.1, 0.0)));
    float ray = exp(-(dx * dx) / (2.0 * width * width));
    // 海底への減衰。rayReach が小さい (descend 初期) うち柱は水面近くだけ残り、
    // rayReach → 1 で海底まで届くようになる。
    float decay = pow(uv.y, RAY_DECAY);
    // 柱の到達 y: rayReach に比例して下へ延びる。水面 (uv.y 高) 側は常に見え、
    // rayReach が上がるにつれて下端へ延びる。
    float reachMask = smoothstep(1.0 - rayReach, 1.0, uv.y);
    total += ray * decay * reachMask;
  }
  return total * intensity;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float p = u_progress;

  // シンプル演出: 光の柱が伸びる → フェード。粒子・流れは持たない。
  // rayReach (0..1): 光柱が上端から海底へ向けて伸びる。
  // fadeAlpha (1→0): 伸び切ったら全体をフェードアウトして edit 画面へ。
  float rayReach = smoothstep(0.0, 0.6, p);
  float fadeAlpha = 1.0 - smoothstep(0.6, 1.0, p);

  // 深度グラデ: edit画面 (ShinkaiShaderOverlay) と同一値で配色を合わせる。
  // SHALLOW/DEEP_WATER_COLOR は JS 定数 (シェーダー文字列の外) から補間。
  vec3 shallow = ${SHALLOW_WATER_COLOR};
  vec3 deep = ${DEEP_WATER_COLOR};
  vec3 water = mix(deep, shallow, pow(uv.y, 0.55));

  vec3 col = water;

  // 光の柱 (god rays): 揺れなし。rayReach に従って静かに伸びる。
  float rays = godRays(uv, aspect, u_intensity, rayReach);
  vec3 rayColor = vec3(0.20, 0.42, 0.48);
  col += rayColor * rays * 0.48;

  // 上端のごく薄い水中光の滲み (柱と同じタイミングで満ちる)
  col += vec3(0.06, 0.13, 0.15) * smoothstep(0.82, 1.0, uv.y) * u_intensity * rayReach;

  // ビネット
  float vig = smoothstep(1.25, 0.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.86, 1.0, vig);

  // Reinhard トーンマッピング
  col = col / (col + vec3(1.0));

  // surface phase のフェードアウト
  col *= fadeAlpha;

  fragColor = vec4(col, 1.0);
}
`;

// ShinkaiShaderOverlay の INTENSITY_VALUE と対になるブート演出用の強度。
// subtle を Overlay (0.85) より控えめ (0.7) にしているのは意図: ブートは全面を
// 覆う不透明レイヤで、Overlay のように下地が透けて軽減されることがないため。
// 明るすぎると水面の光柱が刺さるので、一段落としている。normal/dramatic は共通。
// 名称は Overlay に合わせ INTENSITY_VALUE で統一 (値は用途ごとに調整可)。
const INTENSITY_VALUE: Record<AmbientIntensity, number> = {
  off: 0,
  subtle: 0.7,
  normal: 1.2,
  dramatic: 1.6,
};

export function ShinkaiBootSequence({ intensity, trigger }: ShinkaiBootSequenceProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    computeInitialPhase(intensity, trigger),
  );
  // trigger の前回値。初回マウント時は起動状態を保持しないため false 扱いで、
  // trigger === true なら初回でも発火する。
  const prevTriggerRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // intensity は発火時の値を使い、ブート中の intensity 変更で effect を
  // 再実行しないため ref で保持する (ブート途中で中断されるのを防ぐ)。
  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  // 発火時に phase タイマーを立ち上げる。WebGL セットアップとは分離
  // (trigger=false → true の切り替えで canvas がまだ DOM にいないため)。
  useEffect(() => {
    const prev = prevTriggerRef.current;
    prevTriggerRef.current = trigger;

    // false → true の遷移、または初回マウント時に trigger === true なら発火
    const shouldFire = !prev && trigger;
    if (!shouldFire) {
      return;
    }

    const currentIntensity = intensityRef.current;

    if (currentIntensity === "off") {
      setPhase("done");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }

    startTimeRef.current = performance.now();
    setPhase("descend");
    const timers = PHASE_TIMINGS.map(({ phase: p, at }) =>
      window.setTimeout(() => setPhase(p), at),
    );

    return () => {
      for (const t of timers) {
        window.clearTimeout(t);
      }
    };
  }, [trigger]);

  // WebGL セットアップ + 描画ループ。phase が done かどうか (boot 中か) に
  // 依存し、phase の値自体 (descend/awaken/rise/surface) には依存しない。
  // boot 開始 (done → descend) の 1 回だけセットアップし、boot 終了
  // (surface → done) で 1 回だけクリーンアップする。phase の値の変更では
  // 再セットアップ・再クリーンアップしない (コンテキストの再取得は重く、
  // 同一 canvas への再 getContext は null を返すリスクがあるため)。
  const startTimeRef = useRef<number>(0);
  const booting = phase !== "done";
  useEffect(() => {
    if (!booting) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      // WebGL2 が取れない環境 (jsdom 含む) では描画しない。
      // CSS の .shinkai-boot 背景 (深海色ベタ) が fallback として働く。
      return;
    }

    const compileShader = (type: number, source: string) => {
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
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
      return;
    }
    gl.useProgram(program);

    // fullscreen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const u_resolution = gl.getUniformLocation(program, "u_resolution");
    const u_intensity = gl.getUniformLocation(program, "u_intensity");
    const u_progress = gl.getUniformLocation(program, "u_progress");

    const intensityValue = INTENSITY_VALUE[intensityRef.current] ?? 1.2;

    // devicePixelRatio は 2 に cap (Retina 大画面での負荷抑制)
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // 描画ループ (phase 非依存)。ブート開始からの絶対経過時間で u_progress を駆動。
    // startTimeRef は trigger effect で発火時に設定済み。再マウント時は現在時刻。
    const startTime = startTimeRef.current || performance.now();
    let rafId: number | null = null;
    let running = true;
    const render = () => {
      if (!running) {
        return;
      }
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / TOTAL_MS));

      gl.uniform2f(u_resolution, canvas.width, canvas.height);
      gl.uniform1f(u_intensity, intensityValue);
      gl.uniform1f(u_progress, progress);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // progress >= 1 でループ停止。done への遷移は最後の phase タイマーが担当。
      if (progress < 1) {
        rafId = requestAnimationFrame(render);
      } else {
        rafId = null;
      }
    };
    rafId = requestAnimationFrame(render);

    // WebGL コンテキストロスト時は即停止する。lost 後の gl.* は no-op なので
    // エラーにはならないが、2.4 秒の無駄な drawArrays を省いてバッテリ負荷を
    // 抑える。ShinkaiShaderOverlay と同じ running フラグ方式で対称性を保つ。
    const handleContextLoss = () => {
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    canvas.addEventListener("webglcontextlost", handleContextLoss);

    return () => {
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", handleContextLoss);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (positionBuffer) {
        gl.deleteBuffer(positionBuffer);
      }
      // 明示的に loseContext() するのは意図。Boot は 2.4 秒で終わる使い捨て canvas
      // (phase==="done" で DOM から消える) なので、確実に GPU コンテキストを解放
      // してよい。一方 ShinkaiShaderOverlay は常駐 canvas で、WKWebView で loseContext
      // すると再マウント時に描画が止まることがあるため呼ばない (同ファイルの
      // cleanup コメント参照)。短命な Boot と常駐の Overlay で方針を分けている。
      const loseCtx = gl.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
    };
  }, [booting]);

  if (phase === "done") {
    return null;
  }

  return (
    <div className={`shinkai-boot shinkai-boot-${phase}`} aria-hidden="true">
      <canvas ref={canvasRef} className="shinkai-boot-canvas" />
    </div>
  );
}
