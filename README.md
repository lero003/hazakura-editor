<p align="center">
  <img src="src/assets/hazakura-mark.png" alt="Hazakura Editor logo" width="128">
</p>

# Hazakura Editor

Status: Operational
Scope: Project entry point
Authority: High
Last reviewed: 2026-06-23

`Hazakura Editor` は、AI時代のメモ帳です。Markdownを中心に、安全にテキストを読む・書く・比べるための軽量なローカル作業場を目指します。

万能IDEではありません。拡張機能、LSP、Gitクライアント、汎用ターミナル、任意コマンド実行を持たないことで、信頼しきれないプロジェクト内のテキストを静かに扱うことを目的にします。

> メモ帳より賢く、IDEより静か。

## Mac App Store

Hazakura Editor `0.29.1` is published on the Mac App Store:
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
- export content as standalone HTML or use Print to PDF
- use a command palette for existing safe app actions
- run bounded workspace text search without background indexing
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
7. Export to HTML or print to PDF.
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
  export, Print to PDF handoff, and initial EPUB export beta.
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

For the full implementation inventory and release state, see
[`docs/current-status.md`](docs/current-status.md).

## Project Docs

- [Documentation Index](docs/README.md): current docs and archive map
- [Product Brief](docs/product-brief.md): 何を作るか、何を作らないか
- [Security Boundary](docs/security-boundary.md): 安全性のために守る制約
- [Agent Workbench Boundary](docs/agent-workbench-boundary.md): optional CLI-agent workbench direction and responsibility boundary
- [Assist Surface Strategy](docs/assist-surface-strategy.md): future detachable assist direction, including Hazakura Local Assist / Foundation Models planning
- [Current Work](docs/current-work.md): v0.30-v1.0 Reader UX queue and post-0.29.1 release evidence
- [Hazakura Local Assist Writing Companion Plan](docs/apple-local-assist-writing-companion-plan.md): post-v0.11 Hazakura Local Assist UX direction
- [Roadmap](docs/roadmap.md): 段階的な開発順序
- [L Mode Plan](docs/l-mode-plan.md): えるモードの source-preserving WYSIWYG Accuracy Ramp plan
- [e-book Mode And EPUB Export Plan](docs/ebook-mode-epub-export-plan.md): v0.21+ e-bookモード / EPUB export planning memo
- [AI Markdown Ingest Plan](docs/ai-markdown-ingest-plan.md): explicit AI proposal intake / Diff Review planning memo
- [Native macOS Appearance Plan](docs/native-macos-appearance-plan.md): v0.25 native-feeling Safe Editor chrome planning memo
- [Post-v0.25 Product Refinement Plan](docs/post-v0.25-product-refinement-plan.md): App Store release後の完成度向上レンズ
- [External Agent Review Workflow](docs/external-agent-review-workflow.md): external implementation agent + Codex review workflow
- [Source Release Checklist](docs/source-release-checklist.md): source-only developer previewの準備境界
- [DMG Preview Checklist](docs/dmg-preview-checklist.md): warning-expected DMG preview laneの準備・検証境界
- [App Store Build](docs/app-store-build.md): Mac App Store提出用 build / signing / smoke境界

## License

Hazakura Editor本体は商用プロプライエタリソフトウェアとして扱います。第三者OSSのライセンスと出自メモは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。生成されるmacOS app bundleには、`LICENSE` と `THIRD_PARTY_NOTICES.md` が `Contents/Resources/` に同梱されます。

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
cargo audit
```

Use `npm ci` when evaluating the source preview from the committed lockfile. Use `npm install` only during active dependency updates that intentionally change `package-lock.json`.

`npm outdated` and `cargo update --manifest-path src-tauri/Cargo.toml --dry-run` are release-review checks, not automatic update requirements.

Developer preview release boundary:

- Current package/app version is `0.31.0` across npm, Tauri, Cargo, and lockfile metadata.
- The Mac App Store listing is [Hazakura Editor](https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12), published at `0.29.1` with the helper-enabled Hazakura Local Assist preview lane.
- The latest prepared GitHub source / local-app tag is [v0.29.1](https://github.com/lero003/hazakura-editor/tree/v0.29.1).
- The latest local App Store / TestFlight package candidate is `0.31.0` build `34`.
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
