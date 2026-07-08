# Edohigan Theme Plan (v1.6 WIP)

Status: In-progress (クラッシュ修正済 / 花びら見た目を再調整中)
Scope: 江戸彼岸ジョークテーマ v1.6 の実装メモと残課題
Authority: Reference (作業再開用のメモ。発想の原本として扱う)
Last reviewed: 2026-07-09

## 目的

v1.5 の「桜 (sakura)」テーマを、深海 (shinkai) や CRT と同列の
WebGL ジョークテーマ「江戸彼岸 (edohigan)」へスクラップ&ビルドする。
春の彼岸のはかなさとあでやかさを、青空を舞う桜の花吹雪で表現する。

## 構成要素

- `src/styles/edohigan-theme.css`: パレット・背景・グロー・起動演出CSS
- `src/components/app/EdohiganShaderOverlay.tsx`: 背景WebGLシェーダー (常時)
- `src/components/app/EdohiganBootSequence.tsx`: 起動演出WebGLシェーダー (2.6秒)
- `src/components/app/AppShell.tsx`: テーマ適用のエントリ

## 解決済みの重大問題

### npm/pnpm 混在による CodeMirror クラッシュ (解決済)

**症状**: アプリ起動直後にピンク一色 (#f5e0e8) で何も操作できない。
React が1要素も描画しない。テーマ切り替えも動かない。

**真犯人**: `d9689d06` で誤って `pnpm-lock.yaml` を追加した結果、
npm と pnpm のインストールが混在。`@codemirror/state` が複数インスタンス
読み込まれ、CodeMirror の `instanceof` チェックが壊れて起動時に
React がクラッシュしていた。

**エラーメッセージ** (main.tsx の try-catch 画面出力で捕捉):
```
Error: Unrecognized extension value in extension set ([object Object]).
This sometimes happens because multiple instances of @codemirror/state
are loaded, breaking instanceof checks.
```

**修正**: `pnpm-lock.yaml` を git 管理から削除 (commit `ad0ec3e0`)。
`node_modules` を完全削除 → `npm ci` で `package-lock.json` ベースに再構築。

**教訓**:
- 本プロジェクトは npm 運用。`pnpm-lock.yaml` を絶対に追加しない。
- ピンク画面 = Tauri ネイティブ背景色 (#f5e0e8) が React 描画不能で残った状態。
- コンソールが見えない環境では `main.tsx` の try-catch 画面出力が最終兵器。

### WebGL fail-safe 不足仮説 (チカちゃん調査、外れ)

`EdohiganBootSequence` の WebGL 初期化失敗時に `setPhase("done")` せず
`return` している問題。ただし timer が確実に done へ遷移させるため、
「永遠にベタ塗りが残る」症状の原因ではなかった。観測性改善
(console.warn 追加) は `EdohiganShaderOverlay` 側へ適用済み。

### 花びら SDF の「回転する罫線」(2026-07-09 修正)

**症状**: SDF 花びらが巨大な縁だけ回転する罫線に見え、FBM 粒と干渉。

**原因**:
1. 分岐ループ (density 間引き / mask continue) 内で `fwidth(d)` を使うと、
   隣接ピクセルの制御フロー差で微分が壊れ AA が線になる
2. scale 9 / sizeBase 0.15 で花びらが大きすぎた
3. FBM モヤ 3 層が強すぎて SDF と干渉

**修正**:
- AA を解像度ベース固定幅へ (`1.2 * scale / u_resolution.y`)
- 花びらを小さく 2 層へ (fg scale 18 / far scale 28)
- FBM モヤの不透明度を霞レベルまで下げる
- 重なりは加算ではなく `mix` の over 合成
- シェーダー compile / link 失敗時に `console.warn`

## 現状パラメータ (参考)

`drawPetals` 呼び出し (`main()` 内):
```
far層: scale=28.0, sizeBase=0.055, density=0.38, fallSpeed=0.10, alpha*0.55
fg層:  scale=18.0, sizeBase=0.075, density=0.42, fallSpeed=0.16, alpha*0.88
```

FBM 霞:
```
fg * 0.28 / near * 0.20 / far * 0.14
```

## 残課題

- 実機で花びらサイズ・密度・落下速度の微調整 (好みの問題)
- BootSequence 側は FBM のみ。常時シェーダーと視覚トーンを揃えるかは任意
- `docs/roadmap.md` / `docs/current-status.md` の `sakura` → `edohigan` 表記更新
- リモート `origin/feat/edohigan-theme-v1.6` はローカルより 3+ コミット遅れ
  (pnpm-lock 削除を含む)。push 前に `npm ci` 済みであることを確認

## 参照

- Commit `c99d4fc9`: 桜→江戸彼岸スクラップ&ビルド (v1.6 WIP)
- Commit `d9689d06`: SDF花びら追加 (petalSdf/drawPetals/hashCell/rot2)
- Commit `ad0ec3e0`: pnpm-lock.yaml 削除 (CodeMirror クラッシュ解消)
- Branch: `feat/edohigan-theme-v1.6`

## 関連ドキュメントの更新候補

- `docs/roadmap.md:737`: `sakura` → `edohigan` へ更新
- `docs/current-status.md:414-416`: テーマ一覧の `sakura` → `edohigan` へ更新
