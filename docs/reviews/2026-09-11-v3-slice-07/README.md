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

## 残り

- **11 形式ナビ**（EPUB/PDF/HTML の3コマンド分離 → 共通ダイアログ＋形式ナビ。既存処理の再利用）
- 05 / 12 / 13 / 18 は判断待ち（大型差分・既決との衝突）
- 実機受入（native・WebGL・VoiceOver・横断シナリオ T01〜T10）
