# テーマ演出ブラッシュアップ計画（光・素材・運動・光学）

Status: Implemented（S0〜S8。隔離WKWebView検証済み、署名候補GUIは未確認）
Scope: v3.4.0のテーマ刷新。`src/styles/*`（テーマ・紙面・chrome）と `src/components/app/` の ambient / overlay / boot、`src/features/theme/*`、`src/hooks/app/*`
Authority: Design + implementation plan。実装済みの主張は検証節のコマンド結果と証跡でのみ更新する
Last reviewed: 2026-10-19

v3.3は審査提出済みとのオーナー報告（2026-10-19）を受け、本計画のS0〜S8と不具合調整は
v3.4.0の範囲とする。[候補と受け入れの記録](releases/3.4.0-theme-atmosphere.md)を参照する。

## 目的

7テーマ（light / dark / yakou / shokou / edohigan / shinkai / crt）の「色」はすでに揃っている。
足りないのは**物理の一貫性と素材の作り込み**で、演出の量ではない。次の5原則で置換・統合・削除を行う。

1. **1つの光** — 各テーマが光の向きと色温度を持ち、影・反射・粒子の明るさがそこから導出される
2. **1つの流体** — 粒子は共通の風／流速場の受動体。固有の周期ループを持たない
3. **1つの時計** — `dt` 積算で物理を回し、フレームレート・タブ復帰・強度で挙動が変わらない
4. **素材の語彙** — 紙 / ガラス / 水 / 蛍光体をレシピとして各テーマが選ぶ（テーマ＝色ではなく素材の組）
5. **出来事に紐づける** — 新しい演出は「保存」「反映」など既存イベントの言い換えとしてのみ足す

作業量の目安は **置換6 : 削除3 : 新規1**。削除・統合を成果として扱う。

## 非目標（境界）

- テーマの追加、設定項目の追加、依存の追加
- 外部テクスチャ / フォント / shader の fetch、`blob:` の生成（CSP・バンドル境界は現状維持）
- Markdown / テキスト source・保存形式・書き出し結果・PDF/EPUB の内容への介入。L Mode・読書面の見た目は紙面/組版CSSの対象
- タイピング経路でのDOM書き込み。ambient は常に単一rAF内
- `filter` の常時ループ（Q-THM-1の方針を維持）
- light / dark への演出追加（静けさは製品価値）

## 現状診断（コード根拠）

行番号は着手前（2026-10-19 時点）のもの。実装後の行は動いている。

| 面 | いま起きていること | 根拠 |
|---|---|---|
| 江戸彼岸の花弁 | 落下が直線1本、回転は別系統の13sループ。深度・遮蔽・接地影なし | `src/styles/edohigan-theme.css:179`, `:185` |
| 夜光/曙光の粒子 | 46〜52個の`span`を`will-change`付きで個別アニメーション、2点間`ease-in-out`の無限ループ、明滅・深度なし | `src/styles/animations.css:18`, `src/styles/app-shell.css:116` |
| 深海の流れ場 | `FLOW_DAMPING`等がフレーム毎定数（30fpsと60fpsで粘性が変わる）。`u_intensity`が明るさと速さを同時に駆動 | `src/components/app/ShinkaiShaderOverlay.tsx:623` |
| 深海の時間 | `visibilitychange`で`startTime`をリセットし、復帰時に水が別時刻へ飛ぶ | 同 `:560` 付近 |
| 深海の粒 | FBMのしきい値カットで粒が繋がった塊になる。粒ごとの奥行き・大きさなし | 同 FRAGMENT_SHADER |
| 深海の光柱 | 4本が平行。実際の光芒は1点から放射する | 同 `godRays` |
| CRTの走査線 | canvasはUV本数`SCAN_LINES=520`、CSS前景は4px周期。2系統がビートを打つ | `CrtShaderOverlay.tsx:70`, `crt-theme.css:139` |
| CRTの管 | 曲率・色収差は背景canvasのみ。本文は平坦なまま | 同上 |
| CRTの明滅 | `.cm-content`全体の`opacity`を0.70まで落とす。大面積再描画と実効コントラスト変動 | `crt-theme.css:374` |
| 全テーマ | 影が全方向対称、面は平坦、境界は直値。光の向きが存在しない | `tokens.css` の `--shadow-*` |
| 全テーマ | 暗色の全面グラデーション＋8bit出力でバンディング | `themes.css` `--ambient-aurora` 等 |
| 組版 | 日本語の詰め・約物調整なし。`optimizeLegibility`と全テーマ`antialiased` | `tokens.css` 末尾 |
| 切替 | 一部セレクタのみtransition。グラデ面とcanvasはスナップ | `themes.css:5` |
| 低モーション | `matchMedia`を起動時に1回だけ読む（両シェーダー）。実行中に設定を変えてもrAFが止まらない | `CrtShaderOverlay.tsx:270`, `ShinkaiShaderOverlay.tsx:455` |

