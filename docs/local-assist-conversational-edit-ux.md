# Local Assist — Conversational Document Edit UX

Status: Planning (v2.5+ design SoT)
Scope: Move Hazakura Local Assist from single-shot apply to multi-turn revision conversation
Authority: Medium
Last reviewed: 2026-08-07

## Purpose

Local Assist を、単発の文章修正から **文書対象を固定した編集会話** へ移す。

目標体験:

> 対象となる文章を固定し、AI と会話しながら変更案を育て、
> 最後にユーザーが明示的に文書へ反映する。

一般的な AI チャットを足すのではない。現在の文書と変更案を中心にした
「編集会話」だけを許可する。

本ドキュメントは、ユーザー作成の実装依頼書
（`Local Assistを会話型文書編集UXへ移行する実装依頼書.md`）を repo 正本に
取り込んだものである。実装キューは `docs/v2.5-plan.md` と
`docs/current-work.md` を優先する。

## Non-Goals (this migration)

- メイン画面への Local Assist ドッキング
- 文書全体を無条件に会話へ送ること
- 複数文書をまたぐ会話
- 会話履歴の永続保存 / 再起動後復元
- 同時複数会話セッション
- Foundation Models の `LanguageModelSession` 永続化
- 外部 AI Provider / network fallback
- 任意モデル選択 UI（Core AI ホワイトリスト経路は **別レーン**）
- Web 検索 / RAG / ワークスペース索引
- ツール呼び出し / コマンド実行 / 自動保存 / 連続自動編集
- 一般的な AI 質問チャット

## Product Boundary

`docs/assist-surface-strategy.md` と `docs/security-boundary.md` を守る。

許可:

- 一つの文書対象に結び付いた複数ターンの編集会話
- 前回の変更案に対する追加指示
- 文書へ未反映の変更案
- 会話中だけ保持する一時履歴

禁止:

- 文書と無関係な一般質問・検索チャット
- 永続 AI 会話 DB
- モデル推論過程・生ログ・内部プロンプトの表示
- エージェント的ツール操作

ユーザー向け説明の芯:

> Local Assist は一般的な AI チャットではありません。
> 現在の文章と変更案について、AI と編集相談を行うための会話エリアです。

## Current vs Target Flow

### Current (single-shot apply)

```text
依頼 → 生成 → 未保存バッファへ即時反映 → AiEditTransaction → Review Bar
```

`APPLY_AI_EDIT_TRANSACTION_EVENT` が生成と本文適用を同時に担っている。

### Target (proposal-first conversation)

```text
対象候補 → 最初の依頼で対象固定 → 会話 → 未反映の変更案を更新
  → Diff 確認 → 明示「文書へ反映」 → AiEditTransaction → Review Bar
```

**生成と本文変更を分離する**のが本質。

## UX Contract

1. **開いた直後** — カーソル / 選択から対象候補を表示。候補はライブ更新してよい。
2. **最初の依頼送信時** — 対象文書・tab `sessionId`・範囲・元文章・周辺文脈を固定。
3. **会話中** — カーソル移動で対象を勝手に変えない。変更案はウィンドウ内のみ。
4. **追加指示** — 本文ではなく **現在の変更案** を基準に次案を生成。
5. **文書へ反映** — 明示操作のみ。反映前に元文章との stale 再検証。
6. **反映後** — 既存 `AiEditTransaction` + Review Bar で戻せる。保存はしない。

分離ウィンドウ / companion slot / L Mode 導線 / オンデバイス境界は維持する。

## Data Model (conceptual)

既存 `AiEditTransaction` は **反映済み** 専用のまま。会話・未反映案を混ぜない。

| Type | Role |
|------|------|
| `LocalAssistConversationSession` | 1 会話（tab + 固定対象 + turns + currentProposal） |
| `LocalAssistPinnedTarget` | 依頼開始時に固定した範囲と元文章 |
| `LocalAssistTurn` | ユーザー依頼 / アシスタント UI 文言（生モデル出力ではない） |
| `LocalAssistProposal` | 未反映の変更案（draft / superseded / applied / discarded） |

```text
LocalAssistProposal  --「文書へ反映」-->  AiEditTransaction
```

生成しただけでは `AiEditTransactionStore` に書かない。

## IPC Separation

| Event (names illustrative) | Mutates buffer? |
|----------------------------|-----------------|
| request local-assist turn | No — generate proposal only |
| turn status (partial/completed/failed) | No — update proposal UI |
| apply local-assist proposal | Yes — only path into existing apply |

反映時に tab `sessionId`・path・範囲・元文章・バッファ整合を再確認する。

## Model Context (Foundation Models)

- 初期実装では **リクエストごと新規 session**（helper 永続化しない）。
- アプリ側が Revision Packet を組み立てる:
  - 元文章 / 現在の変更案 / 周辺文脈 / 最新指示 / 直近ユーザー指示（最大 4）
- 過去の変更案全文を毎回送らない。候補は最新一件。
- 文字数上限は現行（対象 ~4k、文脈 ~8k）を維持し、会話で無制限に増やさない。

## Implementation Phases

| Phase | Slice | Done when |
|-------|--------|-----------|
| **P1** | 生成と本文反映の分離 | 依頼・streaming・変更案表示。本文は不変。破棄可。プリセット維持 |
| **P2** | 対象固定 + 複数ターン | 固定対象、追加指示、案基準の再生成、新会話 |
| **P3** | 明示反映 | stale 拒否、transaction 記録、Review Bar、no auto-save |
| **P4** | UI 仕上げ | スクロール、入力固定、a11y、i18n、stale / empty |

**1 run = 1 phase またはそれ以下の検証可能スライス。**  
いきなり全面実装しない。最初は P1 のみ。

## Test Pins (minimum)

1. 初回依頼だけでは本文が変わらない
2. 結果が proposal として保持される
3. 会話開始後、カーソル移動で固定対象が変わらない
4. 追加指示で現在案がモデル入力に使われる
5. 元文章も入力に残る / 履歴は bounded
6. partial はプレビューのみ更新
7. キャンセルで直前の完成案を失わない
8. 新案で旧案は `superseded`
9. 「文書へ反映」まで本文不変
10. 元文章変化時は適用拒否
11. 別 tab / 異なる `sessionId` は stale または拒否
12. 反映後 transaction 1 件 + Review Bar で戻せる
13. 会話・案・処理ログは自動保存されない
14. 内部プロンプト漏洩なし / 外部ネットワークなし
15. availability・cancel・timeout・既存プリセットを壊さない

## File Touch Map (guidance)

分割を優先し、`AppleAssistWindowApp` / `useAppleAssistApplyHandler` を肥大化させない。

- UI: `src/components/appleAssist/` に conversation / proposal / composer 分割
- Hooks: turn 生成と proposal 適用を分離
- Features: `localAssistConversation` / `localAssistProposal`（新規）
- Helper: revision candidate action を追加（既存 generate は移行期間維持）
- Docs: 本ファイル + `assist-surface-strategy.md` のチャット境界文言

## Related

- Queue: `docs/v2.5-plan.md`, `docs/current-work.md`
- Assist boundary: `docs/assist-surface-strategy.md`
- Security: `docs/security-boundary.md`
- Later Core AI whitelist models: `docs/v2.5-plan.md` § Core AI (not this UX slice)
