# スライスC — Local Assist の状態・文言・失敗の見せ方（画面06/07/21/22）

Status: Implemented
Scope: `src/components/app/LocalAssistSidebar.tsx`（+`.test.tsx`）・
`src/components/app/LocalAssistProposalReview.tsx`（+`.test.tsx`）・
`src/components/appleAssist/AppleAssistWindowApp.tsx`（+`.test.tsx`・`.render.test.tsx`）・
`src/components/appleAssist/AppleAssistCancellation.integration.test.tsx`・
`src/features/editor/localAssistSidebarSession.ts`・
`src/features/editor/localAssistFailureReason.ts`（+`.test.ts`）・
`src/features/editor/appleAssistText.ts`（+`.excerpt.test.ts`）・
`src/lib/locale/localAssistSidebar.ts`・
`src/styles/apple-assist-window.css`・`src/styles/local-assist-sidebar.css`・
`src/styles/proposal-review-surface.css`・`src/styles/appleAssistWindowCss.test.ts`
Authority: Evidence（実コンポーネントの実描画・DOM実測・CSS契約テスト）
Date: 2026-09-11
Branch: `codex/v3`

## 何を直したか

モックの3画面が要求していた「状態の見せ方」と「文言」を、既存の生成経路（単一のハンドラ）を
変えずに合わせた。

### 07 — 提案の差分レビュー

1. **反映後は反映ボタンを残さない**。同じ案をもう一度「採用」させないため、反映済みの案では
   反映ボタンを**消し**、「文書へ反映しました（未保存）。⌘Zで戻せます。」の案内に置き換える
   （従来は disabled の「反映済み」ボタンが残っていた）。
2. **追加・削除を色だけに頼らない**凡例を追加（記号は `DiffBody` と同じ `-` / `+`）。
3. 反映は1回・保存は通常操作・⌘Zで戻せる、という既存の注意書きはそのまま残した。

実描画での確認（fixture・`?theme=light`）:

| 時点 | 実測 |
| --- | --- |
| 反映前 | 凡例 `- 削除 / + 追加`、反映ボタンあり |
| 反映後 | **反映ボタンなし**、`文書へ反映しました（未保存）。⌘Zで戻せます。` を表示 |

MEDIA:review-light-before-apply.png
MEDIA:review-light-after-apply.png

### 21 — 生成中／停止

- 停止の文言をモックへ: **「生成を停止」**（サイドバー・別窓）、停止処理中は
  **「停止処理中…」**、停止後は「生成を停止しました。本文は変わっていません。」。
  新規生成は増やさず、既存の取消（`cancelAppleAssistProposal` / `stopAppleAssistGeneration`）のまま。
- ロック・連打防止・requestId による古い応答の除外は**変更していない**（既存の契約を維持）。

### 22 — 生成失敗

1. **生の内部エラーを画面に出さない**。別窓の未知エラーは
   「Hazakura Local Assist の生成に失敗しました。対象を確認するか、もう一度依頼してください。」
   の短い案内へ（3言語）。内部文字列は捨てるだけで、ログ等の経路は変えていない。
2. **サイドバーにも理由別の案内**。失敗したターンは、内部メッセージを
   `classifyLocalAssistError` で分類し（`localAssistReasonKey`）、
   アプリ上限 / モデル容量 / 利用不可 / 混雑 / 時間切れ / 形式不正 を**別々の短い案内**にする。
   分類できないものは従来の一般文言のまま。生の文字列は表示しない。
3. **「もう一度試す」**を追加。失敗したターンがあるときだけ出て、既存の送信経路
   （`submit()`）を呼ぶ。依頼文は失敗時に保持されているため、そのままやり直せる。
4. 失敗の面を注意のトークン（`--conflict`）から作った淡い面へ（赤一色の危機演出にしない）。
   別窓の `--error`(=--danger) 依存も置き換えた。文言の下限14pxは既存のCSS契約に合わせた。

### 06 — 別ウィンドウ（部分）

- **入力を下端に固定**。フォーム自体に付いていた `max-height: 45vh` + 内部スクロールを外し、
  スクロールするのは会話だけにした（モックの指示6）。CSS契約テストで固定。
- **対象枠に短い抜粋**（`appleAssistTargetExcerpt`）。種別・文字数に加えて、実際の文の
  先頭60文字を出す（改行と連続空白は1つに畳む）。表示だけで、送信内容は変えない。

## 検証

| 種別 | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | **269ファイル / 2,365件** 成功（+5ファイル・+36件） |

新しいテスト: `localAssistFailureReason.test.ts`（分類の写像）、
`appleAssistText.excerpt.test.ts`（抜粋の整形・省略・空白のみ）、
サイドバーの「分類した理由＋やり直し」、レビューの凡例、反映後にボタンが消えること、
別窓の「生のメッセージを出さない」、CSS契約（入力の固定）。

既存テストの更新（意図した挙動変更に伴うもの）:
- 別窓の停止ボタン: `Cancel` → `Stop generating`。
- 未知エラー: 「raw message preserved」→「raw を出さない」へ期待を反転。
- レビュー: 「反映後も Applied ボタンがある」→「反映後はボタンが消える」。

## 画像との差・未決

- **07の配置（本文面化）は未実装**。モックは「本文領域を広いレビュー面にする」だが、実装は
  右下のフローティング枠のまま（`apple-assist-review.css`）。レイアウトの作り直しになるため
  **別スライス扱い**として残す。
- **06のAI応答カードの見た目**（生成元ラベル付きの紙色カード）は未変更。生成元は本体レビュー側に
  表示済みで、別窓にも出すかは未決。
- 旧 `AppleAssistReviewBar`（採用ボタン付き）はコード上残っている。v2.6 の提案経路はバーを
  enqueue しないため実害は無いが、**削除するかは未決**。

## 残リスク・未受入

- 実機での**生成中の停止 → 停止処理中の表示 → 本文不変**の一連（T-03）は未実施。
- 遅い停止・生成完了と停止の競合、閉窓時の扱いはコード上は既存のまま。実機で確認が必要。
- 別窓の実機での見た目（入力固定・抜粋・失敗面）は**native ウィンドウでの目視が未実施**。