## スライスと受入

| id | 名前 | 受入（このスライスで固定する契約） | 状態 |
|---|---|---|---|
| S0 | 計測・安全基盤 | `prefers-reduced-motion`の実行中変化でGLループが停止する／タブ復帰で時間が飛ばない／フレーム時間EMAで品質tierが決まる（純関数テスト） | 実装済み（実機未確認） |
| S1 | 光モデルと素材 | テーマごとの光トークンが定義され、面の上端反射と影の向きが導出される／紙ノイズが`prefers-contrast: more`で無効化される／実効コントラスト検査が合成後で通る | 実装済み（実機未確認） |
| S2 | 日本語組版 | 本文面に`palt`・約物調整・`line-break: strict`が入り、`optimizeLegibility`が消える／明色テーマの`antialiased`が外れる | 実装済み（IME等は未確認） |
| S3 | 切替と時間 | テーマ切替がクロスフェードし、`reduced-motion`は短いフェードのみ／リサイズ中はtransitionなし | 実装済み（実機未確認） |
| S4 | 江戸彼岸 | 花弁が深度・共有風・因果のある回転で動き、`off`/`reduce`で完全停止する（純関数テスト） | 実装済み（実機未確認） |
| S5 | 夜光・曙光 | 粒子がcanvas 1枚になり、DOM粒子が消える／深度・明滅・共通風を持つ／`hidden`/`blur`で停止 | 実装済み（実機未確認） |
| S6 | 深海 | 流速場が`dt`正規化される／水面・放射光柱・Beer–Lambert・疑似ブルームが入る／boot と chunk を共有する（粒のスプライト化・GPU流速場は見送り） | 実装済み（GLSLは実機未確認） |
| S7 | CRT | 走査線ピッチがデバイスpxで一致する／本文のopacity明滅が消える／署名のある欠陥1つに整理される | 実装済み（実機未確認） |
| S8 | 出来事の言い換え | 保存✓がテーマの素材反応になる（新規演出を足さない） | 実装済み（実機未確認） |
| S9 | 到達範囲とコントラスト | 面全体を明るくするCSS合成を避ける／chrome バーと窓全体に演出が届く／読む面が不透明の紙になる | 実装済み（隔離WKWebView検証済み、署名候補GUIは未確認） |

## 各スライスの設計

### S0 計測・安全基盤

- `src/hooks/app/useReducedMotion.ts`: `matchMedia` の `change` を購読し、実行中の切替で `true/false` が返る
- `ShinkaiShaderOverlay` / `CrtShaderOverlay`: `reduceMotion` を state として受け、`true` でrAF停止＋CSSでcanvas非表示
- 時間積算: `elapsed += dt`（`dt = min(frameMs, 50) / 1000`、`hidden`/`blur`中は積まない）。`startTime` リセットを撤去
- `src/features/theme/ambientQuality.ts`: `updateAmbientQuality(state, frameMs)` の純関数。EMA>20msが90フレームで降格、<18msが600フレームで昇格（60Hzでも復帰できる）
- `src/features/theme/ambientRenderBudget.ts`: `nextElapsedSeconds(prev, frameMs, running)` の純関数（時間積算の単一ソース）
- dev専用HUDは `import.meta.env.DEV` と `?atmoStats=1` の両方が真のときだけマウント

