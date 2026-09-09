# LA-0 — Local Assistの責務とUI-Cの変更境界

Status: Adopted for v3 implementation
Scope: 現行System経路の所有者、変えないwire、次の抽出単位
Authority: Medium
Last reviewed: 2026-09-09

## 所有者

| 責務 | 現行の正本 | 保つ条件・回帰 |
| --- | --- | --- |
| 別窓の会話・入力・表示対象 | `AppleAssistWindowApp.tsx` | 最初の依頼でpinnedTargetを固定。会話はメモリーのみ。render/cancellation integration tests |
| 対象同期 | `useAppleAssistTargetSync.ts` / `apple_assist_target.rs` | session/path/range/originalが一致する対象。アクティブタブへの無言差替えなし |
| 提案・生成所有権 | `localAssistProposal.ts` / `useAppleAssistProposalHandler.ts` | requestId/ownerによるpartial/terminal排他。失敗・取消後の前案復元。両lifecycle test |
| 主画面の確認・単回反映 | `LocalAssistProposalReview.tsx` / `useAppleAssistApplyHandler.ts` | 再検証して未保存bufferへ1回。失敗時候補保持、Undo。二重クリック/stale/遅い完了の既存テスト |
| TS/native境界 | `lib/tauri/appleAssist.ts` | 固定用途の要求・取消・イベント。任意backend/path/URL入力を追加しない |
| 要求予約・取消・helper再利用 | `commands/apple_assist.rs` / `apple_assist_supervisor.rs` | prepare予約、native終了までlock。完了勝ちのhelperを遅いcancelで破棄しない。Rust同名tests |

## 今回の決定

既存storeと反映handlerは分かれており、置き換えない。
UI-Cでは会話の描画を純粋な部品に分け、言語コピーをlocaleに移す。
要求ID・会話対象・取消のstate/refは元のwindow controllerに残す。
本体レビューでは既存generation lockをblockedへ渡し、停止待ちも反映/破棄を無効にする。

UIの配置変更でnative要求やprotocol、System選択、型の意味を変更しない。
新SDK/AFMの可用性、runtime抽出、モデル資産/DL/切替は別のLA-1以降・v3.1ゲート。

## UI-Cの区切り

- C1: 別窓の対象・会話・入力、生成/失敗表示、提案面の可読性と下端操作列。
- C2: request/sessionを検証した別窓から本体の提案focus導線。
  現行wireの読み取り・破棄/適用後の挙動を固定してから追加する。
- 受入: 実Systemで生成→停止待ち→前案保持→Diff→明示反映→Undo、native小窓/IME/VoiceOver。

C1のブラウザーfixtureは描画・既存イベント処理の証拠であり、System実生成やnative受入に読み替えない。
