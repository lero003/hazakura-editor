import { useEffect, useRef } from "react";
import type { AmbientIntensity } from "../../types";

/**
 * ShinkaiShaderOverlay
 *
 * 深海ジョークテーマのための背景レイヤ。フルスクリーンの `<canvas>` に
 * WebGL2 で「水中に漂うチリと有機的な水流」を描く。`.app-shell` の背景の上、
 * コンテンツの下 (`z-index: var(--z-base)`) に固定される。
 *
 * 演出の骨子 (ノイズ感・デジタル感を排除した有機的な水):
 * - curl noise の流れ場で非圧縮性流体のような有機的な流線を作る
 * - 流れに沿って座標を歪ませ (ラグランジュ的漂流) チリが運ばれる様を描く
 * - 高周波 FBM を柔らかな smoothstep に通して「ざらつき」ではなく「粒」として
 *   チリを表現する
 * - 背景は滑らかな深度グラデのみ (caustics 的な鋭い網目は持たない)
 * - 上 (光が届く側) ほどチリが青白く光り、下 (暗い底) へ静かに消える
 *
 * 安全上の前提 (docs/security-boundary.md):
 * - 外部テクスチャ / shader の fetch はしない。流れ場もチリもプロシージャル。
 * - `blob:` を生成しないので CSP 変更不要。JS はバンドル = `'self'`。
 * - `prefers-reduced-motion: reduce` と `intensity === "off"` では描画しない。
 *
 * パフォーマンス:
 * - rAF ループは shinkai テーマ時のみ稼働。アンマウントで cancel + context loss を処理。
 * - devicePixelRatio は 2 に cap し、Retina 大画面での負荷を抑える。
 * - curl 計算は 3 オクターブ FBM (負荷抑止)。粒密度は 4 オクターブ。層を増やすと GPU 負荷が増す。
 */