### S1 光モデルと素材

- 追加トークン: `--edge-hi`（上端の反射）、`--edge-lo`（下端の陰り）、
  `--paper-texture` / `--paper-texture-size`。`tokens.css` に既定を置き、各テーマが光の色温度に合わせて上書きする
- `--shadow-sm/md/lg` の**先頭に** `inset 0 1px 0 var(--edge-hi), inset 0 -1px 0 var(--edge-lo)` を合成する。
  影の形（blur・色・広がり）は変えないため、既存の面の階層を壊さずに「上から光が当たっている」手掛かりだけを足せる
- 暗色テーマは黒い影を弱め、明度段差と上端反射で高さを出す（影の再設計は S1b 候補）
- 紙の目: `src/assets/themes/paper-grain.png`（128×128・8bitグレースケール・値域244..255）。
  `.cm-editor` と `.markdown-preview`（プレビュー / 電子書籍 / 読書面）の背景へ `background-blend-mode: multiply` で乗せる。
  ウィンドウ全面のブレンド層にしないのは、ページ全体をブレンドグループ化して入力時の再合成を重くしないため
- 乗算は紙だけを約4%暗くする。明色面ではコントラスト比が下がり得るため、最悪ケース（タイル最小値）を
  `themeContrast.test.ts` で合成して 4.5:1 以上を固定する
- `prefers-contrast: more` では `--paper-texture: none` と `--edge-hi/lo: transparent` に落とす（`a11y.css`）
- 見送り: `--light-x/y` と `--shadow-dx/dy`。現在の面は単色で、向きのトークンだけ足しても
  CSS 上で観測できる差が出ない。面に勾配を入れる S1b で一緒に導入する

### S2 日本語組版

- 読み面（`.markdown-preview`, L Modeの`.cm-content`）へ `font-feature-settings: "palt" 1`、`text-spacing-trim: trim-start`、`hanging-punctuation: allow-end`、`line-break: strict`
- 通常編集の`.cm-content`は禁則のみ。未対応プロパティは無視され、既存組版へ戻る
- `text-rendering: optimizeLegibility` を削除、`-webkit-font-smoothing: antialiased` は暗色テーマ限定へ
- `themeContrast.test.ts` ではなく新規の `typesettingCss.test.ts` で契約を固定（機械的に検証できる範囲のみ）

### S3 切替と時間

- `src/hooks/app/useThemeTransition.ts`: テーマ変更の直後だけ `documentElement` に
  `data-theme-switching="true"` を立て、200ms で外す。属性は `useLayoutEffect`（描画前）で
  立てる。`useEffect`（描画後）だと新しい色が先に描かれてから transition が有効になり、
  アニメーションが始まらないことがある。`themes.css` 側で
  面・文字・罫線・影を同じ長さで動かし、部分ごとに色が飛ぶのを防ぐ
- 文字色も一緒に動かす。面だけ先に変わると、切り替えの途中でコントラストが落ちる瞬間ができるため
- `prefers-reduced-motion` では属性の保持を80msに縮める。加えて base.css の
  グローバルガードが transition を 0ms にするため、実効は即時切り替えになる
- 背景グラデーション（yakou / shokou）と WebGL canvas は CSS で補間できないためスナップのまま。
  View Transitions は macOS 26 の WKWebView での対応を実機確認してから別スライスで判断する
- 時間の連続性（タブ復帰で飛ばない）は S0 の `nextElapsedSeconds` が担う

### S4 江戸彼岸

