# スライス07 — 差分レビューを主編集領域で読む（本文面化）

Status: Implemented
Scope: `src/components/app/AppShell.tsx`・`AppWorkspace.tsx`・`src/styles/workspace-chrome.css`・
`src/styles/apple-assist-review.css`・`src/styles/proposal-review-surface.css`・`src/styles/local-assist-sidebar.css`
Authority: Evidence（実コンポーネントの実描画・DOM実測・CSS契約テスト・構造テスト）
Date: 2026-09-11
Branch: `codex/v3`

## 何を変えたか（UI構造だけ）

| | 変更前 | 変更後 |
| --- | --- | --- |
| 置き場所 | `AppShell` 直下の**右下フローティング**（`position: fixed; right: 18px; bottom: 64px`） | `AppWorkspace` の**本文領域**（`.reference-editor-host`）の中（`position: absolute; inset: 0`） |
| 幅 | `min(960px, 100vw - 36px)` | 本文領域いっぱい |
| 高さ | `min(80vh, 800px)`（浮遊パネル前提） | 本文領域いっぱい。**長い差分は面の内側だけ**がスクロール |
| 面 | 半透明 + blur の浮遊パネル | 紙（`--surface-paper`）。読む面として扱う |
| 操作 | パネル内の下端 | 本文領域の**下端に固定**（差分が長くても手が届く） |
| L Mode | `bottom: 64px` へ持ち上げ | 本文領域の中でそのまま（面の位置はホストに従う） |
| サイドバー内の同コンポーネント | — | 従来どおり差し込み表示（`position: static` の上書きを維持。枠と角丸は残す） |

**機能は触っていない**。生成の経路は増やしておらず、適用は既存の単一ライタ
`applyReviewedLocalAssistProposal` **だけ**を通る（`AppWorkspace` は受け取ったコールバックをそのまま渡す）。
反映後は提案が消費されてこの面が消え、編集面へ戻る（従来の挙動のまま）。

## 完了条件との対応

| 完了条件 | 実装／証跡 |
| --- | --- |
| 主編集領域をレビュー面として使う | `.proposal-review-host` を `.reference-editor-host` の中に置いた（構造テスト） |
| タブ・文書・対象範囲のidentityを保持 | `activeTab` をそのまま渡し、対象は提案の `target.activeDocumentName` / `request` を表示（変更なし） |
| 長文Diffは本文領域だけスクロール | 実測: 面の内側の差分だけがスクロール（1440×850 で `clientHeight 515 < scrollHeight 2669`）。ページ自体はスクロールしない |
| Apply / 破棄は下端固定 | 実測: 下端の余白 20px、操作（文書へ反映 184×38）が領域内に収まる。1024×700 でも操作は可視 |
| Apply成功後は提案を消費して通常編集面へ戻す | 変更なし（統合テスト `LocalAssistApply.integration.test.tsx` が消費→面が消える→通知まで固定） |
| Undo可能性と未保存状態を伝える | 変更なし（`copy.undo` と反映後の通知） |
| 生成処理は一切増やさない | 変更なし（`AppWorkspace` はコールバックを渡すだけ） |
| 既存の単一ライタが唯一のApply経路 | 構造テストで `onApply` / `onDiscard` が**同一参照**として届くことを固定 |

## 実測（実描画・実コンポーネント）

| 画面 | 本文領域 | 面 | 差分 | 操作 |
| --- | --- | --- | --- | --- |
| 1440×850・light | 1440×850 | 1440×850（offset 0,0） | 515 < 2669 でスクロール | 下端の余白 20px、「文書へ反映」184×38 |
| 1024×700・dark | 1024×700 | 1024×700（fillsRegion: true） | スクロールする | 操作は領域内（`actionsInView: true`） |

いずれもページ全体はスクロールしない（`pageScrolls: false`）＝面が本文領域の中で完結している。

MEDIA:review-in-editor-region-light-1440.png
MEDIA:review-in-editor-region-dark-1024.png

## テスト

| 種別 | 内容 |
| --- | --- |
| 構造 | `AppWorkspace.test.tsx`: 面が `.reference-editor-host` の中にあり、`.proposal-review-host` に属し、生成ロックが `blocked` として届き、`onApply` / `onDiscard` が**同一参照**であること |
| シェル | `AppShell.layers.test.tsx`: 生成/停止のロックがシェルからワークスペースへ渡ること（レビュー面がワークスペース側へ移ったため、責務の移動に合わせた） |
| CSS契約 | `appleAssistReviewCss.test.ts`: `position: absolute` / `inset: 0` / `fixed` でない / `bottom: Npx` を持たない / 紙 / 面は `overflow: hidden`、差分は `overflow: auto`、フッタは `margin-top: auto` |

- `npm run typecheck` 成功 / `npm test` **272ファイル / 2,386件** 成功

## 追加レビュー対応（P2）

### P2 — 編集 ↔ 提案レビューの往復を一本化

遷移が3つに分かれていた（「書く」＝閉じる＋開示＋本文フォーカス／レビュー内の「案を残して編集に戻る」＝閉じるだけ／
上部の「確認 → 提案」＝既存 region を `focus()` するだけ）。面が unmount されている状態で上部から開こうとすると
region が無く、**「押しても何も起きない」**になっていた。

`AppShell` の遷移を**2本**に統一した。