type ShinkaiShaderOverlayProps = {
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

// 深海フラグメントシェーダ (水中に漂うチリと有機的な水流)。
// - 流れ場: curl noise (FBM の勾配を90度回転) で非圧縮性流体のような有機的流線
// - チリ: 高周波 FBM を柔らかな smoothstep に通し、「ざらつき」でなく「粒」として描く
// - ストリーク: 流れ方向に座標を引き伸ばし、水に流される細長い粒子を表現
// - 深度グラデ: 上 (光が届く側) は青白く、下 (暗い底) へ静かに暗転
// ノイズ関数は「ざらついた光の雲」ではなく「流れと粒子」のために使う点が旧演出と違う。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform vec2 u_mouse;      // 0..1 正規化マウス座標 (滑らかに補間済み)
uniform vec2 u_mouseVel;   // 0..1 正規化マウス速度 (かき回す擾乱の強さに)

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

// FBM: 複数オクターブの値ノイズを重ねて有機的な模様を作る。
// octaves は呼び出し側で指定 (curl=3 / 粒密度=4) し、GPU 負荷を抑える。
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

// curl noise: FBM の勾配を90度回転したベクトル場。
// 非圧縮性流体のように渦を巻き、発散しない有機的な流れを作る。
// 偏微分は中心差分で近似 (微小区間 eps)。
vec2 curl(vec2 p) {
  float eps = 0.001;
  // df/dx, df/dy を数値微分
  float n_x_p = fbm(p + vec2(eps, 0.0), 3);
  float n_x_m = fbm(p - vec2(eps, 0.0), 3);
  float n_y_p = fbm(p + vec2(0.0, eps), 3);
  float n_y_m = fbm(p - vec2(0.0, eps), 3);
  float dx = (n_x_p - n_x_m) / (2.0 * eps);
  float dy = (n_y_p - n_y_m) / (2.0 * eps);
  // 90度回転: (dy, -dx)。これが発散ゼロの流れ場になる。
  return vec2(dy, -dx);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);

  // 動きの強さ: 明るさ (u_intensity) を normal=1.2 基準で正規化する。
  // これにより「明るさ」と「動きの激しさ」が連動し、
  // subtle はより穏やか、dramatic は流れが立ち上がる。
  // normal は穏やかな深海を基準とし、美しく静かな背景の動きを目指す。
  float motion = u_intensity / 1.2;

  // ベースの流れ場: curl noise の渦。空間スケールを上げて複数の渦が見えるように。
  // 時間で流れ場自体がゆっくり変化し、有機な水を表現する。
  // motion で全体の流れの強さを変える。normal は静か、dramatic で流れが立つ。
  // 基底係数を抑え、normal では穏やか、dramatic (motion≈1.33) で今の normal 程度に。
  vec2 flowPos = uv * vec2(aspect, 1.0) * 2.6 + vec2(u_time * 0.05, u_time * 0.03);
  vec2 baseFlow = curl(flowPos);
  baseFlow *= 0.58 * motion;

  // 浮上バイアス: 定数ではなく低周波ノイズで場所ごとに揺らぐ上向き成分。
  // 一様スクロール (形を保ったまま動く) を避け、領域によって昇り方が変わるように。
  // 上向き (浮力) だが、場所によって強さが変わり形を崩す。
  float riseField = valueNoise(uv * vec2(aspect, 1.0) * 1.5 + u_time * 0.04);
  baseFlow.y += (riseField - 0.3) * 0.27 * motion;

  // === 層ごとの depth 分離 ===
  // 手前 (near) ほど流れの影響を大きく取り、形の崩れを大きくする。
  // 奥 (far) ほど流れを穏やかにし、遠くのチリは静かに漂う。

  // --- 手前層 (near): 崩れ大 ---
  // flow を強く受け、高周波歪みを追加して形がよく崩れる。
  // motion で崩れの度合いも変化 (dramatic では手前がより激しく崩れる)。
  vec2 nearFlow = baseFlow * 1.3;
  // マウス擾乱 (かき回し) は手前ほど強く受けやすい (水面に近い = 手でかき易い)。
  // 掻き回す強さは motion ではなく固定の目立ち具合で維持し、
  // normal でも操作がしっかり響くようにする (演出を楽しむ前提)。
  float mouseDist = length((uv - u_mouse) * vec2(aspect, 1.0));
  float mouseWake = smoothstep(0.32, 0.0, mouseDist);
  // マウスの進行方向へ周囲の水を押し出す (かき回す)。
  nearFlow += u_mouseVel * mouseWake * 2.5;
  vec2 driftedNear = uv + nearFlow * 0.075;
  // 高周波歪みでテクスチャを細かく崩す (手前の粒の輪郭が流される)
  driftedNear += vec2(
    fbm(driftedNear * vec2(aspect, 1.0) * 8.0 + u_time * 0.10, 3),
    fbm(driftedNear * vec2(aspect, 1.0) * 8.0 + 5.0 - u_time * 0.08, 3)
  ) * 0.0095 * motion - 0.0048 * motion;
  float dustNear = fbm(driftedNear * vec2(aspect, 1.0) * 3.5 + u_time * 0.045, 4);
  float particleNear = smoothstep(0.38, 0.62, dustNear);

  // --- 奥層 (far): 穏やか ---
  // flow を弱く受け、高周波歪みなし。遠くのチリは静かで形が保たれやすい。
  vec2 farFlow = baseFlow * 0.55;
  // マウス擾乱は奥へ届きにくい (水中の減衰)。掻き回しは手前同様 fixed で維持。
  farFlow += u_mouseVel * mouseWake * 0.6;
  vec2 driftedFar = uv + farFlow * 0.035;
  float dustFar = fbm(driftedFar * vec2(aspect, 1.0) * 6.0 - u_time * 0.025, 3);
  float particleFar = smoothstep(0.40, 0.60, dustFar);

  // 深度グラデ: 上 (水面側) は青白い水中色、下 (暗い底) へ静かに暗転。
  // 滑らかな pow で、境界を作らない。
  vec3 shallow = vec3(0.09, 0.32, 0.40);
  vec3 deep = vec3(0.015, 0.09, 0.16);
  vec3 water = mix(deep, shallow, pow(uv.y, 0.55));

  // 光の届きやすさ: 上ほど強く、下へ減衰するが、底でも最低限の輝きを残す。
  // (画面下半分のエディタ領域でもチリが見えるように)
  float lightReach = mix(0.55, 1.25, pow(uv.y, 0.9));

  // チリの色: 手前は青白く明るく、奥は沈んだ青緑 (depth による色分離)。
  // これで前後関係が更に分かりやすくなる。
  vec3 dustNearColor = vec3(0.62, 0.90, 0.94);
  vec3 dustFarColor = vec3(0.42, 0.70, 0.78);
  // depth で色味を滑らかに混ぜる
  vec3 dustColorNear = mix(dustFarColor, dustNearColor, smoothstep(0.55, 1.0, uv.y));
  vec3 dustColorFar = dustFarColor;

  vec3 col = water;
  // 手前のチリ: 明るく、動きが激しい分はっきり見える
  col += dustColorNear * particleNear * lightReach * 0.60 * u_intensity;
  // 奥のチリ: 控えめで沈んだ色
  col += dustColorFar * particleFar * lightReach * 0.22 * u_intensity;

  // カーソル周辺に柔らかな光の滲み (水中で手をかざしたような明るさ)。
  // かき回した場所がわずかに明るくなる。
  col += vec3(0.35, 0.60, 0.66) * mouseWake * u_intensity * 1.8;

  // 上端のごく薄い水中光の滲み (水面近くで明るくなる自然な減衰)
  col += vec3(0.06, 0.13, 0.15) * smoothstep(0.82, 1.0, uv.y) * u_intensity;

  // ビネット: 端をわずかに暗くし、視線を中央へ。閉塞感ではなく自然な滲み。
  float vig = smoothstep(1.25, 0.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.86, 1.0, vig);

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
  // 爽やかさを優先し、CRT よりやや高めに。
  subtle: 0.85,
  normal: 1.2,
  dramatic: 1.6,
};

