# スライスD — 画面14（保存の衝突）と画面24（画像プレビュー）

Status: Implemented
Scope: `src/components/app/SaveConflictDialog.tsx`（+`.test.tsx`）・
`src/hooks/document/useDiskFileMetadata.ts`（+`.test.tsx`）・
`src/features/imagePreview/imageZoom.ts`（+`.test.ts`）・
`src/components/editor/preview/ImagePreviewPane.tsx`（+`.test.tsx`）・
`src/components/editor/EditorMainPane.tsx`（相対パスの受け渡し）・
`src/lib/locale/imagePreview.ts`・`src/styles/workspace.css`・`src/styles/writing-polish.css`
Authority: Evidence（実コンポーネントの実描画・DOM実測）
Date: 2026-09-11
Branch: `codex/v3`

## 画面14 — 保存の衝突

モックの要求は「**二つの版を同格のカードで見せ、主操作は上書きではなく比較**」。実装は
タイトル・説明・3ボタンだけで、版カードが無かった（`SaveConflictDialog.tsx` 全63行）。

1. **二つの版のカード**（`このウィンドウの編集` / `ディスク上のファイル`）を追加。
   - 手元側の文字数は**バッファから実データ**（`tab.contents.length`）。桁区切りは
     ロケールに依存させない自前実装（`1,268`）。
   - ディスク側は**本文を読まず**、既存の `get_file_metadata` が返す**バイト数と最終更新時刻**
     だけを出す。ディスク側の「文字数」は本文を読まないと分からないため、**読めない数字は出さない**
     （モックの「日時・文字数等は得られる実データだけ表示する」に従う）。読めない場合は
     `別の変更` の一行だけになる。
   - 読み取りは新しいフック `useDiskFileMetadata`（読み取り専用・経路変更なし・
     pathless / 非Tauri では何もしない・遅延応答は破棄）。
2. **文言をモックへ**（`別の場所で、ファイルが変更されています` / `…のディスク上の内容が変わりました。`）。
   3言語（ja / en / kana）すべてを同じ構造へ揃えた。
3. **安全状態の notice**「この段階では、どちらの内容も上書きしていません。」を追加し、
   既存の「編集へ戻っても衝突情報は残ります。再読込や上書きは行いません。」と同居させた。
4. **主操作は「差分を確認」**（アクセント面）。戻る／別名で保存は副操作のまま
   （`差分を確認` は `reviewTabAgainstDisk` への既存接続、`別名で保存` は既存 Save As、
   `編集へ戻る` は本文保持のまま `dismiss`）。**上書きへ進むボタンは置いていない。**
5. **外枠**: 幅680px・内側34px・角丸13px。低いウィンドウでは説明とカードだけをスクロールし、
   操作列は固定（`flex: 0 0 auto`）。
   - 注意: `dialogs.css` の `.close-dialog` が `max-width: 420px` / `width: min(420px, …)` を持ち、
     後から読み込まれるため、`.save-conflict-backdrop .save-conflict-dialog` と
     セレクタを一段強くして上書きしている（弱いセレクタでは420pxに負ける）。

## 画面24 — 画像プレビュー

モックの要求は「画像名と読み取り専用、右に縮小・倍率・拡大・全体表示、下に相対パス・実寸・形式」。
実装は名前・実寸・バイト数だけで、**倍率操作が存在しなかった**（テストも「ボタン0個」を固定していた）。

1. **倍率**を表示変換として追加（画像の再圧縮・保存はしない）。段階は
   `25 / 33 / 50 / 67 / 100 / 150 / 200 / 300 / 400 %`。
2. **倍率の定義**: **100% = 画像 1 px が CSS 1 px**（devicePixelRatio では変えない）。
   **「全体を表示」（fit）は 100% と同義にしない**。fit は表示領域から計算する係数で、
   大きい画像では 100% 未満、小さい画像では 1（=100%）で止める（不自然に拡大しない）。
   この定義は `imageZoom.ts` の冒頭コメントに記録した。
3. **拡大時に端へ到達できる**ようにした。`overflow: hidden` で切らず、stage は
   `overflow: auto` + `place-items: safe center`（小さい画像は中央、大きい画像は端まで送れる）。
   画像側は 100% 超でも CSS の `max-width/max-height` で潰されないよう `none` を当てている。
4. **情報列**に**ワークスペースからの相対パス**（ルート配下のときだけ。不明なら名前だけ）と
   **形式**（拡張子から。判断できなければ出さない）を追加。
5. **保存系の操作は置かない**（表示専用のまま）。画像を開くだけで dirty にならないことも既存のまま。

## 検証

| 種別 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **267ファイル / 2,355件** 成功（+3ファイル・+26件） |
| `npm run smoke:app-store-surface` | 117件 成功 |

新しいテスト: `SaveConflictDialog.test.tsx`（版カードの実データ表示・読めないときは数字を出さない・
比較が主操作・notice・focus/Escape・3言語の構造）、`useDiskFileMetadata.test.tsx`（pathless/非Tauri/
失敗/遅延応答の破棄）、`imageZoom.test.ts`（段階・fitの上限・100%とfitの区別・形式・相対パス）、
`ImagePreviewPane.test.tsx`（fit/倍率の操作・保存系が無いこと・width変換・相対パス）。

## 表示（実描画・fixture）

`docs/reviews/2026-09-11-v3-slice-d/fixture.html` は実コンポーネントを描き、**ネイティブ境界だけ**
（`get_file_metadata`）を差し替える。UIではなく境界をスタブしているので、実装と同じ経路で
「実データ」の表示を確認できる。

| 画像 | 実測 |
| --- | --- |
| `conflict-light-1440.png` / `conflict-dark-1440.png` | ダイアログ 680 × 581、内側34px、角丸13px、カード2枚が各299px。ディスク側は「4.1 KB · 最終更新 2026/09/11 12:41 · 別の変更」 |
| `conflict-edohigan-1440.png` | 680px。notice は `--conflict` 由来の淡い面 |
| `image-light-fit-1440.png` | stage 1432 × 750、2560 × 1708 の画像が **43%（fit）**、`全体を表示` が `aria-pressed=true` |
| `image-light-100-1440.png` | ＋で **150%（3840px）**、stage がスクロール可能（端へ到達できる） |
| `image-edohigan-1440.png` | 江戸彼岸（明色）で市松と情報列が成立。info は `#79655e` |

MEDIA:conflict-light-1440.png
MEDIA:image-light-fit-1440.png
MEDIA:image-light-100-1440.png

## 画像との差・未決

- **カードの数値の単位**: モックは両方「文字」。こちらは手元=文字、ディスク=バイト＋最終更新。
  ディスク側の文字数を出すには**本文を読む**必要があり、読み取りを増やさない方を選んだ（意図した差）。
- **「別名で保存」のラベル**: 既存の `…`（ピッカーが開く）表記を維持している。
- **低いウィンドウ**の動作は CSS（`max-height: 700px` で内側24px）まで。実機での操作列固定は未確認。

## 残リスク・未受入

- **実際の外部変更からダイアログへ到達した確認は未実施**（ハーネスからワークスペースを開けない）。
  fixture はネイティブ境界をスタブしているので、**実機でT-04（保存衝突）を実施する必要がある**。
- 画像の**巨大・破損・不在・非対応・権限案内**、および**透明画像の端**は実機で未確認。
- 画像の**設定（外部ローカル画像の承認）**をこの画面から迂回しないことはコード上変わっていないが、
  実機での権限経路は未確認。
