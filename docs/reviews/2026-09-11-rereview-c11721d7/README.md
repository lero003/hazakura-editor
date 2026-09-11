# 外部レビュー第2弾（`c11721d7`）の取り込みと対応

- 対象: `lero003/hazakura-editor` / `codex/v3`
- レビュー対象HEAD: `c11721d79ae1f3265d4b485fe43388b44f052a17`
- 比較基点: `2438ef1f953b14ecf4b5ea30b3c39cbfa6bd30b5`（第1弾のレビュー対象）
- 原典: `review-c11721d7.md`（このディレクトリ。改変していない）
- 証跡: `evidence/`（原典の再現物7点。`SHA256SUMS.txt` で照合済み）
- 判定（原典）: R6 再オープン。P2 2件（F1/F2）、P3 1件（F3）。全8件クローズは保留
- 日付: 2026-09-11（JST）
- 権威: **原典はソース抽出型の最小再現**（本人が明記）。こちらの修正は**実装＋Hook/コンポーネントのテスト**で固定し、
  原典の再現手順は可能な範囲で実アプリfixtureでも測る。

> 原典の証跡は「実アプリでも React Hook 統合テストでもない」最小再現である。混同しない。
> なお同日に作った第1弾取り込み（`2026-09-12-external-review-r1r8/`）は命名時に日付が1日ずれている。

---

## F1 — P2: 切替の準備中にキャンセルしても、新しいダイアログが後から開く

**原因（こちらの実装）**: R6 の修正で `beginExport(next, { replaceOpen: true })` が
`exportAttemptRef.current` を**次形式の preflight へ乗っ取っていた**。旧画面のキャンセルは
`consumeExport(旧形式)` に渡るが、「同じ形式・modal 相」のときしか所有者を消さないため一致せず、
新しい非同期 attempt が生き残って準備完了時に表示されていた。

**修正**: 切替を「所有者の乗っ取り」から**別枠の transition**へ変えた。

- `beginExportTransition(format, cancelPrevious)` — 表示中の所有者と確定権限は**動かさない**。
  世代 `id` を持つ。
- `completeExportTransition(id, format)` — 準備成功時。直前の枠を閉じ、新しい要求を載せ、
  所有者を新形式の modal へ移す（**同じ tick** なので枠が消えるフレームが無い＝R6 維持）。
- `endExportSession()` — **利用者のキャンセル＝セッション全体の終了**。表示要求・切替の準備を
  同じ終了口で捨てる。後着した準備は `transitionIsCurrent(id)` が false になり**表示されない**。
- コントローラの `cancel*ExportSession`（ボタン/Escape の終了口）は `endExportSession()` を通る。

## F2 — P2: 切替準備の例外後、残った旧画面が確定不能になる

**原因**: 新形式の catch が `exportAttemptRef.current = null` にしていたため、旧画面の request は
残るのに確定の入口（`consumeExport(旧形式)`）を通れず、**見える画面と確定権限が分離**していた。

**修正**: 切替の準備で例外が出たら `abandonExportTransition(id)` で**準備だけ**捨てる。
旧形式の要求と所有者はそのままなので、旧画面は**そのまま確定できる**（原典の要求どおり
「一時無効化して理由を見せる」ではなく「仕様どおり実行」を選んだ）。確定した場合は
`confirm*Export` が切替の準備を破棄するので、後から別の面が開かない。

## F3 — P3: Quick Open の結果へ Tab 移動した後、Escape で閉じない

**原因**: Escape が input の `handleKeyDown` にだけ接続されていた（R5 で足した dialog の
ハンドラは Tab trap のみ）。

**修正**: Escape を**面（dialog）側**へ上げ、input 側からは外した（二重取消なし）。
`isImeComposing` の除外・`preventDefault`・`stopPropagation` は維持。

---

## 原典の必須回帰条件 → どこで固定したか

