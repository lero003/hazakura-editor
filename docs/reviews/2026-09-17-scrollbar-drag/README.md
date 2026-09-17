# 編集エリアのスクロールバーをドラッグしてもスクロールしない件（2026-09-17）

Status: 修正済み（ブラウザ検証済み / WKWebView実機は未受入）
Scope: Safe Editor の編集面。右ペイン（プレビュー等）を開いているとき
Authority: Medium

## 症状（オーナー報告）

> マウスでスクロールバーをドラッグすると、うまくスクロールできない。

## 原因（実測）

`.pane-resizer` はペイン幅をつかむ 6px の列だが、その `::before` が
**左右に 4px ずつ** 見えない当たり判定を広げている（`src/styles/workspace.css`）。

```css
.pane-resizer::before {
  left: -4px;
  right: -4px;
}
```

編集ペインの**右隣**にこのリサイザが並んでいるため、`left: -4px` が編集ペインの
右端へ食い込む。スクロールバーは各ペインの右端にあるので、
**スクロールバーの外側 4px はリサイザが持っていき、mousedown がスクロールバーに届かない。**
リサイザ側は `setPointerCapture` を取るため、縦にドラッグしても何も起きない
（横に動かせばペイン幅が変わる）。左隣がワークスペース（ファイルツリー）の
リサイザも同じ条件（ツリーのスクロールバーも右端にある）。

macOS でマウスを使うと「スクロールバー: 常に表示」相当（レイアウトを持つ
スクロールバー）になりやすいことも、外側 4px が効く形で出る理由。

## 実測（in-app browser / Chromium・1440×900・右ペイン=プレビュー）

`?scrollbar=classic` は macOS の「常に表示」相当（`offsetWidth - clientWidth = 15px`）。
編集スクローラの右端 = リサイザの左端（`right` 701.4px / リサイザ 701.4–707.4px）。

| # | 操作 | 右端からの距離 | 結果 |
|---|---|---|---|
| 1 | `elementFromPoint` 走査 | 1–4px | `div.pane-resizer` |
| 2 | 同上 | 5px 以上 | `div.cm-scroller`（スクロールバー）/ `div.cm-line` |
| 3 | つまみを縦ドラッグ | 2px | `pointerdown` の target が `div.pane-resizer`。**scroll イベント 0 件・scrollTop 0 のまま** |
| 4 | つまみを縦ドラッグ | 8px | `pointerdown` の target が `div.cm-scroller`。scroll 133 → 930、最終 `scrollTop = 930` |
| 5 | 帯から横にドラッグ | 2px | ペイン幅が `415.4px` → `288.5px` に変化（編集面はスクロールしない） |

イベントは fixture 側で `mousedown` / `pointerdown` / `scroll` を記録して確認した
（`?scrollbar=classic` の有無で、オーバーレイ（OS 既定）と常時表示の両方を測れる）。

## 再現

```bash
npm run dev:vite
# 常時表示のスクロールバー相当（症状が出る）
open "http://127.0.0.1:1420/docs/reviews/2026-09-17-scrollbar-drag/fixture.html?theme=light&scrollbar=classic"
# オーバーレイ（OS 既定）
open "http://127.0.0.1:1420/docs/reviews/2026-09-17-scrollbar-drag/fixture.html?theme=light"
```

起動後に自動で「ファイルを開く」を押し、長い文書を開く。

## 直した内容（2026-09-17）

左隣は必ず「右端にスクロールバーを持つスクロール面」なので、左への張り出しを
やめれば衝突が消える。つかむ幅は 6px + 右 4px = 10px を確保する（修正前は
6px + 左右 4px = 14px で、4px 狭くなる。リサイザ操作は実測で成立しているので、
スクロールバーを潰してまで 14px を維持する理由はない）。

```css
.pane-resizer::before {
  left: 0;
  right: -4px;
}
```

`src/styles/workspace.css` のコメントも実態に合わせた。固定は
`src/styles/workspaceCss.test.ts`（左へ張り出さない）と
`src/hooks/editor/useSidePaneResize.test.tsx`（6px のリサイザ列。回帰の主テストではなく
レイアウト構造の補助）の2か所。