当初は per-frame JavaScript で駆動する案だったが、このテーマには
「per-frame JavaScript と WebGL を使わない」という既存判断とテスト
（`EdohiganAmbient.test.tsx` の「rAF を呼ばない」）がある。静かなテーマの
バッテリー特性を守るため、**CSS アニメーションのまま**作り込む方針に変えた。

- transform の持ち主を 3 段に分ける: `.edohigan-petal`（落下 Y）、`i`（横揺れ＋回転）、
  `i::before`（裏返り）。同じ要素で transform を競合させない
- 共通の風は `.edohigan-petals` の 1 アニメーション（17s の往復）。
  個々の揺れはその上に載り、「別々のループ」ではなく「同じ風への応答」になる
- 落下は終端速度。`v = vTerm(1 - e^(-kt))` を正規化した曲線を `linear()` で近似し、
  `@supports (animation-timing-function: linear(0, 1))` の中だけで使う
  （未対応環境は `linear` のまま＝終端で減速しない）
- 回転は横揺れと同じ周期・同じ位相に置き、横速度と傾きを対応させる
- 3深度（near / mid / far）で サイズ・不透明度・`blur`・速度・振幅 を段階化（空気遠近）
- 花弁のパラメータは `src/features/theme/petalSeeds.ts` の決定論的な純関数。
  周期は非整数比、delay は負値で初期位相を散らす。`--petal-drift` の2値交互は撤去
- 枝花に `drop-shadow` を足し、紙の上に「置かれたもの」として見せる

### S5 夜光・曙光

- `.ambient-yakou` / `.ambient-shokou` の中に `<canvas class="ambient-canvas">` を1枚だけ置き、
  46〜52 個の DOM 粒子（`will-change` 付き）を削除した
- 粒のモデルは `src/features/theme/ambientParticles.ts` の決定論的な純関数。
  奥行き `depth` が 半径・明るさ・速さ・視差を決め、明滅は `1 - depth_twinkle·(1 - (0.5+0.5sin))`
- 風は共通の `ambientWind(t)`（2つの低周波成分）。粒ごとのランダムウォークをやめた
- 配置は黄金比 stride による層化（一様乱数のムラを作らない）
- スプライトは起動時に 64×64 のオフスクリーン canvas へ一度だけ描き、色相は 4 度刻みで使い回す
- 加算合成（`lighter`）は夜光の星と曙光の ember だけ。曙光の影粒は `source-over` の暗い粒
- 強度の意味を修正: dramatic は「多い・速い・明るい」。旧実装は dramatic で周期が 1.35 倍
  （＝遅く）なっており、物理と逆だった
- オーロラは `::before`（22s）と `::after`（37s・逆方向・`soft-light`/`color`）の2層視差

### S6 深海

- 流速場の格子・splat・時間積分を `src/features/theme/waterFlowField.ts` へ抽出し、
  **dt 正規化**した。旧実装は減衰・拡散・移流がフレーム毎定数で、60fps と 30fps で
  水の粘性が変わっていた（1/60 秒の基準フレームで旧実装と同値になる係数に直した）
- マウス位置・速度の平滑化も `1 - exp(-k·dt)` へ（追従の速さがフレームレートに依存しない）
- 水の色を Beer–Lambert へ: 深さで赤から先に落ち、深部だけが青へ沈む
- 光柱を **1 点からの放射**へ。入射位置は水面の波紋で揺れ、水面の明帯と同じ手掛かりで繋がる
- 疑似ブルーム（明部抽出＋加算）、トーンマップの分母を 0.85 へ、最終行に ±0.5/255 のディザ
- 浅い/深いの色・ノイズ・深さの色を `src/features/theme/waterShader.ts` に集約し、
  `ShinkaiShaderOverlay` と `ShinkaiBootSequence` が同じ関数を import する
  （ブートも同じ光源・同じトーンマップ・同じディザに揃えた）
- **見送り**: 流速場の GPU 化（ping-pong の float render target）。RGBA8 フォールバックと
  対応差の検証が別途必要なため。
  dt 正規化と格子の分離まで済んでいるので、後続スライスで差し替えられる
