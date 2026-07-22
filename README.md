<p align="center">
  <img src="src/assets/hazakura-mark.png" alt="Hazakura Editor logo" width="128">
</p>

# Hazakura Editor

Status: Operational
Scope: Project entry point
Authority: High
Last reviewed: 2026-07-22 (tree 2.3.0 candidate; store + source tag 2.0.0)

`Hazakura Editor` は、Markdownで文章を書き、電子書籍のように読み返し、必要な部分だけをローカルAIと整えられるmacOS向け執筆エディタです。

> Markdownで書き、本として読み、ローカルAIで整える。

万能IDEではありません。拡張機能、LSP、Gitクライアント、汎用ターミナル、任意コマンド実行を持たないことで、信頼しきれないプロジェクト内のテキストを静かに扱うことを目的にします。

> メモ帳より賢く、IDEより静か。

## Write, Read, Refine, Export

- **書く**: Markdown sourceを正本に、通常編集とL Modeで静かに書く。
- **読む**: Preview、電子書籍モード、見開き表示で本として読み返す。
- **整える**: 対応MacではHazakura Local Assistの提案をDiffで確認し、採用または破棄する。
- **届ける**: 明示的な操作でHTML、PDF、EPUBへ書き出す。

Local Assistは利用可能なMac上のオンデバイスモデルを使うプレビュー機能です。外部AIへのnetwork fallback、background rewriting、auto-save、tool calling、workspace-wide indexingは行いません。提案は保存前に差分を確認できます。

## Mac App Store

Hazakura Editor `2.0.0` is published on the Mac App Store:
[Hazakura Editor](https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12).

The App Store build is the Safe Editor lane. It omits Agent Workbench,
CLI Agent launch, external AI/API calls, and arbitrary command execution
surfaces. Hazakura Local Assist is exposed as a preview on-device writing
companion where Apple Foundation Models is available, with no network
fallback, auto-save, tool calling, or workspace-wide indexing.

## Preview

![Hazakura Editor L Mode writing surface](docs/images/v0.11-l-mode.png)

![Hazakura Editor Safe Editor with Markdown preview](docs/images/v0.11-safe-editor-preview.png)

![Hazakura Editor diff comparison](docs/images/v0.11-diff-compare.png)

## Developer Preview Summary

Use this when you want to:

- open a selected project folder without running it
- read and edit Markdown or text files
- preview selected local PNG/JPEG/GIF/WebP image files without importing them
- preview sanitized Markdown with local image asset rendering
- preserve LF / CRLF and final-newline behavior
- compare text files and review local changes without Git awareness
- notice save conflicts and external changes before overwriting
- paste or drag-drop images into `assets/` for inline Markdown references
- export the current Markdown file or an explicit Book Scope as PDF / EPUB,
  with an optional explicitly selected EPUB cover image and standalone HTML
  remaining current-file only
- use a command palette for existing safe app actions
- run bounded workspace text search without background indexing
- explicitly select, order, and revisit a small Book Scope of Markdown chapters
  from the existing sidebar without creating a manifest or scanning in background
- use えるモード / L Mode as a WYSIWYG-tier one-pane writing surface with magazine-feel typography, where Markdown source remains the truth
- write in L Mode with reduced decoration churn, steadier Typewriter / IME behavior, keyboard-toggleable task checkboxes, and pinned visual-overlap / screen-print fallback checks
- review and explicitly apply auto-backup snapshots to the active document buffer without auto-saving
- create new workspace files and folders, rename workspace entries, and move entries to Trash from bounded in-app file-tree actions
- optional detached Agent Window with `codex` / `opencode` / `pi` / `claude` provider sessions

Do not use the Developer / GitHub preview as:

- an IDE
- a terminal
- a Git client
- a trusted or notarized macOS distribution
- a safe wrapper around arbitrary AI or CLI behavior

Example use case:

1. Open a project folder you do not want to execute.
2. Read README, docs, or notes through the file tree.
3. Edit a Markdown or text file, with optional image paste / drag-drop.
4. Preview sanitized Markdown including local asset images.
5. Compare files or review local changes before deciding what to keep.
6. Apply reviewed recovery or assist changes only by explicit action, then save only when you are ready.
7. Export to HTML or PDF.
8. Use another tool for Git, terminal, build, test, or commit.

## Current Decision