## 修正後の実測（同じ fixture・同じ条件）

| # | 操作 | 右端からの距離 | 結果 |
|---|---|---|---|
| 1 | `elementFromPoint` 走査 | 内側 1–12px | `div.cm-scroller`（スクロールバー） |
| 2 | `elementFromPoint` 走査 | `right` の外側 1–8px | `div.pane-resizer` |
| 3 | つまみを縦ドラッグ | 2px | `pointerdown` の target が `div.cm-scroller`。scroll 179 → 1441、`cols` は不変（誤リサイズなし） |
| 4 | リサイザ列から横ドラッグ | リサイザ中央 | `288.5px 6px 859.5px` → `542.375px 6px 605.625px`（リサイザは従来どおり動く） |

境界は編集ペインの右端ちょうどに乗った（`editorRect.right` の内側はスクロールバー、
外側はリサイザ）。

## 追補 — 一気に最下部までドラッグすると少し戻る（2026-09-17）

実機の追加報告: 編集面のスクロールバーを**一番下まで一気に持っていくと、末尾より
少しだけ上に戻る**。プレビュー側のスクロールバーでは起きない。

### 実測した原因（2つ重なっている）

`?traceScroll=1` を付けると fixture が `.cm-scroller` への `scrollTop` / `scrollTo`
代入をスタックつきで記録する。これで書き込み元を特定した。

1. **プレビュー側の古いエコーが本文位置を上書きしていた。** ドラッグ終了の直後に
   `usePreviewScrollSync` の `setScrollRatio`（`usePreviewScrollSync.ts`）が
   `scrollTop=2402` を書き込んでいた。原因は editor→preview 側のガード解除が
   **固定 80ms** で、連続イベント（ドラッグ）中に切れること。preview 側は v0.34 で
   「連続イベントで自己延長」に直してあったが、editor 側は取り残されていた。
   そのため、キューに残ったプレビューの古い比率で本文が引き戻される
   （実測: 末尾 2660px に対して 2402px、258px 上）。
2. **行の高さの再計測で最大スクロールが伸びる。** CodeMirror は未計測の行を推定して
   いるため、一気に末尾へ飛ぶと総高さが後から伸びる
   （実測: `scrollHeight` 2647 → 3358、最大 1949 → 2660）。ネイティブのドラッグは
   その時点の最大（2601px）で終わるので、伸びた分だけ末尾より上に残る
   （実測: 59px）。

### 直した内容

- `usePreviewScrollSync`: editor→preview のガードを preview 側と同じ「連続イベントで
  自己延長（150ms）」にし、rAF の待ち時間中に相手側が書き込みを始めていたら降りる
  再チェックを両方向に追加した。
- `EditorPane`: スクロールバーのドラッグが**トラック下端で終わった**ときだけ
  （スクロール位置ではなくポインタ位置で判定）、再計測が止むまで最大 8 フレーム
  底へ寄せ直す。離した後にユーザーが上へ動かしたらその時点で降りる。

スクロール位置で「最下部だったか」を判定しないのは、高さが伸びると位置は
すでに最下部ではなくなるため（実測: ドラッグ終了時 2601px / 再計測後の最大 2660px）。

### 修正後の実測

| 操作 | 結果 |
|---|---|
| 一気に最下部までドラッグ（3回） | 3回とも `scrollTop = max = 2660`（不足 0px） |
| ドラッグ中の JS 書き込み | `settle`（EditorPane）の 1 種類のみ。プレビュー側の上書きは 0 件 |
| 中央までのドラッグ | 本文 0.452 / プレビュー 0.452（底へは寄らない） |
| 最下部 → 220px 上へ戻す | 本文 1602 / プレビュー 1559（比率一致・底へ戻らない） |
| プレビューのホイール操作 | 本文が追従（0 → 2660） |
| 最下部ドラッグ後にプレビューをホイールで上へ | 本文も 0 へ追従（ガードは解除される） |

