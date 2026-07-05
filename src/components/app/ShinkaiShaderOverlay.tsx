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
 * v1.5 で深海を「もう一段」進化 (設計思想: 静寂・光の満ち・有機的な水):
 * - 光の柱 (god rays): 水面から斜めに差し込む光柱が curl 流れ場に沿って湾曲し、
 *   海底へ向けて静かに減衰する。深度グラデの上に加算合成で奥行きを強調。
 * - 速度場 (flow field): JS 側で低解像度の速度場を状態として持ち、mousemove で
 *   カーソル周辺に力を加える。毎フレーム減衰 + 隣接拡散し、テクスチャとして
 *   シェーダーへ渡す。これを curl flow に加算するため、チリ・光柱・深度など
 *   「表層全体」が手で払った方向へ流れ、ゆっくり戻る (現実の水中の体感)。
 *   テクスチャは JS 配列から生成 (外部 fetch なし、blob: なし、CSP 変更なし)。
 * - カーソル周辺の柔らかな明るみ: ライトを当てているような水中光。速度場の
 *   強さで輝度が変わる (動かしている時は明るく、止まると収束して消える)。
 * - 3層の depth 分離: 奥 (穏やか)・中景 (現状)・前景 (大きく流れる粒) で、
 *   手前ほど流れと視差を強く受け、漂う泡/プランクトンのような生態感を出す。
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

// === 深度グラデ配色 (ShinkaiBootSequence と共有) ===
// shallow/deep を両シェーダーで同一に保ち、ブート終了時に edit 画面へ
// 連続的に繋がるようにする。変更時は ShinkaiBootSequence.tsx 側も更新すること。
// FRAGMENT_SHADER より前に定義 (シェーダー文字列から補間参照するため)。
const SHALLOW_WATER_COLOR = "vec3(0.12, 0.38, 0.46)";
const DEEP_WATER_COLOR = "vec3(0.015, 0.09, 0.16)";

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// 深海フラグメントシェーダ (水中に漂うチリと有機的な水流 + 光の柱・速度場)。
// - 流れ場: curl noise (FBM の勾配を90度回転) で非圧縮性流体のような有機的流線
// - チリ: 高周波 FBM を柔らかな smoothstep に通し、「ざらつき」でなく「粒」として描く
// - ストリーク: 流れ方向に座標を引き伸ばし、水に流される細長い粒子を表現
// - 深度グラデ: 上 (光が届く側) は青白く、下 (暗い底) へ静かに暗転
// - 光の柱: 水面から斜めに差し込む光柱が curl 流れ場に沿って湾曲し、海底へ減衰
// - 速度場: JS 側で保持した低解像度 velocity field テクスチャを baseFlow に加算。
//   mousemove で力が加わり減衰+拡散で戻るため、表層が「払われた方向へ流れて戻る」
// ノイズ関数は「ざらついた光の雲」ではなく「流れと粒子」のために使う点が旧演出と違う。
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;
uniform vec2 u_mouse;       // 0..1 正規化マウス座標 (滑らかに補間済み)
uniform vec2 u_mouseVel;    // 0..1 正規化マウス速度 (かき回す擾乱の強さに)
uniform sampler2D u_flowField; // 低解像度速度場 (RG: 0..1 → -1..1)。mousemove で蓄積。

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