- Product direction: Markdown-first safe text editor
- Primary platform direction: Desktop app
- Preferred initial stack: Tauri + CodeMirror 6 + React
- Repository remote: `https://github.com/lero003/hazakura-editor.git`.
- Current prototype: Tauri + React + CodeMirror 6で、Markdownを開く・編集する・保存する・プレビューする・複数タブで扱う最小体験を実装済み
- Optional mode: Agent Workbench は明示的に有効化した場合だけ使える開発者モード的な境界で、Safe Editor Mode とは別の trust boundary として扱います

## Current Features

Hazakura Editor currently focuses on these surfaces:

- Markdown/text creation, open, multi-tab edit, safe save, Save As, restore,
  conflict handling, CRLF/final-newline preservation, and bounded legacy
  Japanese text decoding.
- Sanitized Markdown preview, local workspace image rendering, safe image
  paste/drag-drop into `assets/`, read-only image preview, standalone HTML
  export, direct PDF export, and initial EPUB export.
- Workspace folder browsing with lazy bounded trees, recent workspace/tab
  restoration, in-file search, current-file outline, Go to Line, and explicit
  non-Git Diff / Review for file, disk, draft, conflict, recovery, and AI edit
  transaction comparisons.
- L Mode / えるモード as a source-preserving one-pane writing surface, with
  quieter typography, Typewriter/IME hardening, task checkbox affordances, and
  the same image-safety boundary as Preview.
- Native macOS menus, Preferences, theme and editor display settings,
  dirty-close protection, keyboard/focus guards, and localized Japanese-first
  UI copy.
- Assist surfaces: Hazakura Local Assist review/transaction flows may be exposed
  in the App Store lane as on-device writing assistance. Optional Agent
  Workbench with one allowlisted provider session remains Developer /
  GitHub-only.
- Import Assist (v1.6): open a user-selected PDF or image and create an
  unsaved on-device Markdown draft via PDFKit / Vision, with no cloud OCR and
  no auto-save.
- Book Scope Alpha (v2 source): explicitly selected Markdown chapters in an
  app-private per-workspace document/group tree, same-group ordering,
  unavailable-entry recheck, navigation through the existing single active
  editor buffer, whole-book reading, and explicit PDF / EPUB export with
  bounded preflight. Shared manifests and automatic background indexing are not
  part of this slice.
- Whole-book Reader search (v2.1 candidate): search the already loaded bounded
  chapter set, including live unsaved tab buffers, then jump from matching
  chapter counts without creating a persistent or background index.

For the full implementation inventory and release state, see
[`docs/current-status.md`](docs/current-status.md).

## Project Docs

- [Documentation Index](docs/README.md): current docs and archive map
- [Product Brief](docs/product-brief.md): 何を作るか、何を作らないか
- [Security Boundary](docs/security-boundary.md): 安全性のために守る制約
- [Agent Workbench Boundary](docs/agent-workbench-boundary.md): optional CLI-agent workbench direction and responsibility boundary
- [Assist Surface Strategy](docs/assist-surface-strategy.md): future detachable assist direction, including Hazakura Local Assist / Foundation Models planning
- [Current Work](docs/current-work.md): v2 Book Scope candidate proof + ship-polish queue
- [Roadmap](docs/roadmap.md): current phase boundaries and future direction
- [v1.8+ Product Review / v2 Bridge](docs/v1.8-plus-product-review-roadmap.md): accepted v1.9, v1.10, v1.11, and v2 sequencing
- [v1.10 Single-document Structure Design](docs/v1.10-single-document-structure-design.md): completed shared structure, advisory, and bounded edit contract
- [OKF Spec Pin](docs/okf-spec-pin.md): shared OKF pin and upgrade co-update checklist
- [v1.11 OKF Draft Preview Design](docs/v1.11-okf-draft-preview-design.md): held OKF v0.1 Draft compatibility and distribution-confidence contract
- [v1.12 OKF Scaffold Design](docs/v1.12-okf-scaffold-design.md): OKF starter scaffold (minimal + book-like)
- [v1.11 App Store Release Notes](docs/releases/1.11.0-app-store-release-notes.md): TestFlight candidate copy and product boundary
- [v1.6 App Store Release Notes](docs/releases/1.6.0-app-store-release-notes.md): published Import Assist release
- [v1.7 App Store Release Notes](docs/releases/1.7.0-app-store-release-notes.md): published Reference Compare + trust hardening release
- [v1.12 App Store Release Notes](docs/releases/1.12.0-app-store-release-notes.md): published OKF scaffold + structure / OKF review line
- [v1.13 App Store Release Notes](docs/releases/1.13.0-app-store-release-notes.md): published interaction clarity + bounded media line
- [v2.0 App Store Release Notes](docs/releases/2.0.0-app-store-release-notes.md): published Book Scope + Help line
- [v2.3 App Store Release Notes](docs/releases/2.3.0-app-store-release-notes.md): local Book UX candidate (recipe + resume); manual TestFlight gate pending
- [v2.1 App Store Release Notes](docs/releases/2.1.0-app-store-release-notes.md): historical whole-book search candidate notes
- [v2.0 Source Tag Notes](docs/releases/2.0.0-source-tag.release.md): source-only `v2.0.0` checkpoint
- [v1.14 Source Tag Notes](docs/releases/1.14.0-source-tag.release.md): source-only `v1.14.0` checkpoint
- [v1.14 App Store Release Notes](docs/releases/1.14.0-app-store-release-notes.md): intermediate Continuity / Trust Keep box
- [v1.8 App Store Release Notes](docs/releases/1.8.0-app-store-release-notes.md): historical Daily Trust Completion release
- [L Mode Plan](docs/l-mode-plan.md): えるモードの source-preserving WYSIWYG Accuracy Ramp plan
- [e-book Mode And EPUB Export Plan](docs/ebook-mode-epub-export-plan.md): v0.21+ e-bookモード / EPUB export planning memo
- [External Agent Review Workflow](docs/external-agent-review-workflow.md): external implementation agent + Codex review workflow
- [Source Release Checklist](docs/source-release-checklist.md): source-only developer previewの準備境界
- [DMG Preview Checklist](docs/dmg-preview-checklist.md): warning-expected DMG preview laneの準備・検証境界
- [App Store Build](docs/app-store-build.md): Mac App Store提出用 build / signing / smoke境界
- [v1 App Store Listing Copy](docs/releases/1.0.0-app-store-listing-copy.md): App Store説明、更新文、スクリーンショット順の確定稿

