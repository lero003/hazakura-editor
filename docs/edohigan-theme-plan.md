# Edohigan Theme Plan (v1.6 WIP)

Status: Planning / In-progress
Scope: 江戸彼岸ジョークテーマ v1.6 の実装メモと残課題
Authority: Reference (作業再開用のメモ。発想の原本として扱う)
Last reviewed: 2026-07-06

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
(console.warn 追加) は有用だが未適用のまま残っている。

## 残課題: 花びらシェーダーの見た目調整 (未解決)

### 現状の症状 (2026-07-06 実機確認)

SDF花びら (`petalSdf` / `drawPetals`) と FBM粒 (チリ) の4層が混在し、
複雑に干渉している:

| レイヤー | 正体 | 状態 |
|---|---|---|
| 歪んだ丸 x3 | FBM粒 (チリ) 3層 (fg/near/far) | チリとして復活、良い |
| 回転する罫線 | SDF花びら fg層、巨大すぎて縁が線に見える | 要調整 |
| 縦の光 | SDF花びら near層、干渉 | 要調整 |
| 花びら x2 | SDF花びら fg+near の合成 | サイズ大きすぎ |

### 修正履歴

1. **AA縁の幅修正**: `smoothstep(-1.0, 1.0, d)` → `fwidth(d)` (画面1px相当)
   - 「四角い薄い大きい背景」→「ふわふわしたシャドウ」→「シャドウ解消」と段階改善
2. **petalSdf 再設計**: `sin` プロファイル → アフィン変形ベース
   - 距離場の破綻を解消。ただしまだ「回転する罫線」が残る
3. **サイズ・密度調整**: scale 4.5→9.0, sizeBase 0.22→0.15, density 0.35→0.55
   - まだ大きい。ユーザー感覚で「10分の1以下」が必要かも

### 推奨される次のアプローチ (スクラップアンドビルド)

**MVP方針**: 複雑な4層混在を一旦解き、単純な状態から積み上げる。

1. **SDF花びらを一旦完全に無効化**し、FBM粒 (チリ) だけの状態を確認
2. チリ単体の見た目が良好なら、そこへSDF花びらを1層だけ少しずつ足す
3. 花びらサイズをさらに小さく (scale 20-30 程度、sizeBase 0.05-0.08 程度)
4. 密度を調整してチリと花びらの層を分離

### シェーダーの現状パラメータ (参考)

`drawPetals` 呼び出し (`main()` 内):
```
fg層:   scale=9.0,  sizeBase=0.15, density=0.55, fallSpeed=0.18
near層: scale=16.0, sizeBase=0.12, density=0.50, fallSpeed=0.12
```

`petalSdf` (アフィン変形ベース):
```glsl
float petalSdf(vec2 pos) {
  vec2 p = pos;
  float widen = 1.0 + 0.3 * p.y;  // 根部細く、先端広い
  p.x /= widen;
  p.y *= 1.2;                      // 縦長
  return length(p) - 0.7;
}
```

AA縁:
```glsl
float aa = fwidth(d);
float mask = 1.0 - smoothstep(-aa, aa, d);
```

## 参照

- Commit `c99d4fc9`: 桜→江戸彼岸スクラップ&ビルド (v1.6 WIP)
- Commit `d9689d06`: SDF花びら追加 (petalSdf/drawPetals/hashCell/rot2)
- Commit `ad0ec3e0`: pnpm-lock.yaml 削除 (CodeMirror クラッシュ解消)
- Branch: `feat/edohigan-theme-v1.6`

## 関連ドキュメントの更新候補

- `docs/roadmap.md:737`: `sakura` → `edohigan` へ更新
- `docs/current-status.md:414-416`: テーマ一覧の `sakura` → `edohigan` へ更新