- 通常のunit testでは構造（括弧の対応・uniform 宣言・`u_time` の有無）を固定する。
  追試でmacOS 27.0.1の隔離WKWebViewによる実コンパイル・描画も確認した（下記レビュー記録）

### S7 CRT

- 前景の CSS グラデーション（4px 周期）をやめ、`CrtMaskOverlay` が
  **デバイス px の物理ピッチ（3.0px）**で 1 系統だけ描く。背景シェーダーの
  UV 本数（520 本）と周期が食い違ってモアレになっていた点を解消した
- 1 枚のマスク層に 走査線・ハムバー（7.3s 周期の明帯＝署名のある欠陥）・
  固定位置の焼き付き・ビネット・フリッカー（±3%、0.7Hz）をまとめ、15fps に間引く
- 本文レイヤの `opacity` 明滅（0.70 まで低下）を削除した。実効コントラストが動き、
  長い原稿では全体再描画になっていたため。管の明滅はマスク層の輝度変調が担う
- 文字の色収差はポインタ連動をやめ、`useCrtScanDrift` が500ms間隔で47秒周期の値を書く
  `--crt-mx` だけで駆動する（`mousemove` ごとの本文再描画を解消）
- ランダムグリッチを稀にし（`GLITCH_THRESH` 0.80→0.94）、背景側の明滅も 4.7Hz→0.7Hz へ
- **見送り**: 電源 ON/OFF のビーム収束・degauss。ブート側の見直しとして別スライスに残す

### S8 出来事の言い換え

- 保存の ✓（`.save-affirmation`）を、テーマの素材に応じた反応へ置き換えた。
  新規演出ではなく、既存の 1 つの確認表示の語彙を変えるだけ
- 江戸彼岸=花弁が置かれる（傾いて収まる）／夜光=星が瞬く／曙光=埃が光を受ける／
  深海=圧力波のリング／CRT=蛍光体の点灯と同期バー
- light / dark は既定の pop のまま（静けさを優先）
- すべて 0.4 秒以内、レイアウトを動かさず、`prefers-reduced-motion` で停止する

## 追試・不具合調整（2026-10-19）

演出の負荷を一定許容する方針を維持し、復帰・強度追従・品質回復・CRT走査線・保存✓を調整した。
最終検証と残条件は[テーマ刷新の不具合調整と確認](reviews/2026-10-19-theme-regression-review.md)を参照。
下記のスライス別記録は初回実装時の検証で、GLSL構造検査のみだった制約は追試で更新した。

### S9 演出の到達範囲とコントラスト（2026-10-19 オーナー指摘）

オーナーから3点の指摘を受け、v3.4.0候補へ追加で調整した。

1. 演出が左のワークスペース（サイドバー）だけに見えるテーマがある
2. 中央の編集面に少し明るい色が乗り、コントラストが甘いテーマがある
3. 「読む」を押した後の本エリアのコントラストが甘い（枠内に背景色を置いた方がよい）

原因は2つあった。

- **到達範囲**: 深海・CRT の背景は `--z-base` でペインの**後ろ**にあり、
  サイドバー（`--nav-surface` 0.78）では見えるが、ツールバーと status bar は
  `--chrome-surface` が不透明なため何も透かしていなかった。江戸彼岸は
  `.edohigan-ambient` が `inset: 66px 0 34px` でツールバーと status bar を避けていた。
- **明度を上げる層**: 江戸彼岸以外の演出テーマは、文字の上に**明るくする**層を
  持っていた（夜光の `screen` オーロラ、深海前景の上端グロー、CRT マスクの
  白いハムバーと焼き付き、曙光を含む `::after`）。これが編集面・読書面に
  淡い明るみを乗せ、コントラストを甘く見せていた。

調整:

