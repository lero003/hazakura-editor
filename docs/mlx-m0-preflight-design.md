# MLX M-0a Preflight Design

Status: Planning lock
Scope: OS 27 前に検証できる MLX Advanced Backend の境界準備
Authority: Medium
Last reviewed: 2026-08-29

## Decision

M-0 は二段に分ける。

- **M-0a — preflight:** Xcode 26 で検証できる System backend の共通土台と
  fail-closed な内部 wire だけを先に固定する。
- **M-0b — runtime evaluation:** C-2 の Rust-owned backend 選択が完成し、
  Xcode 27 / macOS 27 環境を用意したあとで MLX runtime を評価する。

M-0a は MLX 対応を出荷するスライスではない。MLX package、モデル、取得、
保存、選択 UI、App Store 露出を追加しない。

## Product Boundary

- Safe Editor と Markdown / text source の正本性を変えない。
- Conversation / Proposal / Diff / explicit Apply は既存経路を再利用する。
- Backend が増えても candidate generation は本文を直接変更しない。
- 推論は local-only。cloud fallback、remote code、shell、Python を実行しない。
- provider 追加 UI、任意 URL、workspace 内モデル、一般的な model launcher を
  作らない。
- M-0b の最初の評価対象は Developer / GitHub build、macOS 27+、
  Apple Silicon とする。App Store 可否は M-0b の別ゲートで判断する。

## M-0a Contract

### Helper lifetime

- Rust supervisor が常駐 helper process を所有する。
- Helper process 内で `SystemLanguageModel.default` を一度だけ保持する。
- `LanguageModelSession` は依頼ごとに作り直し、transcript は再利用しない。
- Cancel、timeout、protocol failure、app termination で helper が終了したら、
  model と session も破棄される。
- actor や `@unchecked Sendable` は足さず、immutable な process-local state に
  留める。

### Rust-owned backend wire

Generate / streaming の Rust → Swift stdin にだけ、次を追加する。

```json
{ "backend": "system_default" }
```

- Rust は M-0a では常に `system_default` を書く。
- Field が無い旧 request も `system_default` として読む。
- `coreai`、`mlx`、未知値は model call 前に `unsupported_backend` で拒否する。
- `probe_apple_assist_availability` は System 専用のまま変更しない。
- TypeScript request に backend、model id、revision、path、URL を出さない。
- MLX 用の model id / revision / folder path は M-0a では wire に予約しない。

### Compatibility

| Pair | Expected behavior |
|---|---|
| old Rust → new helper | backend 欠落を System として受理 |
| new Rust → old helper | 未知 field を無視し、既存 System generation を維持 |
| new Rust → new helper | 明示 `system_default` のみ受理 |
| direct non-System request → new helper | model call 前に fail closed |

## Explicit Non-Goals

- `MLXLanguageModel` / `MLXLLM` の import または package dependency
- Hugging Face repo ID / URL / local folder の入力
- safetensors / tokenizer / config の読込・検証
- Application Support の model directory / catalog state
- memory / RSS 見積もり、load、unload、revision pin の実装
- Preferences / companion の model 選択 UI
- `set_local_assist_backend` / backend-specific availability probe
- Core AI C-1 / C-2 の前倒し
- App Store entitlement、download disclosure、review claim の変更

## Verification

M-0a は次で閉じる。

1. Fixture helper が backend 欠落と明示 System を受理する。
2. Fixture helper が `coreai` / `mlx` / 未知値を同じ error kind で拒否する。
3. Rust supervisor が generate / streaming の両方で System だけを送る。
4. Xcode 26 で live helper の arm64 / x86_64 / universal build と probe が通る。
5. Existing candidate JSON、model id、prompt、sanitizer、Apply API が不変。
6. TypeScript と public Tauri command surface に backend が現れない。
7. Full TypeScript / Rust / Vite / App Store surface gates が通る。

## M-0b Entry Gate

M-0b は次が揃うまで始めない。

- Core AI C-2 の Rust-owned `selectedId` と backend-specific availability
- Xcode 27 / macOS 27 SDK を使う隔離された build lane
- `mlx-swift-lm` の version / revision pin と license review
- 対応 architecture / data-only model contract
- app-managed storage、manifest、revision pin、memory preflight の設計レビュー
- remote code 不実行と no cloud fallback の静的・実機確認方法

M-0b で初めて `MLXLanguageModel`、実モデル load、Developer build の非表示 UI
を検討する。M-0a の完了は MLX runtime の compile / execution proof ではない。

## Review Focus

- System model と session の寿命が混同されていないか。
- Renderer / companion が backend を注入できないか。
- 非 System 値が Foundation Models 呼出し前に拒否されるか。
- Cancel / timeout 後に helper process が再利用されていないか。
- MLX / network / model storage / App Store の実装が紛れ込んでいないか。

## Related

- `docs/core-ai-c0-design.md`
- `docs/assist-surface-strategy.md`
- `docs/current-work.md`
- `docs/roadmap.md`
- `docs/security-boundary.md`