export function ShinkaiShaderOverlay({ intensity }: ShinkaiShaderOverlayProps) {
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
      // CSS の前景層 (.shinkai-overlay) のみで水中感を演出する。
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

    // マウス位置 (0..1 正規化) を ref で保持し、rAF ループ内で線形補間しながら
    // uniform に渡す。DOM 書き込みなし・シェーダー側で滑らかに追従させる。
    // 補間しないと mousemove の離散値でチリがカクカクするため。
    const mouseTargetRef = { x: 0.5, y: 0.5 };
    const mouseSmoothRef = { x: 0.5, y: 0.5 };
    // マウス速度 (前フレームとの差分)。かき回す擾乱の強さに使う。
    // 位置補間との差を取ることで「動かしている瞬間」だけ擾乱が立つ。
    // 直前の生の (補間前) 位置を保持して差分を計算する。
    const mousePrevRawRef = { x: 0.5, y: 0.5 };
    const mouseVelSmoothRef = { x: 0, y: 0 };
    // 初回 mousemove まで true。初回は前回位置からの飛びを擾乱に入れないため、
    // 速度を 0 扱いして位置だけ更新する。
    let mouseInitialized = false;
    const onMouseMove = (event: MouseEvent) => {
      const nx = event.clientX / Math.max(window.innerWidth, 1);
      const ny = event.clientY / Math.max(window.innerHeight, 1);
      // 初回は前回位置を現在位置に揃え、巨大な初動速度が擾乱に入らないようにする
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
      // マウス速度: 直前の生の位置との差分。動かしている瞬間だけ非ゼロになり、
      // 止めると 0 へ戻る。mouseSmoothRef (補間後位置) で割って滑らかにする。
      // 意図: マウスが「水をかき回す」。動かすと擾乱、止めると静穏。
      const velX = mouseTargetRef.x - mousePrevRawRef.x;
      const velY = mouseTargetRef.y - mousePrevRawRef.y;
      mousePrevRawRef.x = mouseTargetRef.x;
      mousePrevRawRef.y = mouseTargetRef.y;
      // 速度も緩やかに減衰させ、マウスを止めた後に擾乱がゆっくり消えるように。
      // (通過した渦が水面に残るような余韻)
      mouseVelSmoothRef.x += (velX - mouseVelSmoothRef.x) * 0.12;
      mouseVelSmoothRef.y += (velY - mouseVelSmoothRef.y) * 0.12;
      // マウス位置を滑らかに補間 (lerp)。追従の遅さで水中の粘性感を出す。
      mouseSmoothRef.x += (mouseTargetRef.x - mouseSmoothRef.x) * 0.06;
      mouseSmoothRef.y += (mouseTargetRef.y - mouseSmoothRef.y) * 0.06;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      // 描画ごとに最新の intensity を ref から読む
      gl.uniform1f(intensityLocation, INTENSITY_VALUE[intensityRef.current]);
      gl.uniform2f(mouseLocation, mouseSmoothRef.x, 1.0 - mouseSmoothRef.y);
      gl.uniform2f(mouseVelLocation, mouseVelSmoothRef.x, mouseVelSmoothRef.y);
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
      window.removeEventListener("mousemove", onMouseMove);
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

  return <canvas className="shinkai-canvas" ref={canvasRef} aria-hidden="true" />;
}