- 面全体を明るくするCSS合成を避け、夜光のオーロラを `screen`/`soft-light` → `color`へ置換した。
  color合成はWCAG相対輝度の固定を保証しない。深海は上端グローを外し、
  水流とビネットをUIより低い階層へ置いて、文字へ直接重ねない。
  CRT のハムバーと焼き付きは暗い帯・暗い染みへ変えた（明るいのは 1px の芯だけ）
- chrome バー専用の `--chrome-bar-surface` を新設し、江戸彼岸・深海・CRT だけ
  0.9 の半透明にした（`--chrome-surface` はネイティブ窓と palette の契約なので不透明のまま）。
  ツールバーと status bar は同じ `--workspace-chrome-bar` を参照するため、両方に演出が届く
- 江戸彼岸の `.edohigan-ambient` を `inset: 0` にし、枝花と花弁が窓全体に届くようにした
- 読む面（プレビュー・電子書籍・読書）は `--surface-paper-solid`（不透明の紙）にした。
  書き面（編集）は0.95の紙で演出をわずかに残す。深海で実測した明部では旧補助文字が4.35:1まで
  下がったため、紙の透け方を維持して補助文字だけを `#80b1c6`へ調整し、白下地でも静的パレットを検査した。
  読む面と書き面で役割を分けた

`themeContrast.test.ts` は比較用背景との静的パレットを検査する。仮置き色をshaderの厳密な最大値とは扱わず、
深海は隔離WKWebViewの9描画条件で得た各RGB成分最大値と白い下地も回帰検査に加えた。
`ambientReachCss.test.ts` では面全体を明るくするCSSブレンドの除去、深海の積層、江戸彼岸の窓全体への配置を固定する。

追試で電子書籍の共通pane/page-sheetに残っていた半透明紙の参照も修正した。
隔離WKWebViewで前景演出を停止した透過検査により全7テーマのPreview・電子書籍・全幅Readerの紙色が白黒下地で変わらないことと、
深海/CRTの実boot完了後の描画を確認。実CodeMirror・署名候補GUI・DPR2の受け入れではない。
CRTの前景走査線と夜光の粒子は残すため、動的画面全体のAA適合をこの検査から主張しない。
最終結果は[追試記録](reviews/2026-10-19-theme-regression-review.md)を参照する。

**注意（訂正）**: 紙の乗算について「コントラスト比は悪化しない」と書いていたが誤り。
乗算は sRGB 空間で行われるため、明色の紙に暗い文字を載せる場合は比が下がり得る。
実際に下がるのは最悪ケースで数%だが、主張としては撤回し、合成後の検査だけを残す。

## 検証

### 実行した検証（2026-10-19）

- `npm run typecheck` — 成功
- `npm test` — **327 files / 3,048 tests** 成功（EXIT=0）
- `npm run build:vite` — 成功（既存の large chunk 警告のみ）。CSS の構文はここで検証される
  （テキストベースの CSS 契約テストは括弧の過不足を検出しないため、ビルドを必ず通す）
- `npm run smoke:app-store-surface` — 137件成功
- `git diff --check` — 成功

### テストで固定したこと

- **純関数**: `petalSeeds`（深度・非整数比の周期・境界）、`ambientParticles`（数・色相帯・深度・
  明滅・視差・境界）、`ambientQuality`（降格/昇格のヒステリシス）、`nextElapsedSeconds`（復帰で飛ばない）、
  `waterFlowField`（dt 正規化・減衰の単調性・発散しないこと）
- **CSS契約**: 光トークンと影への合成、紙の目と `prefers-contrast: more`、日本語組版と
  `antialiased` の条件、テーマ切替の 200ms、江戸彼岸の 3 段 transform と共通の風、
  保存 ✓ のテーマ別反応、CRT のマスク層
- **シェーダー構造**: 括弧の対応、uniform 宣言、`u_time` を宣言していないシェーダーでの参照禁止、
  共有 chunk の使用（コンパイルは実機のみ）
- **コントラスト**: 紙の目を最悪ケース（タイル最小値）で合成しても 4.5:1 以上