- `returnToEditing()` = 面を閉じる＋提案は保持＋領域を開示＋本文へフォーカス（「書く」とレビュー内の戻る）
- `openProposalReview()` = 面を見せる＋領域を開示＋次のフレームでレビューへフォーカス（上部の「確認 → 提案」）

面の表示と領域の開示は `showProposalReview()` に集約（別窓からの導線は開示だけを担い、フォーカスはフックが再試行）。

**選択状態も一致させた**: レビューを見せている間は上部ナビの `mode` を `review` にする
（`resolveWorkspaceNavigation()` は提案の有無を `mode` に使っていないため、シェルで上書き）。

回帰テスト（`AppShell.layers.test.tsx`）:

- 「提案表示 → 編集へ戻る → **提案はstoreに残る** → 上部の確認 → 提案 → **同じレビューが再表示＋regionへフォーカス**」
- 「レビューを見せている間は選択状態が `review`」

どちらも修正を外すと落ちることを確認した（TEMP）。

## レビュー対応（P1×1・P2×2）

### P1 — 「書く」でレビューが残り、見えない本文へ入力できていた

- 原因: 「提案がある」と「レビュー面を見せている」が同じ条件だったうえ、面は**エディタを置き換えずに覆う**構造だった。
  「書く」はペインとフォーカスだけ動かすので、面が残ったまま背後の本文へ入力が届く。
- 修正: `AppShell` に `proposalReviewHidden` を持ち、**提案は保持したまま面だけ閉じる**。
  「書く」とレビュー内の「**案を残して編集に戻る**」が同じ経路を通る。新しい提案が来たら再表示する。
- さらに、面が本文を覆っている間は `.editor-pane` を **`inert`** にして、背後の入力・フォーカスを止める
  （エディタは破棄しないので Undo・選択は残る。既存の読み取り専用面と同じ扱い）。
- テスト（実ストアで「提案が残っている」ことも確認）:
  - `AppShell.layers.test.tsx`: 提案ありで「書く」→ 面が閉じ、提案は残る
  - `AppWorkspace.test.tsx`: 面が見えている間は `.editor-pane` が `inert`／閉じると `inert` が外れ、
    **ストアに提案が残っている**（`getLatest` が同じ requestId）
  - どちらも**修正を外すと落ちる**ことを確認済み

### P2 — 狭幅でレビューが隠れる（フォーカスできない）

- 原因: 本文領域を `display: none` にする既存ルール（compact表示・参照表示）の下へ面を移したため、
  タブとDOMがあっても**見えていない**。`focus()` が効かず「開けた」と判定できなかった。
- 修正: 別窓からの「提案を見る」導線に**領域の開示**を組み込んだ（`onRevealRegion`）。
  `AppShell` の `revealEditorRegion()`（compact を編集側へ・参照ペインを畳む・別ペインを閉じる）を
  「書く」とレビュー導線で共有し、**開示 → 再検証 → フォーカス**を数フレームまで再試行する。
  成功条件は `document.activeElement === region`（DOMがあることやタブ一致では成功にしない）。
- テスト: `useLocalAssistReviewNavigation.test.tsx` に
  「開示してからフォーカスする（再試行で成功）」と「開示しても見えないままなら失敗を返す」を追加。
  **開示を外すと落ちる**ことも確認済み。

### P2 — 低い窓で旧フローティング用の高さ制限が残っていた

- 原因: 基本ルールからは外したが、`@media (max-height: 680px)` に `calc(100dvh - 150px)` が残っていた。
- 修正: その上書きを撤去（間隔と見出しサイズの調整だけ残す）。高さは**ホストに従う**。
  サイドバー内の差し込み表示は `local-assist-sidebar.css` が別に制限している。

**測り直し（実描画・面が本文領域を覆いきるか）**

| 条件 | 本文領域の高さ | 面の高さ | 下に残る未被覆 | 操作の可視 |
| --- | ---: | ---: | ---: | --- |
| 1440×**640** | 640 | 640 | **0** | 可視 |
| 1440×**680** | 680 | 680 | **0** | 可視 |
| 1440×700 | 700 | 700 | 0 | 可視 |
| 1024×700 | 700 | 700 | 0 | 可視 |
| 1440×700・**文字200%**（`zoom: 2`） | 1400 | 1400 | **0** | 可視 |

（前回の報告で測っていた 1024×700 は 680px 以下の分岐を通らないため、640 / 680 / 200% を追加した。）

## 証跡の範囲（レビュー指摘への回答）

- fixture（`docs/reviews/2026-09-11-v3-slice-07/`）は**面単体の寸法確認**用で、AppWorkspace・上部ナビ・
  編集との往復を含まない。**それを往復・compact・フォーカスの受入とは言わない。**
- 代わりに、往復・見えている面と入力先・フォーカスは**実コンポーネントのテスト**で固定した
  （上記の3本）。**ネイティブのAI生成を伴う通し確認**（実機で提案を出して「書く」を押す）は未実施。

## 残り

- **11 形式ナビ**（EPUB/PDF/HTML の3コマンド分離 → 共通ダイアログ＋形式ナビ。既存処理の再利用）
- 05 / 12 / 13 / 18 は判断待ち（大型差分・既決との衝突）
- 実機受入（native・WebGL・VoiceOver・横断シナリオ T01〜T10）
