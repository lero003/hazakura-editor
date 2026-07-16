# AGENTS.md

Status: Canonical
Scope: Agent entry rules for this repository
Authority: High
Last reviewed: 2026-07-16

このファイルは AI / 外部エージェント向けの作業入口である。製品の現状詳細やリリース番号はここに書かず、下の正本ドキュメントを読む。

## Product

`Hazakura Editor` は macOS 向けの **Markdown-first Safe Editor** である。

- 主コピー: **Markdownで書き、本として読み、ローカルAIで整える。**
- 副コピー: メモ帳より賢く、IDEより静か。
- Markdown / テキスト source が正本。勝手に書き換えない。
- **Safe Editor が主面**。IDE・Git クライアント・汎用ターミナル・拡張基盤・プロジェクト解析器にはしない。

### Surfaces（触る前に分類する）

| Surface | 扱い |
|---|---|
| Safe Editor core | 開く・編集・保存・衝突・復元・プレビュー・Diff。既定の信頼境界。 |
| L Mode / えるモード | 読み書きの presentation。source 意味と保存内容を壊さない。 |
| Review Desk | 候補の手動確認。明示操作・低目立ちを維持。 |
| Hazakura Local Assist | オンデバイス提案。network fallback / auto-save / tool calling なし。 |
| Agent Workbench | **Developer レーン専用**の別 trust boundary。allowlist された local CLI 1 セッション。汎用シェルではない。 |
| Workspace file ops | 選択 workspace 内に閉じる。フルファイルマネージャにしない。 |
| OKF review / scaffold | 明示操作のみ。起動時スキャン・自動修正・Book Scope は入れない。 |

App Store レーンは Safe Editor 中心（Agent Workbench / 外部 CLI agent を載せない）。
Developer / GitHub レーンとの差は `docs/app-store-build.md` と `docs/assist-surface-strategy.md` を正本とする。

## Start Here

作業前に必ず:

1. `git status --short --branch` — 既存の未コミット変更はユーザー / 前エージェントの作業。勝手に戻さない。
2. 次の正本を読む（詳細は `docs/README.md`）:
   - **次の一手**: `docs/current-work.md`
   - **現状**: `docs/current-status.md` / `docs/handoff.md`
   - **方向**: `docs/roadmap.md` / `docs/product-brief.md`
   - **境界**: `docs/security-boundary.md`（必須級）
3. 触る面に応じて追加で読む:
   - Agent Workbench → `docs/agent-workbench-boundary.md`
   - Assist / Local Assist → `docs/assist-surface-strategy.md`
   - App Store / 署名 → `docs/app-store-build.md`
   - OKF → `docs/okf-spec-pin.md` と該当 design（`v1.11` / `v1.12`）
   - リリース直前 → `docs/release-pre-check.md`
4. 実質的な実装・依存変更・release・Git 操作の前は Hazakura Habitat を使う。

`docs/archive/` と発想原本（旧 `markdown-safe-editor-plan` など）は履歴。現行ルールの正本にしない。

## Working Rules

- **小さく保つ**。1 ラン = 検証可能な 1 スライス。MVP 時代の「全部やる」ではなく、現行レーンの最小改善に寄せる。
- **境界を広げない**: 任意コマンド実行、Git 操作、LSP、汎用ターミナル、拡張機能、background indexing、auto-apply / auto-commit、provider 追加 UI。
- セキュリティ・path・実行・AI 面に触るなら、先に `docs/security-boundary.md`（必要なら agent-workbench / assist 文書）。
- 既存の設計・命名・UI トーンを尊重する。不要な大規模リファクタはしない。
- 破壊的操作、依存追加、設定変更、ファイル大量削除の前に確認する。
- 公開タグ・公開アセットは immutable。タグ移動や公開物の書き換えをしない。
- ローカルパス、証明書名、Connect 固有情報を tracked docs に書かない（`docs/internal/` / `*.local.md`）。
- 改善はスクラップアンドビルドの精神でよいが、境界と正本ドキュメントは壊さない。

### Test-Driven Development