固定 80ms に戻すと `usePreviewScrollSync.test.ts` の新テストが落ち、
寄せ直しの呼び出しを外すと `EditorPane.test.tsx` の新テストが落ちることを確認した。

## 未確認

- ネイティブ（WKWebView）のオーバーレイスクロールバーでの重なり幅は未計測。
  ヘッドレスの Chromium ではオーバーレイの当たり判定を再現できない
  （`docs/current-work.md` の既存記述と同じ制約）。ヒットテストが描画順で
  決まる点は WebKit も同じなので、同じ帯が死んでいる可能性が高い。
- 実機で「常に表示」とオーバーレイの両方で、右端 2px と 8px をつかみ比べるのが確実。

## fixture で到達できる主要面の総当たり検査（2026-09-17）

同じ型の不具合（スクロール面の端を別要素が奪う）が他に無いか、機械的に洗った。
検査は `scan-scroll-edges.js` をブラウザで実行する。すべてのスクロール面について
右端の 1〜14px を上/中/下の3点、下端の 1〜14px を左/中/右の3点で `elementFromPoint` に
よって走査し、**自分自身でも子孫でもない要素**が返ったら「その端は奪われている」として
報告する。検出対象は**隣接・外部の要素による端の侵食**で、スクロール面の内側にある
absolute/sticky の装飾レイヤーは対象外（後述の限界）。

**範囲は「アプリ全体」ではなく「fixture で到達できる主要面」**である。下の表がその
到達できた面、末尾の「まだ検査していない面」が到達できなかった面で、そこは未計測のまま残る。

偽陰性が無いことの確認（negative control）: 修正前の CSS（`left: -4px`）に戻すと
`.cm-scroller` について `right d1〜d4 -> div.pane-resizer` が 4 件出る。修正後は 0 件。

| 面 | 走査したスクロール面 | conflicts |
|---|---|---|
| 書く / プレビュー（既定） | `div.cm-scroller`, `div.pane.preview-pane` | 0 |
| えるモード（実トグル・L Mode） | `div.cm-scroller`（全ウィンドウ） | 0 |
| 書き出しダイアログ | `div.export-settings-body` | 0（背景の `.cm-scroller` はモーダル遮蔽で出る＝想定内） |
| 確認 / 差分（diff-workbench） | `div.diff-table` | 0 |
| アウトライン / 電子書籍（右ペイン） | 溢れなし（スクロール面が生じず検査対象外） | — |
| ファイルツリー | 溢れなし（空ワークスペース）。右端 1〜8px は `.workspace-empty`＝リサイザが食っていない | 0（幾何のみ） |

構造で問題ないことを確認したもの（実測ではなく読み）:

- 装飾オーバーレイ（`.edohigan-ambient`, `.ambient-yakou` / `.ambient-shokou`）は
  `pointer-events: none`。`pointer-events` は継承するので子にも伝わる。
- L Mode の `.l-mode-action-rail` は `right: 18px`、`.lmode-window-drag-band` は
  `right: 156px` / `height: 52px` で、どちらも右端のスクロールバー帯（10〜15px）に届かない
  （L Mode の走査でも 0 件）。
- ポップオーバーの外側クリック処理（`useSlashMenu` / `WorkspaceSidebar` /
  `TabContextMenu` / `BookScopePanel` / `EditorQuickSettingsMenu`）は mousedown /
  pointerdown で `preventDefault()` しない。開いていてもスクロールバーのドラッグを
  打ち消さない。

今回の修正で張り出しを右へ移した点は、右隣のペインの**左端**（＝本文の余白）に乗る。
実測でサイドバーのリサイザ右張り出しは右ペイン左端の 1〜3px がリサイザ、4px から内容で、
スクロールバーではないことを確認した（スクロールバーは各ペインの右端にある）。

まだ検査していない面（次に触るならここ）: ファイル一覧が入った本物のツリー、
クイックオープン / コマンドパレット / 全文検索のリスト、設定、バックアップ一覧、
Local Assist の会話ログ、Agent Workbench のターミナル、電子書籍の集中読書面。
