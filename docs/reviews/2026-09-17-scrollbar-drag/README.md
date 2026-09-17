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
やめれば衝突が消える。つかむ幅は 6px + 右 4px = 10px 残る。

```css
.pane-resizer::before {
  left: 0;
  right: -4px;
}
```

`src/styles/workspace.css` のコメントも実態に合わせた。固定は
`src/styles/workspaceCss.test.ts`（左へ張り出さない）と
`src/hooks/editor/useSidePaneResize.test.tsx`（6px のリサイザ列）の2か所。

## 修正後の実測（同じ fixture・同じ条件）

| # | 操作 | 右端からの距離 | 結果 |
|---|---|---|---|
| 1 | `elementFromPoint` 走査 | 内側 1–12px | `div.cm-scroller`（スクロールバー） |
| 2 | `elementFromPoint` 走査 | `right` の外側 1–8px | `div.pane-resizer` |
| 3 | つまみを縦ドラッグ | 2px | `pointerdown` の target が `div.cm-scroller`。scroll 179 → 1441、`cols` は不変（誤リサイズなし） |
| 4 | リサイザ列から横ドラッグ | リサイザ中央 | `288.5px 6px 859.5px` → `542.375px 6px 605.625px`（リサイザは従来どおり動く） |

境界は編集ペインの右端ちょうどに乗った（`editorRect.right` の内側はスクロールバー、
外側はリサイザ）。

## 未確認

- ネイティブ（WKWebView）のオーバーレイスクロールバーでの重なり幅は未計測。
  ヘッドレスの Chromium ではオーバーレイの当たり判定を再現できない
  （`docs/current-work.md` の既存記述と同じ制約）。ヒットテストが描画順で
  決まる点は WebKit も同じなので、同じ帯が死んでいる可能性が高い。
- 実機で「常に表示」とオーバーレイの両方で、右端 2px と 8px をつかみ比べるのが確実。