// === 光の柱 (god rays) ===
// 水面 (上端) から斜めに差し込む光柱を描く。各柱は:
//   - 水面の水平位置 (rayX) から、傾き (rayTilt) を持って下降する軸を持つ
//   - 軸に沿って左右に広がるガウス状の幅 (rayWidth)
//   - curl 流れ場で湾曲し、時間で位相がずれてゆっくり揺れる
//   - 海底 (uv.y → 0) へ向けて指数的に減衰する
// 複数本をループで足し合わせ、奥行きと光の満ちを表現する。
// 計算を軽くするため各柱のノイズは 1 オクターブ (valueNoise) で済ませる。
float godRays(vec2 uv, float aspect, float time, float intensity) {
  // 本数。多すぎると GPU 負荷が上がるので 4 本に抑える。
  const int RAY_COUNT = 4;
  float total = 0.0;
  // ループ内で使う定数群 (magic number を名前付き化してチューニング容易化)
  // rayBaseWidth: 柱の基本の太さ (uv 空間での標準偏差相当)
  const float RAY_BASE_WIDTH = 0.045;
  // rayTilt: 柱が垂直からどれだけ傾くか (0=真っ直ぐ, 正=右へ傾く)
  const float RAY_TILT = 0.18;
  // raySwing: 時間による水平方向の揺れ幅
  const float RAY_SWING = 0.06;
  // raySpeed: 揺れの周期 (小さいほど速い)
  const float RAY_SPEED = 0.12;
  // rayDecay: 海底への減衰の強さ (大きいほど早く暗くなる)
  const float RAY_DECAY = 1.8;

  for (int i = 0; i < RAY_COUNT; i++) {
    float fi = float(i);
    // 各柱の水面での水平位置 (0..1)。等間隔 + わずかなオフセットで自然に。
    float rayX = (fi + 0.5) / float(RAY_COUNT);
    // 位相をずらして揺らす (柱ごとに違うタイミングで動く)
    float swing = valueNoise(vec2(fi * 7.3, time * RAY_SPEED)) - 0.5;
    float tiltedX = rayX + swing * RAY_SWING;
    // 柱の軸: 水面 (uv.y=1) から下へ、傾きを持って下降する位置
    // uv.y が高い (水面寄り) ほど tiltedX に近く、下へ行くほど tilt で流れる
    float axisX = tiltedX + (1.0 - uv.y) * RAY_TILT * (0.6 + 0.4 * sin(fi * 2.1));
    // 水平距離 → ガウス幅。aspect 補正で歪ませる。
    float dx = (uv.x - axisX) * aspect;
    float width = RAY_BASE_WIDTH * (0.8 + 0.4 * valueNoise(vec2(fi * 3.1, time * 0.08)));
    float ray = exp(-(dx * dx) / (2.0 * width * width));
    // 海底への減衰: 上 (uv.y 高い) ほど強く、下へ指数的に消える
    float decay = pow(uv.y, RAY_DECAY);
    total += ray * decay;
  }
  return total * intensity;
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
  // 時間係数を速くし、渦の変化とチリの流れを活発にした。
  vec2 flowPos = uv * vec2(aspect, 1.0) * 2.6 + vec2(u_time * 0.08, u_time * 0.05);
  vec2 baseFlow = curl(flowPos);
  baseFlow *= 0.58 * motion;

  // 浮上バイアス: 定数ではなく低周波ノイズで場所ごとに揺らぐ上向き成分。
  // 一様スクロール (形を保ったまま動く) を避け、領域によって昇り方が変わるように。
  // 上向き (浮力) だが、場所によって強さが変わり形を崩す。
  float riseField = valueNoise(uv * vec2(aspect, 1.0) * 1.5 + u_time * 0.07);
  baseFlow.y += (riseField - 0.3) * 0.27 * motion;

  // === 速度場 (user flow field) ===
  // JS 側で保持した低解像度 velocity field を baseFlow に加算する。
  // mousemove でカーソル周辺に力が加わり、減衰+拡散でゆっくり戻る。
  // これによりチリ・光柱・深度など「表層全体」が手で払った方向へ流れ、
  // 戻るのも速度場の収束に同期して自然になる (現実の水中の体感)。
  // テクスチャは 0..1 にエンコード (負値を表すため中心 0.5)。
  vec2 userFlow = texture(u_flowField, uv).rg * 2.0 - 1.0;
  // 速度場の効き具合。JS 側で力を控えめに加算するので、ここで持ち上げる。
  // dramatic (motion 大) の方が速度場の影響も強く出る。
  baseFlow += userFlow * (0.9 + 0.4 * motion);

  // === 層ごとの depth 分離 (3層) ===
  // 手前 (foreground) ほど流れと視差を強く受け、漂う泡/プランクトン感を出す。
  // 奥 (far) ほど流れを穏やかにし、遠くのチリは静かに漂う。
  // 全層が baseFlow (curl + 速度場) の上に乗るため、手で払った方向へ
  // 表層ごと流れ、速度場の減衰でゆっくり戻る。

  // マウス位置と距離 (全層共通)
  float mouseDist = length((uv - u_mouse) * vec2(aspect, 1.0));
  // mouseWake: カーソル周辺の影響圏。ライトの照らす範囲としてやや広く (0.32→0.42)。
  // 手前ほど強く、奥ほど弱い (後で層ごとに掛ける)。
  float mouseWake = smoothstep(0.42, 0.0, mouseDist);

  // --- 前景層 (foreground): 大きく流れる粒 ---
  // 流れを最も強く受け (1.7倍)、高周波歪みで形を崩す。粒は大きく少数。
  // 時間スケールを速く (×2.2) し、手前ほど速く変化して立体感を出す。
  float tFg = u_time * 2.2;
  vec2 fgFlow = baseFlow * 1.7;
  // かき回しは手前が一番受けやすい (水面に一番近い = 一番掻きやすい)。
  fgFlow += u_mouseVel * mouseWake * 3.2;
  vec2 driftedFg = uv + fgFlow * 0.085;
  // 高周波歪みで輪郭を崩す (手前の粒が水流に流される)
  driftedFg += vec2(
    fbm(driftedFg * vec2(aspect, 1.0) * 7.0 + tFg * 0.11, 3),
    fbm(driftedFg * vec2(aspect, 1.0) * 7.0 + 5.0 - tFg * 0.09, 3)
  ) * 0.011 * motion - 0.0055 * motion;
  // 粒は大きく (低周波)・少数 (高い閾値) で「泡」感を出す
  float dustFg = fbm(driftedFg * vec2(aspect, 1.0) * 2.4 + tFg * 0.05, 3);
  float particleFg = smoothstep(0.58, 0.78, dustFg);

  // --- 中景層 (near): 崩れ中 ---
  // 従来の手前層。flow を強く受け、高周波歪みを追加して形がよく崩れる。
  // 時間スケールは基準よりやや速く (×1.4)。
  float tNear = u_time * 1.4;
  vec2 nearFlow = baseFlow * 1.3;
  nearFlow += u_mouseVel * mouseWake * 2.5;
  vec2 driftedNear = uv + nearFlow * 0.075;
  driftedNear += vec2(
    fbm(driftedNear * vec2(aspect, 1.0) * 8.0 + tNear * 0.10, 3),
    fbm(driftedNear * vec2(aspect, 1.0) * 8.0 + 5.0 - tNear * 0.08, 3)
  ) * 0.0095 * motion - 0.0048 * motion;
  float dustNear = fbm(driftedNear * vec2(aspect, 1.0) * 3.5 + tNear * 0.045, 4);
  float particleNear = smoothstep(0.38, 0.62, dustNear);

  // --- 奥層 (far): 穏やか ---
  // flow を弱く受け、高周波歪みなし。遠くのチリは静かで形が保たれやすい。
  // 時間スケールは遅め (×0.85) で前後の差をつけるが、全体に速めた分これも速い。
  float tFar = u_time * 0.85;
  vec2 farFlow = baseFlow * 0.55;
  farFlow += u_mouseVel * mouseWake * 0.6;
  vec2 driftedFar = uv + farFlow * 0.035;
  float dustFar = fbm(driftedFar * vec2(aspect, 1.0) * 6.0 - tFar * 0.025, 3);
  float particleFar = smoothstep(0.40, 0.60, dustFar);

  // 深度グラデ: 上 (水面側) は青白い水中色、下 (暗い底) へ静かに暗転。
  // 滑らかな pow で、境界を作らない。
  // shallow を上げて水面付近により明るい場所を持たせる。
  // SHALLOW/DEEP_WATER_COLOR は JS 定数 (シェーダー文字列の外) から補間。
  vec3 shallow = ${SHALLOW_WATER_COLOR};
  vec3 deep = ${DEEP_WATER_COLOR};
  vec3 water = mix(deep, shallow, pow(uv.y, 0.55));

  // 光の届きやすさ: 上ほど強く、下へ減衰するが、底でも最低限の輝きを残す。
  // (画面下半分のエディタ領域でもチリが見えるように)
  // 底値を上げて全体の明るさを底上げ。
  float lightReach = mix(0.7, 1.35, pow(uv.y, 0.9));

  // チリの色: 手前は青白く明るく、奥は沈んだ青緑 (depth による色分離)。
  // これで前後関係が更に分かりやすくなる。
  vec3 dustFgColor = vec3(0.72, 0.95, 0.98);   // 前景: 一番明るい青白
  vec3 dustNearColor = vec3(0.62, 0.90, 0.94);
  vec3 dustFarColor = vec3(0.42, 0.70, 0.78);
  // depth で色味を滑らかに混ぜる
  vec3 dustColorFg = mix(dustNearColor, dustFgColor, smoothstep(0.6, 1.0, uv.y));
  vec3 dustColorNear = mix(dustFarColor, dustNearColor, smoothstep(0.55, 1.0, uv.y));
  vec3 dustColorFar = dustFarColor;

  vec3 col = water;
  // 前景の粒: 一番手前にいる存在感。加算量は白飛び防止のための下げ過ぎを
  // 修正し、鮮やかすぎず穏やかな程度まで戻した (0.55 → 0.78)。
  // 最終的な Reinhard トーンマッピングが中間調も圧縮するため、入力はやや強め。
  col += dustColorFg * particleFg * lightReach * 0.78 * u_intensity;
  // 中景のチリ: 中程度の明るさ
  col += dustColorNear * particleNear * lightReach * 0.55 * u_intensity;
  // 奥のチリ: 控えめで沈んだ色
  col += dustColorFar * particleFar * lightReach * 0.24 * u_intensity;

  // === 光の柱 (god rays) ===
  // 水面から差し込む光柱。深海の設計思想「光の満ち」を強調し、奥行きを与える。
  // 柱の色は水面の青白い光。normal で穏やかに、dramatic で太くはっきる。
  // 加算量は控えめにし、チリとの重なりで白飛びしないよう抑えた (安全網あり)。
  float rays = godRays(uv, aspect, u_time, u_intensity);
  // 柱の色: 水面の光らしい青白 (微かに緑がかった水中光)
  vec3 rayColor = vec3(0.20, 0.42, 0.48);
  col += rayColor * rays * 0.48;

  // === カーソル周辺の柔らかな明るみ (水中光ライト) ===
  // 深海で軽いライトを照らしている程度の存在感。u_mouseStill による明滅は
  // 持たず、速度場の強さ (userFlow) で輝度を変える。動かしている時は明るく、
  // 止まっても速度場が残る間は穏やかに灯り、収束すると自然に消える。
  // mouseWake (近接度) でカーソル位置に限定し、広範囲に滲まない。
  // ベース輝度を上げて「常時ライト」感を出し、flowEnergy で動かした時に強める。
  // Reinhard トーンマッピングで白飛びは防がれるため、入力は強めにしてよい。
  float flowEnergy = length(userFlow);
  float lightBrightness = 0.7 + flowEnergy * 1.3;
  col += vec3(0.38, 0.62, 0.68) * mouseWake * lightBrightness * u_intensity;

  // === 速度場エネルギー微発光 ===
  // 速度場が強い (動かした直後) 場所に青白い微発光を加える。
  // 払った軌跡が薄く光り、速度場の減衰とともにゆっくり消える。
  // カーソル位置限定ではなく、速度場全体を見る (運ばれた渦も光る)。
  // smoothstep で閾値を設け、弱い動きでは光らない (雷雲感を避ける)。
  // flowEnergy は 0..約1.5 程度。0.15 以上で発光開始。
  // 加算量を控えめ (0.35 → 0.22) にし、カーソル明るみとの重複を抑えた。
  float flowGlow = smoothstep(0.15, 0.9, flowEnergy);
  col += vec3(0.16, 0.38, 0.44) * flowGlow * 0.22 * u_intensity;

  // 上端のごく薄い水中光の滲み (水面近くで明るくなる自然な減衰)
  col += vec3(0.06, 0.13, 0.15) * smoothstep(0.82, 1.0, uv.y) * u_intensity;

  // ビネット: 端をわずかに暗くし、視線を中央へ。閉塞感ではなく自然な滲み。
  float vig = smoothstep(1.25, 0.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= mix(0.86, 1.0, vig);

  // === トーンマッピング (Reinhard) ===
  // レイヤー増に伴い加算が累積し、col が 1.0 を超えると白飛びする。
  // Reinhard (col / (col + vec3(1.0))) で HDR 的に圧縮し、明るい部分は
  // 白く飛ばずに滑らかに飽和する。暗部はほぼそのまま (深海の暗さを保つ)。
  // 安全網: 各レイヤーの加算量を抑えても、重なった場面での白飛びを防ぐ。
  col = col / (col + vec3(1.0));

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
  // NOTE: ブート演出 (ShinkaiBootSequence) 側は全面覆いレイヤのため、
  // subtle を 0.7 に控えている。normal/dramatic は共通。
  subtle: 0.85,
  normal: 1.2,
  dramatic: 1.6,
};

// === 速度場 (user flow field) グリッド ===
// 低解像度の velocity field を JS 側で状態として持つ。
// mousemove でカーソル周辺セルに力を加え、毎フレーム減衰 + 隣接拡散する。
// これをテクスチャ化してシェーダーの baseFlow に加算することで、
// チリ・光柱・深度など「表層全体」が手で払った方向へ流れ、ゆっくり戻る。
//
// グリッドサイズは 16:9 を想定。大きすぎると CPU 負荷とテクスチャ更新費用が増す。
const FLOW_GRID_W = 48;
const FLOW_GRID_H = 27;
const FLOW_CELLS = FLOW_GRID_W * FLOW_GRID_H;
// 1セル vec2 (vx, vy)。2バッファで ping-pong (読み→書き)。
// 速度は [-1,1] に収まる想定だが、エンコードは init 時のみなので配列は素の実数。
function createFlowField(): Float32Array {
  // RG8 テクスチャへ渡すため 0..1 にエンコード (中心 0.5 = ゼロ)。
  // 初期状態は静止 (0.5, 0.5)。
  const arr = new Float32Array(FLOW_CELLS * 2);
  arr.fill(0.5);
  return arr;
}

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
    const flowFieldLocation = gl.getUniformLocation(program, "u_flowField");

    // === 速度場テクスチャ初期化 ===
    // RG8 (2チャンネル unsigned byte) の低解像度テクスチャ。毎フレーム更新する。
    // JS 配列から生成 (外部 fetch なし、blob: URL なし → CSP 変更不要)。
    const flowTex = gl.createTexture();
    // 速度場バッファ (ping-pong)。現在状態と、減衰+拡散を書き込む次状態。
    const flowA = createFlowField();
    const flowB = createFlowField();
    let flowRead = flowA;
    let flowWrite = flowB;
    // テクスチャへアップロードするための byte バッファ (RG8 用)。
    // 毎フレーム再利用して GC 抑制。初期は静止 (128 = 0.5) で埋める。
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
    // 速度場へ加える力のスケール。
    // u_mouseVel は微小 (0..1 正規化空間でのフレーム差) なので、
    // グリッドセルへ足すときは boost する。
    const FLOW_FORCE_BOOST = 8.0;
    // カーソル周辺の力の影響半径 (セル単位)。大きいほど滑らかに広がる。
    const FLOW_RADIUS = 3;
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
      // マウス速度 (前回生位置との差分)。render 側でも u_mouseVel 計算に使うため、
      // ここでは mousePrevRawRef を更新せず、render ループで一元して更新する。
      const vx = nx - mousePrevRawRef.x;
      const vy = ny - mousePrevRawRef.y;
      // 速度場へ力を加算: カーソルのグリッド座標周辺 (半径 FLOW_RADIUS) のセルに、
      // ガウス減衰でマウス速度ベクトルを足す。これが「手で水を払った」痕になる。
      const gx = nx * FLOW_GRID_W;
      const gy = (1.0 - ny) * FLOW_GRID_H; // UV の Y と同じ向き (下が 0)
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
          // ガウス減衰 (中心ほど強く)
          const fall = Math.exp(-dist2 / (2.0 * (FLOW_RADIUS * 0.5) ** 2));
          const idx = (yy * FLOW_GRID_W + xx) * 2;
          // 0..1 エンコード空間で加算 (0.5 が静止)
          flowRead[idx] = Math.max(0, Math.min(1, flowRead[idx] + vx * FLOW_FORCE_BOOST * fall));
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

    // 速度場の更新 (アドベクション + 減衰 + 隣接拡散)。
    // flowRead → flowWrite へ書き込み、ping-pong で入れ替える。
    //   - アドベクション: 各セルが自身の速度で「流される」。バックトレース
    //     (半分前の位置からサンプリング) で渦が運ばれ、より流体らしくなる。
    //   - 減衰: 各セルを静止点 (0.5) へ近づける。DAMPING で戻り速さを調整。
    //   - 拡散: 4隣接セルとの平均 (簡易ラプラシアン) で滑らかに広がる。
    // これで「手で払った痕が流れながら残り、ゆっくり (約倍の時間) 戻る」。
    const FLOW_DAMPING = 0.0065; // 1フレームあたり静止点へ近づく割合 (小さいほど痕が長残)
    const FLOW_DIFFUSE = 0.12; // 隣接セルからの拡散の強さ
    const FLOW_ADVECT = 0.5; // アドベクションの強さ (セルの速度で運ぶ距離)
    const stepFlowField = () => {
      for (let yy = 0; yy < FLOW_GRID_H; yy++) {
        for (let xx = 0; xx < FLOW_GRID_W; xx++) {
          const idx = (yy * FLOW_GRID_W + xx) * 2;
          // 現在セルの速度 (0..1 → -1..1)
          const curVx = flowRead[idx] * 2 - 1;
          const curVy = flowRead[idx + 1] * 2 - 1;
          // === アドベクション (自己輸送) ===
          // セルが自身の速度で「流される」。バックトレース: 現在位置から
          // 半ステップ前 (速度の逆方向) の位置をサンプリングし、そこから
          // 流れてきた速度を受け継ぐ。これで渦が運ばれ、より流体らしくなる。
          // UV 空間と速度場は同じ向き (下が y=0) なのでそのまま使う。
          const srcX = xx - curVx * FLOW_ADVECT;
          const srcY = yy - curVy * FLOW_ADVECT;
          // bilinear サンプリング (境界外は clamp)
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
          // 双線形補間
          const topX = v00x + (v10x - v00x) * fx;
          const topY = v00y + (v10y - v00y) * fx;
          const botX = v01x + (v11x - v01x) * fx;
          const botY = v01y + (v11y - v01y) * fx;
          let vx = topX + (botX - topX) * fy;
          let vy = topY + (botY - topY) * fy;
          // 減衰: ゼロへ引く (速度場が徐々に収束して戻る)
          vx *= 1 - FLOW_DAMPING;
          vy *= 1 - FLOW_DAMPING;
          // 拡散: 4隣接セルの速度との平均を混ぜる (簡易ラプラシアン)
          // 境界外は同じセルの値で clamp 扱い (反射しない)。
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
            const avgX = sumX / count;
            const avgY = sumY / count;
            vx += (avgX - vx) * FLOW_DIFFUSE;
            vy += (avgY - vy) * FLOW_DIFFUSE;
          }
          // -1..1 → 0..1 へエンコードして書き込み
          flowWrite[idx] = vx * 0.5 + 0.5;
          flowWrite[idx + 1] = vy * 0.5 + 0.5;
        }
      }
      // ping-pong 入れ替え
      const tmp = flowRead;
      flowRead = flowWrite;
      flowWrite = tmp;
    };

    const render = () => {
      if (!running) {
        return;
      }
      const time = (performance.now() - startTime) / 1000;
      // 速度場を1ステップ更新 (減衰 + 拡散)。痕が残りつつ戻る。
      stepFlowField();
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
      // 速度場テクスチャを更新 (flowRead → GPU)。
      // RG8 (UNSIGNED_BYTE) へ 0..1 を 0..255 でエンコード。
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
      // 描画ごとに最新の intensity を ref から読む
      gl.uniform1f(intensityLocation, INTENSITY_VALUE[intensityRef.current]);
      gl.uniform2f(mouseLocation, mouseSmoothRef.x, 1.0 - mouseSmoothRef.y);
      gl.uniform2f(mouseVelLocation, mouseVelSmoothRef.x, mouseVelSmoothRef.y);
      // 速度場テクスチャを TEXTURE0 にバインドし、sampler2D に渡す。
      // null ガード: uniform が最適化で消えた場合でも安全にスキップ。
      if (flowFieldLocation) {
        gl.uniform1i(flowFieldLocation, 0);
      }
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
      gl.deleteTexture(flowTex);
    };
  }, [isActive]);

  // intensity === "off" のときは canvas を描かない (CSS も非表示になる)
  if (!isActive) {
    return null;
  }

  return <canvas className="shinkai-canvas" ref={canvasRef} aria-hidden="true" />;
}