| 条件 | 期待 | 固定場所 |
|---|---|---|
| 旧HTMLを残したEPUB/PDF準備 → Cancel | 解決後にもどのダイアログも復活しない | `useDocumentExport.test.tsx`「does not reopen pdf/epub after cancelling…」(F1) |
| 同上 → Escape | ボタンと同じ終了・草稿破棄 | 同上（Escape は `useModalKeyboardGuard` → `onEnd*ExportSession` → `endExportSession` の同一口） |
| 旧PDF/EPUBを残した準備 → 例外 | 旧形式が再び確定できる | 同「keeps the visible dialog confirmable when the next format preflight throws」(F2) |
| 切替準備中の旧形式Confirm | 押せるのに無反応にしない | 同「runs the visible format when confirmed during a pending switch」(F1) |
| 次形式の連続切替 | 最後の要求だけが有効・ダイアログは最大1つ | 同「keeps only the last of consecutive format switches」(F1) |
| キャンセル後に新しいexport → 古い準備が後着 | 新しいセッションに干渉しない | 同「does not let a cancelled prepare touch a new export session」(F1) |
| Quick Open の input/各結果で Escape | 全て1回だけ閉じる | `SearchSurfaceAccessibility.test.tsx`「closes Quick Open with Escape from the input and from any result」(F3) |

原典の提案テスト（`evidence/add-to-useDocumentExport-tests.ts.txt`）は**そのまま採用**した
（`it.each(["pdf","epub"])` の形で、既存の deferred Book Scope を使う）。

## 検証（この時点）

| 項目 | 結果 | 備考 |
|---|---|---|
| `npm run typecheck` | ✅ | 実行 |
| Vitest 全体 | ✅ **279ファイル / 2,457件** | 実行（前回 2,450 から +7 = F1×2・F2・F1系3・F3） |
| `npm run build:vite` | ✅ | 実行（既知のチャンク警告のみ） |
| `npm run smoke:app-store-surface` | 未実行 | App Store 面を触っていないため |
| `cargo test` | 未実行 | **Rust 無変更** |
| 実アプリfixture（形式切替の枠） | ✅ **396フレームで枠が消えたフレーム 0** | F1/F2 の再設計後も R6 の性質が維持されることを rAF で再測。高さは 781 で一定 |
| F1/F2 の実アプリ再現 | **不可** | fixture の document スコープは準備が即時（`invoke` を呼ばない）で、準備中の窓が作れない。決定的に検証できる Hook テストを証跡とする |
| F3 の実アプリ再現 | **不可** | Quick Open はワークスペースツリーが要る（fixture に無い）。実コンポーネントの DOM テストを証跡とする |

### 未解消のフレーク（原典の指摘どおり、断定しない）

- **`src/components/app/AppWorkspace.test.tsx` > "whole-book edit returns to the retained editor only on open success: true"**
- 観測: 全体実行で **1回だけ** 失敗（その後の単体実行・全体実行では緑）。
- **assertion の文面とログは取得できていない**（最初の実行で結果を行単位で絞り込んだため）。
- 再現条件: そのときは実アプリfixtureのブラウザ実行と dev サーバーを同時に走らせていた（負荷要因の可能性）。
  「負荷が原因」とは断定しない。**未解消のフレークとして残す。**
- 再発したら、この test 名・assertion・実行ログ・同時実行の有無をセットで記録する。

### 引き続き実機受入が必要（自動化の代替にしない）

WKWebView / VoiceOver / 日本語IME / 実機 WebGL 合成 / 信号機 `{x:21,y:27}`（ネイティブ再ビルド）/
配布候補 `.app`。R1〜R8 の「修正を確認」もソースと限定再現の判定であり、ネイティブ受入済みではない。

## ソース（固定コミット）

`https://github.com/lero003/hazakura-editor/tree/c11721d79ae1f3265d4b485fe43388b44f052a17`

主な変更: `src/hooks/document/useDocumentExport.ts`（切替 transition と終了口）、
`src/hooks/app/useAppShellController.ts`（利用者キャンセルを `endExportSession` へ）、
`src/components/app/AppOverlays.tsx`（形式ナビの配線）、`src/components/editor/QuickOpen.tsx`（Escape）。