## License

Hazakura Editor本体は source-available proprietary software として扱います。ソースコードとリポジトリ資料は、個人の非商用利用・評価・開発目的に限り、閲覧、fork、clone、build、ローカル実行できます。再配布、改変版・fork・バイナリ・installerの配布、商用利用、別ストアやpackage registryでの公開は許諾していません。

Mac App Storeで配布される公式buildは、別途Custom EULAが示されない限り、Apple Standard Licensed Application End User License Agreementに従います。第三者OSSのライセンスと出自メモは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。生成されるmacOS app bundleには、`LICENSE` と `THIRD_PARTY_NOTICES.md` が `Contents/Resources/` に同梱されます。

## Run

```bash
npm ci
npm run dev
```

Build a launchable local macOS smoke bundle:

```bash
npm ci
npm run build
```

The built app is generated at:

```txt
src-tauri/target/release/bundle/macos/Hazakura Editor.app
```

This local bundle uses the App Store preview shape, including the bundled
Hazakura Local Assist helper, but skips
App Store sandbox entitlements so it can launch for development smoke.
Use `npm run build:app-store-submit` for the signed App Store submission
lane and `npm run smoke:macos-sandbox-preview` for the local sandbox
entitlement probe.

Build a warning-expected local DMG preview only after that release lane is explicitly approved:

```bash
npm ci
npm run build:dmg-preview
```

The DMG preview requires a local `Developer ID Application` signing
identity and remains not notarized, so macOS security warnings can still
appear. Set `HAZAKURA_DEVELOPER_ID_IDENTITY` if more than one Developer
ID Application identity is installed.

Inspect generated build artifacts without deleting them:

```bash
npm run clean:generated
```

Remove ignored generated artifacts such as `src-tauri/target`,
`src-helpers/apple-assist/.build`, `dist`, `src-tauri/gen`, and `binaries`
only when you intentionally want to reclaim local disk space:

```bash
npm run clean:generated:apply
```

To inspect or remove only the Rust / Tauri `target` tree, pass
`-- --target-only`.

Release-readiness gates for the source preview:

```bash
npm ci
npm run build:vite
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
git diff --check
npm audit
cargo audit --file src-tauri/Cargo.lock
```

Use `npm ci` when evaluating the source preview from the committed lockfile. Use `npm install` only during active dependency updates that intentionally change `package-lock.json`.

`npm outdated` and `cargo update --manifest-path src-tauri/Cargo.toml --dry-run` are release-review checks, not automatic update requirements.

Developer preview release boundary:

