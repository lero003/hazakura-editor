# Local Assist — Conversational Document Edit UX

Status: A-1–A-3 complete locally; A-4 finishing in review
Scope: Separate Local Assist conversation from Diff-based proposal review and explicit apply
Authority: Medium
Last reviewed: 2026-08-16

## Purpose

Local Assist を、単発の文章修正から **文書対象を固定した編集会話** へ移す。

目標体験:

> 対象となる文章を固定し、AI と会話しながら変更案を育て、
> 現在の変更案は会話とは別の Diff 確認領域で読み、
> 最後にユーザーが任意で文書へ反映する。

一般的な AI チャットを足すのではない。現在の文書と変更案を中心にした
「編集会話」だけを許可する。会話領域に変更本文・Diff・反映操作をすべて
詰め込まず、**会話する場所**と**本文変更を確認する場所**を分ける。

本ドキュメントは、ユーザー作成の実装依頼書
（`Local Assistを会話型文書編集UXへ移行する実装依頼書.md`）を repo 正本に
取り込み、2026-08-16 に Diff 分離型へ具体化したものである。実装キューは
`docs/v2.6-plan.md` と
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

### Before v2.6 (single-shot apply)

```text
依頼 → 生成 → 未保存バッファへ即時反映 → AiEditTransaction → Review Bar
```

当時は `APPLY_AI_EDIT_TRANSACTION_EVENT` が生成と本文適用を同時に担って
いた。現在は生成を `REQUEST_AI_EDIT_PROPOSAL_EVENT` と proposal status
へ分離し、反映時にモデルをもう一度呼ばない。

### Current (A-3 locally reviewed)

```text
対象候補 → 最初の依頼で対象固定
  → 会話領域で依頼・追加指示
  → proposal status → Diff 確認領域で現在案を表示・更新
  → Diff の明示「文書へ反映」 → AiEditTransaction → Review Bar
```

反映しない場合は、案を破棄するか会話を終了できる。どちらも保存は行わ
ず、本文は変更しない。これは v2.6 A-3 のローカル実装であり、公開製品や
実機 Assist の検証済み状態を意味しない。

### Target (proposal-first conversation)

```text
対象候補 → 最初の依頼で対象固定
  → 会話領域で依頼・追加指示
  → Diff 確認領域で現在の未反映案を表示・更新
  → 任意「文書へ反映」 → AiEditTransaction → Review Bar
```

**生成と本文変更を分離し、会話と変更確認も分離する**のが本質。

## Surface Contract

Local Assist Window は、一つの会話画面にすべてを積むのではなく、次の責務を
分ける。

| Surface | Shows | Does not own |
|---------|-------|--------------|
| **Conversation** | ユーザーの依頼、追加指示、短い応答、composer、プリセット | 長い変更本文、Diff、反映判断、処理生ログ |
| **Diff review** | 固定した元文章と現在の未反映案の差分、変更量、stale 状態、反映・破棄 | 会話履歴、モデル内部状態、自動保存 |
| **Editor** | 現在の Markdown buffer | 未反映案。明示反映までは変えない |
| **Operation status** | 送信中、生成中、取消中、失敗、利用不可 | 会話ターン、provider transcript、推論過程 |

概念配置:

```text
┌ Conversation ──────────┐  ┌ Diff review ────────────┐
│ 対象 / user turns      │  │ 元文章 ↔ 現在の変更案    │
│ short assistant state  │  │ [案を破棄] [文書へ反映] │
│ composer / presets     │  │ stale / change summary  │
└────────────────────────┘  └─────────────────────────┘

Editor buffer: 「文書へ反映」までは不変
```

ウィンドウ幅が狭い場合は上下に並べてよいが、意味上の領域とフォーカス順は
混ぜない。会話欄の assistant turn は「変更案を更新しました」のような短い
状態を示し、変更本文の正本は常に Diff review の `currentProposal` とする。

## UX Contract

1. **開いた直後** — カーソル / 選択から対象候補を表示。候補はライブ更新してよい。
2. **最初の依頼送信時** — 対象文書・tab `sessionId`・範囲・元文章・周辺文脈を固定。
3. **会話中** — カーソル移動で対象を勝手に変えない。変更案はウィンドウ内のみ。
4. **追加指示** — 本文ではなく **現在の変更案** を基準に次案を生成し、Diff review を置き換える。
5. **Diff review** — 会話ターンではなく、固定した元文章と現在案の差分を一箇所で表示する。
6. **文書へ反映** — Diff review の明示操作のみ。反映前に元文章との stale 再検証。
7. **任意性** — 反映せずに案を破棄、コピー、または会話を終了できる。終了だけでは本文を変えない。
8. **反映後** — 既存 `AiEditTransaction` + Review Bar で戻せる。保存はしない。

分離ウィンドウ / companion slot / L Mode 導線 / オンデバイス境界は維持する。