### 未実装の検証手段（次の候補）

- 決定的フレーム（`window.__themeClock` / `?atmoTime=` で時刻を注入して静止画を画素検査）は
  まだ入れていない。GLSL の見え方を自動で比較するには、まずビルドに dev フックを通す必要がある
- 実機のフレーム時間計測（`?atmoStats=1` の HUD は入れたが、数値の記録は未実施）

## リスク・未確認

- `text-autospace` / `text-spacing-trim` / `hanging-punctuation` / View Transitions / `prefers-reduced-transparency` の macOS 26 WKWebView 挙動は未確認（`@supports` とfeature detectで段階適用）
- WebGL canvas上の `backdrop-filter` の費用は要計測。重ければ現状のα合成を維持
- 紙ノイズとガラスは実効コントラストを下げる方向。検査を先に通してから見た目を詰める
- CRTの明滅は現行値の実測（輝度変化量・周波数・実効コントラスト）を取ってから変更する
- 深海域のGPU simはfloat render targetの対応差があるため、RGBA8フォールバックを必ず持つ
- 実機確認（WebGLの見え方、IME入力中の落ち着き、200%文字、VoiceOver）は自動化の代替にしない

## 進捗

| スライス | 実装 | 検証 | 備考 |
|---|---|---|---|
| S0 | 完了 | `npm run typecheck` / `npx vitest run`（新規14件・overlay 9件）/ `npm test` / `npm run build:vite` | 時間積算・品質tier・reduced-motion購読・WKWebView復帰の張り直し。dev HUDは`?atmoStats=1` |
| S1 | 完了 | `npm run typecheck` / `npx vitest run src/styles/materialCss.test.ts src/styles/themeContrast.test.ts`（124件）/ `npm test` / `npm run build:vite` | edge token 7テーマ、影への合成、紙の目（244..255）と合成後コントラスト。実機の見え方は未確認 |
| S2 | 完了 | `npx vitest run src/styles/typesettingCss.test.ts`（12件）/ typecheck / build:vite | 読み面に palt・約物・line-break。編集面は禁則のみ |
| S3 | 完了 | `npx vitest run src/hooks/app/useThemeTransition.test.ts src/styles/themeTransitionCss.test.ts`（7件） | 200ms の属性制御。reduced-motion はグローバルガードで即時 |
| S4 | 完了 | `npx vitest run src/features/theme/petalSeeds.test.ts src/components/app/EdohiganAmbient.test.tsx src/styles/edohiganAmbientCss.test.ts`（23件） | CSS のみで駆動（rAF を使わない既存契約を維持）。実機の見え方は未確認 |
| S5 | 完了 | `npx vitest run src/features/theme/ambientParticles.test.ts src/components/app/AmbientBackground.test.tsx src/styles/editorCss.test.ts`（41件） | canvas 1枚へ移行。粒の数だけ DOM が増える構成を戻さない |
| S6 | 完了 | `npx vitest run src/features/theme/waterFlowField.test.ts src/features/theme/waterShader.test.ts src/components/app/ShinkaiShaderOverlay.test.tsx src/components/app/ShinkaiBootSequence.test.tsx`（24件） | GLSL は構造検査のみ。粒のスプライト化と GPU 流速場は見送り |
| S7 | 完了 | `npx vitest run src/components/app/CrtMaskOverlay.test.tsx src/hooks/app/useCrtScanDrift.test.ts src/styles/jokeThemeReachCss.test.ts`（17件） | ピッチはデバイスpxのみ。管の形状は背景シェーダーが担当 |
| S8 | 完了 | `npx vitest run src/styles/saveAffirmationCss.test.ts`（10件） | light/dark は既定のまま |
| S9 | 完了 | `npx vitest run src/styles/`（19 files・339件） | 実描画はヘッドレス（edohigan の編集/読書面）で確認。shinkai/crt はヘッドレスでWebGLが完走しないため実機確認に残す |
