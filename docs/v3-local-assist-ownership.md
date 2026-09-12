# LA-0 — Local Assistの責務とUI-Cの変更境界

Status: Adopted for v3 implementation
Scope: 現行System経路の所有者、C2の確認導線、次の抽出単位
Authority: Medium
Last reviewed: 2026-09-10

## 所有者

| 責務 | 現行の正本 | 保つ条件・回帰 |
| --- | --- | --- |
| 別窓の会話・入力・表示対象 | `AppleAssistWindowApp.tsx` | 最初の依頼でpinnedTargetを固定。会話はメモリーのみ。render/cancellation integration tests |
| 対象同期 | `useAppleAssistTargetSync.ts` / `apple_assist_target.rs` | session/path/range/originalが一致する対象。アクティブタブへの無言差替えなし |
| 提案・生成所有権 | `localAssistProposal.ts` / `useAppleAssistProposalHandler.ts` | requestId/ownerによるpartial/terminal排他。失敗・取消後の前案復元。両lifecycle test |
| 主画面の確認・単回反映 | `LocalAssistProposalReview.tsx` / `useAppleAssistApplyHandler.ts` | 再検証して未保存bufferへ1回。失敗時候補保持、Undo。二重クリック/stale/遅い完了の既存テスト |
| TS/native境界 | `lib/tauri/appleAssist.ts` | 固定用途の要求・取消・イベント。任意backend/path/URL入力を追加しない |
| 要求予約・取消・helper再利用 | `commands/apple_assist.rs` / `apple_assist_supervisor.rs` | prepare予約、native終了までlock。完了勝ちのhelperを遅いcancelで破棄しない。Rust同名tests |
| Systemの利用可否と生成能力 | `AvailabilityProbe` / `AssistRuntimeContract`（LA-1aで分離）/ `SystemAssistRuntime` | 四態wireは不変。能力失敗は `unsupported_language`、利用可否失敗は `unavailable`。26未満の能力は不明。製品経路は `system_default` のみ |

## 今回の決定

既存storeと反映handlerは分かれており、置き換えない。
UI-Cでは会話の描画を純粋な部品に分け、言語コピーをlocaleに移す。
要求ID・会話対象・取消のstate/refは元のwindow controllerに残す。
本体レビューでは既存generation lockをblockedへ渡し、停止待ちも反映/破棄を無効にする。

C1の配置変更では生成/取消protocol、System選択、型の意味を変更しない。
C2の確認専用wireとApply/Discard通知のsession追加は下記の範囲に限定する。
新SDK/AFMの可用性、runtime抽出、モデル資産/DL/切替は別のLA-1以降・v3.1ゲート。

## UI-Cの区切り

- C1: 別窓の対象・会話・入力、生成/失敗表示、提案面の可読性と下端操作列。
- C2: conversation/request/document sessionを検証した別窓から本体の提案focus導線。
  16e438ebで実装。閉じた文書・stale・streaming・別提案は拒否し、タブ切替後も再検証。
- 受入: 実Systemで生成→停止待ち→前案保持→Diff→明示反映→Undo、native小窓/IME/VoiceOver。

C1のブラウザーfixtureは描画・既存イベント処理の証拠であり、System実生成やnative受入に読み替えない。

## C2の確認専用連携

別窓は最後に完了した提案の3つのIDを保持する。追加生成の失敗/取消では前案のIDを残す。
「この提案を見る」は生成/停止待ち中に無効。本文・path・window labelは渡さない。
提案の3 IDとは別に、操作ごとのnavigationIdを採番して結果まで往復する。
`request_apple_assist_review`はapple-assist caller限定、IDの空/制御文字/200 bytes超過を拒否。
mainは開いたsessionの最新proposalと元文章を照合し、既存タブ選択を使用する。
Reader/モーダル/画像表示中は移動を拒否。切替後にも照合し、main限定の
`focus_main_apple_assist_review`で固定の本体窓を前面にし、proposal regionへfocusする。
結果は3 IDとnavigationIdで別窓へ返す。結果・invoke失敗・5秒のタイマーは現在の試行だけを終了する。
新しい会話、完了提案の置換、反映/破棄で待機を失効。mainは受信から4秒の期限を持ち、
タブ切替や再renderで延長せず、native応答が遅れてもregion focus/成功通知を行わない。
この期限は確認導線だけの失敗表示であり、生成/取消の完了判定には使わない。

mainのApply/Discard結果にもdocumentSessionIdを付加する。別窓は3 IDすべて一致し、
新しい生成要求がない場合のみ結果を受領する。欠けたID、以前のrequest、別sessionは無視する。
生成・Apply・Undoの所有者、helperの終了/取消mutex、no auto-saveは変更しない。
