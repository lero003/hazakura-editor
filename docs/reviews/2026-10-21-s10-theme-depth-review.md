# S10 テーマ紙面深度の確認（2026-10-21）

Status: Source corrections and local signed package verified; candidate GUI / Retina acceptance pending
Scope: v3.4 S10（紙面の縁、江戸彼岸の花、深海の前景ボケ、CRTのブルームとRGBグリル）
Authority: Review record
Last reviewed: 2026-10-21

## 変更

S9でコントラストを守るために演出を紙の外へ逃がした結果、画面の大半を占める紙が無地に見えた。
S10では presentation 層だけを触り、紙の内側と前景へ深度を戻した。

- 共通: `material.css` の `.cm-editor` に `--edge-hi` / `--edge-lo` の1pxの縁
- 深海: 紙面の水中光グラデーションと3つの光だまり、読む面/プレビューの深度、
  ツールバーの水面光。UI手前の左右に大きなボケ粒（中央のテキストカラムはmaskで除外）
- 江戸彼岸: 花弁を通常14・強22へ増量し、サイズと濃さを一段上げた。枝は根元を軸に±0.9°で揺れ、
  紙には暖色の朝の光。花弁の中央カラムはmaskのまま
- CRT: 文字の蛍光ブルーム（1px芯+14px）、走査線0.30→0.24、ガラス面の3px周期RGBグリル、
  紙面のヒートスポット、読む面/プレビューの階調、ハムバー芯0.16
- 文字色・紙の不透明度・保存形式・書き出し内容・実行/path/AI境界は変更していない
- 読む面の `text-shadow` 除去契約（`preview.css`）は維持し、テーマ側から戻していない

## 確認条件

- macOS 27.0.1 の非永続WKWebView、1280×800、DPR 1、非永続データストア
- 実ソースのCSSと演出部品を使う隔離fixture。実Tauriアプリ・実CodeMirrorではない
- 3テーマ（edohigan / shinkai / crt）の編集・プレビュー・電子書籍・全幅Readerを取得
- 静止画取得時だけ fixture の `contentEditable` を外した。取得中にOSのIME合成文字が
  1枚へ混入したためで、製品側の挙動を変えたものではない
- 比較画像・report・source digestはignoredの `docs/internal/theme-s10-proto/` に保持

## 観測

- 深海: 紙の上端が水中光で明るく、下端が沈む。左右の前景ボケで「水の壁紙の前」から
  「水の中」へ寄った。ボケはUIの手前・左右のみで、中央の文字カラムには乗らない
- 江戸彼岸: 紙の左上に暖色の光が入り、枝が紙の左下へ影を落とす。花弁は通常14枚で、
  静止画の1コマでは3〜5枚が見える程度。動作中の見え方は静止画より多い
- CRT: 文字の周囲に蛍光の滲みが出て、走査線だけの「暗いフィルム」から管へ寄った。
  ガラスのRGBグリルとハムバーの芯は細部として視認できる
- 3テーマとも読む面は不透明の紙のまま。文字色は変えていない

## S10追加時の検証

- `npm run typecheck` — 成功
- `npm test` — **332 files / 3,109 tests** 成功、scripts 31件成功
- `npm run build:vite` — 成功
- `git diff --check` — 成功
- CSS契約: `themeDepthCss.test.ts` / `edohiganDepthCss.test.ts` / `materialCss.test.ts` /
  `jokeThemeReachCss.test.ts`。花弁: `petalSeeds.test.ts` / `EdohiganAmbient.test.tsx`。
  背景ボケ: `ShinkaiShaderOverlay.test.tsx`。走査線: `CrtMaskOverlay.test.tsx`

## 追加レビューの修正と候補再生成（2026-10-21）

コードレビューで見つかった3件を修正した。演出の強さ・文字色・紙の不透明色は変更していない。

- 3テーマのプレビュー光が、後続の `preview.css` の `background` で消されていた。
  不透明の紙色を `background-color` で指定し、テーマ側の画像レイヤを維持する
- CRTマスクが別アプリへ切り替えた後も描画していた。初期focusとfocus/blurを監視し、
  非アクティブ中はタイマーを止める。復帰時の位相と単一タイマーを維持する
- 江戸彼岸の `i::before` が `:is()` 内で無効になり、裏返りだけ停止していなかった。
  擬似要素のセレクターを外へ分ける

CRT 2件・CSS 4件の失敗を先に再現し、修正後に成功した。全体はfrontend **332 files / 3,116 tests**・
scripts 31件、Rust 515成功 / 4 ignored、fmt・型検査・両lane Vite・App Store surface 137件が成功。
隔離WKWebViewの計算済みスタイルで、3テーマのグラデーション到達・紙色の前後一致・
本文の `text-shadow: none` 維持、花弁の裏返りの `running` → `paused` を確認した。
再現・追試証跡はignoredの `docs/internal/theme-s10-review-fixes/` に保持する。

修正をcommitしたclean sourceからS10を含む署名pkgを再生成した。pkg/appの署名、展開payload全14項目の
元appとの一致、全5実行物のuniversal構成、profile・権限・notice、installer XMLを確認した。
旧pkg15個と生成ビルド番号を除くtracked source 1,806ファイルは不変。
版・build・hash・source状態はignoredの `docs/internal/app-store-candidates/latest.json`、
詳細は同ディレクトリの `v34-review-build*-verification.local.json` で照合する。
生成後はビルド番号と文書のみを別commitで記録する。push・uploadは行っていない。

## 残条件・リスク

- **DPR 2以上のRetina実機は未確認。** 走査線・RGBグリル・ブルームの見え方はDPR 1と異なる
- 実CodeMirrorの長文・IME・カーソル位置、L Mode、VoiceOver、200%文字は未確認
- 前景ボケは `filter: blur(28px)` の固定レイヤ。実機のGPU負荷は未計測
- ボケはUIの手前・左右にのみ置くが、局所コントラストへの影響は画素単位で主張しない
- 江戸彼岸の花弁は中央カラムをmaskで外しているが、左右の帯では本文の端に重なり得る。
  実機の長文で読みにくさがないか確認する
- 最新の署名pkgはS10と上記3件を含む。署名候補GUI・実機の受け入れは未確認

## 次

1. 最新の署名pkgで7テーマを実アプリで確認する
2. Retina（DPR 2以上）で走査線・グリル・ボケを確認する
3. 実CodeMirrorの長文/IME、L Mode/Reader、200%文字、VoiceOverを同一候補で受け入れる
4. 前景ボケと花弁の負荷を実測し、必要なら強度 `subtle` の既定値を調整する