## Data Model (conceptual)

既存 `AiEditTransaction` は **反映済み** 専用のまま。会話・未反映案を混ぜない。

| Type | Role |
|------|------|
| `LocalAssistConversationSession` | 1 会話（tab + 固定対象 + turns + currentProposal） |
| `LocalAssistPinnedTarget` | 依頼開始時に固定した範囲と元文章 |
| `LocalAssistTurn` | ユーザー依頼 / アシスタント UI 文言（生モデル出力ではない） |
| `LocalAssistProposal` | 現在表示する未反映の変更案。生成開始時の bounded `actionId` も保持し、表示用の依頼文を編集しても Apply の provenance を変えない。新案は同じ Diff を置き換え、状態 enum を永続化しない |

```text
LocalAssistProposal  -- Diff review の「文書へ反映」-->  AiEditTransaction
```

生成しただけでは `AiEditTransactionStore` に書かない。

## IPC Separation

| Event (names illustrative) | Mutates buffer? |
|----------------------------|-----------------|
| request local-assist turn | No — generate proposal only |
| turn status (partial/completed/failed) | No — update Diff review candidate only |
| discard local-assist proposal | No — clear current proposal / review state |
| apply local-assist proposal | Yes — Diff review is the only path into existing apply; stale target is rejected |

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
| **P1** | 生成と本文反映の分離 | 依頼・streaming・Diff review 表示。本文は不変。破棄可。プリセット維持 |
| **P2** | 対象固定 + 複数ターン | 固定対象、追加指示、案基準の再生成、現在 Diff の置換、新会話 |
| **P3** | Diff から明示反映 | stale 拒否、transaction 記録、Review Bar、no auto-save; locally reviewed |
| **P4** | 二領域 UI 仕上げ | conversation / Diff のレスポンシブ配置、focus、a11y、i18n、stale / empty |

**1 run = 1 phase またはそれ以下の検証可能スライス。**  
A-1 / P1、A-2 / P2、A-3 / P3 はローカル `main` に統合済み。次の
hardening と P4 / A-4 のレイアウト・アクセシビリティ仕上げは別の
レビュー境界に残す。現在のA-4候補は、会話とDiffを狭幅でも区分けして
表示するCSS preflight（Diffの可変高さ、横溢れ抑制、変更サマリーの折返し）
に加えて、Diff列見出しのアクセシビリティ公開、cancelledの独立した
operation feedback、probe中のavailability表示を含む。キーボード・
VoiceOver・i18n・実機streaming/cancelはまだ外部確認の対象である。

## Test Pins (minimum)

1. 初回依頼だけでは本文が変わらない
2. 結果が proposal として保持され、Diff review に表示される
3. 会話開始後、カーソル移動で固定対象が変わらない
4. 追加指示で現在案がモデル入力に使われ、完成後は同じ Diff review が更新される
5. 元文章も入力に残る / 履歴は bounded
6. partial はプレビューのみ更新
7. キャンセルで直前の完成案を失わない
8. 新案で旧案を同じ Diff 表示に置き換える
9. 「文書へ反映」まで本文不変
10. 反映操作は会話メッセージではなく Diff review にあり、元文章変化時は適用拒否
11. 別 tab / 異なる `sessionId` は stale または拒否
12. 反映後 transaction 1 件 + Review Bar で戻せる
13. 会話・案・処理ログは自動保存されない
14. 内部プロンプト漏洩なし / 外部ネットワークなし
15. availability・cancel・timeout・既存プリセットを壊さない
16. 会話領域へ変更本文全文や operation feedback 生ログを重複表示しない
17. 狭い幅でも conversation → Diff controls のフォーカス順と反映判断を保つ
18. Diffの元文章 / 生成案の列見出しをVoiceOverへ公開し、各cellへ関連付ける
19. cancelledをfailedと混同せず、本文不変のfeedbackとして表示する
20. availability probe中はunsupportedと断定せず、確認中の状態を表示する

## File Touch Map (guidance)

分割を優先し、`AppleAssistWindowApp` / `useAppleAssistApplyHandler` を肥大化させない。

- UI: `src/components/appleAssist/` に conversation / diff review / composer / status 分割
- Hooks: turn 生成と proposal 適用を分離
- Features: `localAssistConversation` / `localAssistProposal`（新規）
- Helper: revision candidate action を追加（既存 generate は移行期間維持）
- Docs: 本ファイル + `v2.6-plan.md` + `assist-surface-strategy.md` のチャット境界文言

## Related

- Queue: `docs/v2.6-plan.md`, `docs/current-work.md`
- Assist boundary: `docs/assist-surface-strategy.md`
- Security: `docs/security-boundary.md`
- Later Core AI whitelist models: `docs/v2.6-plan.md` § Core AI (not this UX slice)