- バグ修正、純粋ロジック、path / 保存 / 実行 / AI の境界変更は、可能なら再現する**失敗テストを先に**追加し、最小修正で通してから整理する（red → green → refactor）。
- 新機能は acceptance と代表的な失敗条件を先にテストへ固定する。実装都合だけを写した brittle なテストや、snapshot の大量更新で済ませない。
- UI / IME / macOS host / 署名など test-first が現実的でない面は、無理に自動化したふりをせず、理由と代替の focused test / packaged smoke / 手動確認を報告する。
- docs のみ、機械的変更、既存挙動を変えない小修正には新規テストを強制しない。ただし下記 Verification は省略しない。

## Verification

変更の種類に応じて、**下から必要な段まで**を走らせてから完了報告する。
ホスト都合でできない段は「未実施」と明示し、通ったと書かない。

### 0. 常時（docs のみでも）

```bash
git status --short --branch
git diff --check
```

公開向け文言を触った場合の簡易衛生（ヒットは手動で判定）:

```bash
git diff --cached | grep -E "^\+.*(/Users/|/home/|/var/folders/|/tmp/[A-Za-z0-9._-]+)" | head -20
git diff --cached | grep -iE "^\+.*(api[_-]?key|secret|password|private[_-]?key|BEGIN [A-Z]+ PRIVATE)" | head -20
```

### 1. フロント / TypeScript

```bash
npm run typecheck
npm test
npm run build:vite
```

触った面に近いテストだけでもよいが、境界や共有 UI を変えたら広めに。

### 2. Rust / Tauri コマンド

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

path 検証・ファイル I/O・OKF・helper 連携を触ったら必須。

### 3. 配布レーン / App Store 面

App Store と Developer の見え方・Preferences・Command Palette・Agent 露出を触ったら:

```bash
npm run smoke:app-store-surface
```

署名・pkg・helper まで踏み込む場合は `docs/app-store-build.md` と
`docs/release-pre-check.md` に従う。upload は人間承認。

### 4. 品質セルフチェック（報告前）

コードを通したあと、次を頭で確認する（該当すればログにも書く）:

- **境界**: 任意実行・Git・LSP・汎用ターミナル・自動適用を増やしていないか
- **source 正本**: Markdown / テキストを黙って書き換えないか（L Mode / Outline / OKF 含む）
- **明示操作**: 破壊的操作・採用・ひな形作成・OKF 点検が consent 付きか
- **path**: workspace 外への読み書き、symlink 追跡、絶対パス固定がないか
- **Dirty / Undo**: 編集が dirty と Undo に正しく乗る。Read-only / Assist-lock を壊さない
- **i18n**: ユーザー向け新規文言が日本語として自然か（英語漏れ・機械訳調）
- **a11y 隣接**: キーボードで到達・Escape で閉じる・ラベルが読める（広範監査はしない）
- **ドキュメント**: 挙動や版の正本が変わったなら `current-status` / `current-work` / design の該当箇所だけ更新
- **主張の強さ**: 実装と検証範囲を超える安全・品質・公開状態の言い切りをしていないか

### 5. 手動 smoke

- 正本: `docs/smoke-checklist.md`
- UI / IME / 保存衝突 / 実機 assist は自動化の代替にしない
- 代表 fixture: `npm run smoke:fixtures:v1.10-structure` / `v1.11-okf` など（触ったレーンに合わせる）

### 6. リリース直前

`docs/release-pre-check.md`（ローカルパス・不適切内容・秘密情報・notice）。
タグ付け・公開アセット変更の詳細は `docs/source-release-checklist.md` /
`docs/dmg-preview-checklist.md` / `docs/app-store-build.md`。

コマンド詳細や自動化ループの優先順位は `docs/development-automation.md` を正本とする。

## Language And Reporting

- ユーザー向けの説明・進捗・質問・レビューは **日本語**。
- コード、API 名、型名、ファイル名、コマンド、エラーメッセージは英語のままでよい。
- コミットメッセージ / PR タイトルは、明示がなければ日本語で簡潔に。
- まず結論。実装後は **変更点 / 確認したこと / 残リスク / 次に見るべきこと** を短く。
- 不確実な点は推測で埋めず「未確認」「要確認」と書く。
- 実装していない機能や、未検証のリリース状態を「できた」「公開済み」と書かない。

## Project Notes

- 主対象は日本語ユーザー。UI / ヘルプは自然な日本語を優先。
- 専門用語は必要なら英語併記してよい。
- `@codemirror/view` は **6.43.2** に pin（不用意に上げない）。
- 現状の版数・候補・公開版の正本は `docs/current-status.md`（このファイルに版数を固定しない）。