- Current package/app version in the development tree is `2.3.0` across npm, Tauri, and Cargo metadata. The latest GitHub source / local-app tag remains [v2.0.0](https://github.com/lero003/hazakura-editor/tree/v2.0.0) (no binary assets on the tag).
- The Mac App Store listing is [Hazakura Editor](https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12). The published App Store version is `2.0.0` (user-reported 2026-07-21); do not reopen a published store lane without a reproduced hotfix.
- Release notes: [2.3.0 local candidate](docs/releases/2.3.0-app-store-release-notes.md), [2.1.0 historical candidate](docs/releases/2.1.0-app-store-release-notes.md), [2.0.0 published App Store notes](docs/releases/2.0.0-app-store-release-notes.md), and [2.0.0 source tag](docs/releases/2.0.0-source-tag.release.md). No `v2.3.0` tag or publication is claimed.
- The latest local App Store / TestFlight package candidate metadata lives in `docs/internal/app-store-candidates/latest.json`; tracked docs do not pin its build number or package hash.
- The current warning-expected DMG preview tag is `v0.20.0`; its release-note evidence lives in [0.20.0 Warning-expected DMG Preview](docs/releases/0.20.0-warning-expected-dmg-preview.release.md).
- Source users build locally with `npm ci` and `npm run build`.
- The generated local smoke `.app` declares macOS 26.0 or later, matching the Rust binary's minimum deployment target, and is ad-hoc signed for local build validation. The App Store submission lane can include Hazakura Local Assist as an on-device writing companion, but does not include Agent Workbench, CLI Agent, arbitrary command execution, or external AI/API calls. Developer / GitHub builds may still include Agent Workbench. GitHub Release DMG previews require Developer ID Application signing but are not notarized until the separate notarization lane is completed.
- The latest published warning-expected DMG preview is [v0.20.0](https://github.com/lero003/hazakura-editor/releases/tag/v0.20.0). The v0.20.0 release notes live in [0.20.0 Warning-expected DMG Preview](docs/releases/0.20.0-warning-expected-dmg-preview.release.md).

## Known Limits

- Unsaved draft restore is explicit and fingerprint-bound; it is not autosave and does not merge with changed disk content.
- The file tree is a workspace browser, not an index. Very large directories are capped per folder and may show only the first visible entries.
- Image preview is intentionally bounded to user-selected local PNG/JPEG/GIF/WebP files up to 20 MB.
- Save conflicts are recoverable by reviewing changes, reopening, closing, or keeping local edits, and text comparison remains file/workspace based, but there is no merge editor, advanced diff, or Git status view.
- The standalone Review Desk screen is retired from the current App Store-oriented surface. Diff, recovery review, and Hazakura Local Assist review remain explicit and do not replace Git/merge workflows.
- The default local smoke app is not signed or notarized with an Apple Developer ID. GitHub Release DMG previews can be Developer ID signed, but are still not notarized unless a separate notarization pass is completed.
- Agent Workbench is optional and explicit. It does not provide a general shell prompt, arbitrary command input UI, arbitrary path input UI, provider-add UI, multiple sessions, session restore, auto-apply, auto-commit, or Git integration.
- Hazakura Local Assist is a preview surface, not the main AI feature. Live generation depends on Apple Foundation Models availability on the current Mac; output quality may vary, and the feature may change or be removed.
- Hazakura Local Assist is intended for lightweight local writing assistance only: proofreading, natural rewriting, shortening, summaries, translation, next-writing ideas, and section review. It is not a replacement for External Agent Workbench, external AI agents, local LLM runtimes, code review, multi-file understanding, long-document restructuring, autonomous agent work, factual verification, or advanced reasoning.
- Hazakura Local Assist presets insert visible, editable request text. Generated results remain explicit, unsaved, and diff-reviewable before the user saves.
- Hazakura Local Assist has no network fallback, background rewriting, auto-save, tool calling, or workspace-wide indexing. In the App Store lane it remains a narrow on-device writing companion and must fail gracefully when Apple Foundation Models is unavailable.
- CLI provider internals are outside hazakura's safety boundary. What happens inside `codex`, `opencode`, `pi`, or `claude` depends on the provider and the user's choices.
- Agent Workbench does not expose a shell prompt, arbitrary command field, arbitrary path field, or general terminal.
- Outside Agent Workbench there is no Git integration, LSP, terminal, AI assistance, plugin system, arbitrary command execution, or project-wide analysis.
- Workspace-internal drag/drop Move exists as an experimental file-tree affordance, but it is not the recommended release workflow yet; use New File, New Folder, Rename, and Move to Trash as the dependable bounded workspace operations.
- The production bundle currently carries a Vite chunk-size warning from editor/preview dependencies; planned chunk-splitting belongs to a future product-preview hardening lane.
