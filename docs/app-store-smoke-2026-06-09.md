# App Store smoke (2026-06-09)

- Date: 2026-06-09
- Scope: App Store-facing quality queue (1–5) closeout後の手動 + ローカル smoke 記録
- Lane: App Store preview（`npm run build` が実行する `HAZAKURA_DISTRIBUTION_LANE=app-store`）
- App build used for manual smoke: `src-tauri/target/release/bundle/macos/hazakura editor.app`

## 実施コマンド

- `git pull` → `Already up to date.`
- `npm run build` → PASS
- `npm run build:vite` → PASS
- `npx vitest run` → PASS（75 files, 587 tests passed）
- `git diff --check` → PASS（問題なし）
- `npm run build:app-store-preview` → PASS（`npm run build` の App Store 入力構成再確認）

## 実施結果（pass / fail / skipped）

### 1) App Store preview lane build

- PASS: App Store lane 化された build が実行された
  - `npm run build` / `build:app-store-preview` のログ内で
    `HAZAKURA_DISTRIBUTION_LANE=app-store` と `VITE_HAZAKURA_DISTRIBUTION_LANE=app-store` が有効化されている。
- PASS: `agent.html` が App Store lane の生成物に混ざっていない
  - `npm run build:app-store-preview` 実行後 `dist` は
    `apple-assist.html, index.html, assets/, favicon.png` のみ。
- PASS: 実機起動済みメニューに Agent Workbench 固有エントリが見えない
  - メニュー構成（`hazakura editor`, `ファイル`, `編集`, `表示`, `ウィンドウ`, `ヘルプ`）内の `表示` メニューは
    `Apple Assist ウィンドウを開く`を確認。
  - `Open Agent Window` / `Send Selection to Agent` といった Agent Workbench 表示は未確認（不在）。

### 2) Safe Editor 基本操作

- PASS: アプリ起動 / Markdown ファイル open
  - `open -a "hazakura editor" /tmp/hazakura-smoke-2026-06-09/smoke.md` で
    ウィンドウタイトルが `smoke.md - hazakura editor` と表示。
- FAIL: 編集の自動実施
  - 再現手順: アプリ起動後、`osascript` で `⌘A` + `⌘C` を送信。
  - 期待: クリップボードに開いている Markdown 全文が入り、ファイル内容も編集対象として認識される。
  - 実結果: クリップボード内容はアプリ変更前と同一（ユーザー依頼文の長文）で、`/tmp/.../smoke.md` も不変（`cat` で確認）。
  - 推定要因: WebView 側にキーイベントが到達しておらず、実 OS の自動キーボード smoke が前提どおり再現できない。
- SKIPPED: 保存（`⌘S`）
  - 上記の未編集状態に起因し、保存対象の内容差分が作れなかった。
- SKIPPED: Preview 表示（`プレビュー`）
  - 直接操作での対象 UI に到達できず、確認経路が確定しない。
- SKIPPED: HTML export
  - 同上（編集・保存まで到達できないため `HTMLとして書き出す…` の UI 検証は未実施）。
- SKIPPED: 保存後整合性確認
  - 先の編集保存経路が通らないため未実施。

### 3) Dirty close / quit

- SKIPPED: 未保存変更ありで赤ボタン close / `⌘Q`
  - App 内での dirty 編集を再現できず、dirty 状態を意図的に作れなかった。
- SKIPPED: Save / Discard / Cancel 挙動
  - 上記の理由によりダイアログ観測が未実施。

### 4) Keyboard-only smoke

- SKIPPED: Tab キーでの主要操作移動、TabBar 矢印/Home/End 操作、close button 到達
  - `AXFocusedUIElement` / `AXRole` 取得時に `-1728` / `-1700` が再発し、UI Accessibility 経路でフォーカス追跡できなかった。
- SKIPPED: L Mode task checkbox の keyboard 到達・切替
  - OS 自動操作時に focus の可視化が取れず、キーボード経路の最終確認未実施。

### 5) Accessibility smoke

- SKIPPED: VoiceOver で tab name / unsaved state 読み上げ
  - VoiceOver 自体を起動しての検証までは実施していない（環境条件上不実施）。
- SKIPPED: StatusBar の保存・未保存 state 可読性
  - Accessibility 経路で状態系ラベルの安定抽出ができず。
- SKIPPED: Increase Contrast での UI 崩れ確認
  - 設定切替＋再読取りの手順を安全に実施できない環境条件のため。

### 6) Apple Local Assist

- PASS: availability の自然性
  - App Store lane で `build` 時の probe が `probe: {"value":{"kind":"available"},"kind":"availability"}` を返却。
  - 実行済み。
- PASS: Agent Workbench 混在確認
  - ビルド・起動確認時に Agent Workbench 固有メニューが観測されず。
- PASS: Apple Local Assist ウィンドウの起動可否
  - `表示 > Apple Assist ウィンドウを開く` 実行で `hazakura apple assist` ウィンドウが立ち上がり。
- SKIPPED: 実際の生成
  - 方針どおり未実施。

## 失敗・未実施の要約

- 失敗: App 内でのキーボード入力（編集系）が到達せず。
  - 再現手順: ファイル open 後に `osascript` で `⌘A` + `⌘C`。
  - 期待: 選択＋コピーされ、クリップボード内容が `smoke.md` の本文になる。
  - 実結果: アプリ由来の更新は見えず、`smoke.md` も変更なし。
- 未実施（環境要因）: dirty close/quit、Unsaved close dialog、Keyboard-only focus chain、VoiceOver、Increase Contrast。

## App Store / 署名に関する明示

- `npm run build` は ad-hoc signing で実行され、`App Store signed / submitted / approved / TestFlight-ready / notarized` はいずれも claim していない。
- `notarization` は `src-tauri/target` ビルドログ上で「環境変数不足による省略」を確認済み。
