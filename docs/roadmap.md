# Roadmap

Status: Operational
Scope: Current release sequence and planning boundaries
Authority: Medium
Last reviewed: 2026-06-01 (post-v0.5 planning memo folded in; v0.6 bug-check pass)

## Current Position

`hazakura-note` is no longer in the early `v0.1` planning sequence.

> **Planned rename**: `hazakura-note` → **`hazakura editor`** at v0.6 release. The name change signals the product identity as a text editor first (evoking the classic サクラエディタ heritage), rather than a note-taking app. All docs, package names, and release assets will be updated at that boundary.

The current public line is:

- `v0.1.0`: source-only developer preview
- `v0.1.0-warning-expected-dmg-preview`: separate warning-expected DMG preview lane
- `v0.2.0-pre.0`: pre0.2 warning-expected DMG preview with normal-mode and Agent Workbench screenshots in README
- `v0.2.0-pre.1`: pre0.2 warning-expected DMG preview with Finder/app-icon text document open support
- `v0.2.0`: Safe Editor preview warning-expected DMG release with theme/Japanese UI polish and the current Agent Workbench boundary kept optional
- `v0.3.0`: Safe Editor non-Git diff / change-review warning-expected DMG release
- `v0.4.0`: Markdown Review Navigation warning-expected DMG release

The old `v0.1` / `v0.3.x` phase map is archived in `docs/roadmap-v0.1-archived.md`.

Before the next public release claims image paste, export, Zen, spellcheck, table editing, or Agent authoring improvements, reconcile the implementation against `docs/authoring-feature-readiness.md`. Several merged slices have UI or command surfaces, but not all of the product promises are complete enough to advertise honestly.

## Product Boundary

The main product remains a Markdown-first safe editor.

Default Safe Editor Mode must keep these boundaries:

- no general terminal
- no arbitrary command execution
- no Git client
- no LSP or IDE features
- no plugin system
- no project-wide indexing
- no auto-apply or auto-commit behavior

Optional Agent Workbench Mode is a separate trust boundary. It may host one allowlisted local CLI provider session in a selected workspace, but it must remain explicit, consent-gated, and scoped by `docs/agent-workbench-boundary.md`.

## 0.2: Safe Editor Preview Stabilization

Goal: make pre0.2 honest, testable on another Mac, and easy to understand from the README and GitHub Release while keeping Safe Editor Mode visually and conceptually primary.

Status: Released as `v0.2.0` warning-expected DMG preview.

Completion criteria:

- README explains the normal Safe Editor value before Agent Workbench.
- README screenshots show normal mode first and Agent Workbench second.
- Version surfaces and release notes match the shipped preview version.
- Warning-expected DMG notes clearly state ad-hoc signing, no Developer ID signing, no notarization, and expected Gatekeeper warnings or rejection.
- Release assets verify after download with `shasum -c` and `hdiutil verify`.
- At least one non-development-machine smoke result is recorded for DMG download, mount, launch, and basic editor use.
- Known risks are visible rather than hidden behind stable-release wording.

Do not use 0.2 to add broad new features.

## 0.3: Safe Editor Non-Git Diff And Review

Goal: complete the core product promise of checking text changes without turning the app into a Git client, merge tool, IDE, or project analyzer.

Status: Released as `v0.3.0` warning-expected DMG preview.

Priority work:

- diff from disk versus current editor text
- simple explicit file-to-file diff
- compare restart draft or recovery candidates before restoring
- save-conflict review before choosing Reopen / Close without saving / Keep editing
- plain-text comparison output that does not imply Git status, Git history, staging, commit, branch, or repository awareness
- minimal review UI that makes changed regions readable before richer layouts are attempted

Acceptance:

- Current buffer versus disk diff is available for a selected text file.
- Explicit file A versus file B comparison works for safe text inputs.
- Draft/recovery and save-conflict flows can show the relevant text difference before the user chooses a recovery action.
- Diff labels use file/workspace language, not Git language.
- `.git` presence is not inspected or surfaced for this feature.
- No commit, branch, staging, status, history, patch apply, or repository operation is introduced.

This phase must not pass if:

- the feature behaves like a Git client
- the app scans the whole project to infer change state
- diff output suggests the user can stage, apply, commit, pull, push, or resolve a merge
- save-conflict recovery can discard local edits without an explicit user choice

Do not add:

- Git integration
- merge editor
- project-wide index
- auto-apply
- auto-format as part of diff

## 0.4: Markdown Review Navigation

Goal: make Markdown documents easier to read, navigate, and review after the v0.3 diff foundation, while avoiding intrusive prediction or automatic rewriting.

Status: Released as `v0.4.0` warning-expected DMG preview.

Delivered:

- current-file heading outline with click-to-jump
- current heading or section context in the editor/review surface
- diff hunk heading context for Markdown files
- local Markdown link navigation limited to explicitly selected workspace files
- open-tabs keyboard navigation
- display/readability polish for Markdown preview and review
- transient current-section HUD during Markdown scrolling, based only on the current file's headings, with no workspace indexing or automatic rewriting
- small Markdown editing helpers only when they are predictable, reversible, and not aggressive

This phase should prefer navigation, visibility, and manual review over prediction. Avoid strong autocomplete, automatic lint fixes, broad formatting rewrites, workspace-wide indexing, or project-level symbol search unless a later boundary review explicitly approves them.

## 0.5: Pi CLI Provider And App Stability

Goal: add Pi as a first-class Agent Workbench CLI provider while improving app stability in small, verifiable slices.

Status: Active development lane after the `v0.4.0` warning-expected DMG preview release.

Pre-release gate:

- resolve or explicitly defer the incomplete Markdown authoring/export items in `docs/authoring-feature-readiness.md`
- do not claim image paste as complete until pasted `assets/...` references render safely in preview and HTML export
- do not claim table editing beyond "Insert table" until row/column/alignment editing exists
- do not claim Agent selection actions until a selected-text candidate and diff-review flow is designed inside the safe boundary

Delivered:

- `pi` is available as an allowlisted local CLI provider in the existing Agent Workbench UI and backend validation path
- Pi remains a local CLI provider only: no Pi RPC, SDK, provider-add UI, arbitrary provider configuration, multi-agent orchestration, auto-apply, auto-commit, general terminal, or Git client behavior

Candidate work:

- keep Pi launch behavior inside the existing Agent Workbench gate: explicit mode, restart boundary, responsibility consent, selected workspace root, one active session, no restore
- run trusted-workspace manual smoke for Pi CLI usage alongside existing `codex` / `opencode` provider checks
- record provider-not-found evidence when Pi is not installed locally, without installing or configuring it during automation
- improve app stability and responsiveness found during normal editor and Agent Workbench smoke
- keep Safe Editor Mode visually and conceptually primary while the provider list grows

Delivered after `v0.4.0`:

- Extended the GUI app search path used by `find_allowlisted_agent_provider_in_path_env` and `build_agent_provider_search_path` to cover toolchain manager install locations the previous list missed. New home-relative entries: `~/.bun/bin`, `~/.deno/bin`, `~/.volta/bin`, `~/go/bin`, `~/.local/share/pnpm`, `~/.asdf/shims`. New absolute entries: `/opt/local/bin`, `/opt/local/sbin` (MacPorts). `AgentWorkbenchPreflight` now also returns the resolved `searchedPaths` so a "Provider not found" launch gate can show the user exactly which directories were tried.
- Rust tests added: `agent_workbench_app_search_path_includes_toolchain_manager_bins`, `agent_workbench_gui_search_dirs_includes_macports_and_homebrew`, and `agent_workbench_provider_lookup_finds_toolchain_manager_bin`.

Deliberately deferred:

- **User-specified provider path override** (Agent Workbench Preferences field for the absolute path to a provider binary, bypassing the auto search). This is a Plan C follow-up: useful when the user installs a provider into a non-standard location the auto search cannot cover, but it expands the trust surface and needs an explicit "exists + executable + allowlist name matches" validation before it is added. Tracked for a later v0.7+ slice; not in the v0.6 daily-drivable scope.

Do not use this phase to add Pi SDK integration, RPC integration, arbitrary provider configuration, multi-agent orchestration, auto-apply, auto-commit, a general terminal, or a Git client.

## 0.6: Foundation Release — Daily-Drivable Safe Editor

Goal: v0.6 is not a feature-adding release. It's the release where `hazakura-note` becomes **`hazakura editor`** — an editor you can actually use every day.

> Agent で勝つより先に、Agent を安心して置けるエディタの床を固める

The core positioning remains **「安全に読める。安全に直せる。必要なときだけAIに渡せる。Markdown-first の小さな作業場。」**

The rename to `hazakura editor` also signals kinship with the classic サクラエディタ (Sakura Editor) lineage — a lightweight, Japanese-first text editor heritage. Selected Sakura Editor features (encoding display, rectangular selection, regex replace) will be adopted where they align with the safe Markdown-first identity.

v0.6 delivers (✅ = implemented):

1. **App.tsx 分割** ✅ — extracted preferences, document export, auto-backup scheduling, document save/export/backup controller hook, document export and backup integration hook, Quick Open visibility, active editor commands including Insert Table, editor tabs state hook, editor selection state hook, app feedback state hook, dialog state hook, view mode state hook, draft recovery state hook, document safety action controller hook, file opening/new-file behavior, workspace/file opening controller hook, tab/window close flow, recovery actions, compare controller hook, compare setup actions, compare execution/review callbacks, compare state hook, tab bar controller hook, tab navigation, workspace shell state hook, workspace runtime effects hook, workspace restore, workspace opening, workspace tree loading, Go to Line state/key handling, image preview state/open-close handling, editor tab and active-draft derived state, active document identity/presence hook, active document surface hook, side pane controller hook, side pane visibility, resizing, and toggles, preview scroll sync, Agent output buffering, Agent UI refresh suspension, opened files listener, window drag-drop listener, app menu action listener, native menu action bundle ref hook, native menu integration hook, app shell/menu/title/theme/workspace persistence sync hook, keyboard/focus effects hook, app runtime effects controller hook, dialog/window-close ref and dialog open-state hook, app editor ref hook, app activity listeners, window close confirmation, workspace context-menu state and dismissal, latest-value refs for App handlers/state and auto-backup state, preview cleanup, Agent output sequence cursor, active-tab external-change checks, Agent Workbench runtime state hook, active Agent session derivation, Agent Workbench session sync, Agent Workbench session lifecycle/UI callbacks, draft persistence, tab reordering, workspace tree replacement, workspace state persistence, clipboard writing, recent entries state/persistence, window title sync, native app menu state sync, theme menu state sync, localized app copy hook, editor tab utility helpers, numeric clamp helper reuse, status message localization, keyboard/IME and global shortcut guards, global keyboard shortcuts, Agent session comparison helpers, document status calculation, Markdown outline calculation, Markdown local-link resolution, localStorage persistence helpers, modal focus-trap helper, dialog initial focus, modal keyboard guard, Find/Replace state and match-count hook, Find/Replace match calculation, Find match index sync, Find/Replace actions, Find/Replace controller hook, diff calculation, top tab/document chrome shell, the tab bar view, document metadata controls, Find/Replace and recovery message shell, recovery message banners, workspace shell, workspace sidebar, editor main pane, pane resizer, right side pane, dirty-close dialogs, status bar shell, status bar, Preferences dialog shell, normal settings pane, Agent Workbench settings pane, and the Find/Replace bar view into focused hooks/components. No zustand/Context. Agent Workbench extraction remains optional follow-up because that boundary is more coupled and higher risk.
   - Follow-up slice: compare execution/review actions now live in `src/hooks/useCompareExecution.ts`; compare setup remains in `src/hooks/useCompareSetupActions.ts`.
   - Follow-up slice: save/save-as actions now live in `src/hooks/useSaveActions.ts`.
   - Follow-up slice: external-change action handling now lives in `src/hooks/useExternalChangeActions.ts`.
   - Follow-up slice: editor content-change, Markdown insert, and heading-jump actions now live in `src/hooks/useEditorCommands.ts`.
   - Follow-up slice: window/dialog actions now live in `src/hooks/useWindowDialogActions.ts`.
   - Follow-up slice: pasted-image save handling now lives in `src/hooks/usePastedImageAction.ts`.
   - Follow-up slice: Agent Workbench Preferences action handlers now live in `src/hooks/useAgentWorkbenchPreferenceActions.ts`.
   - Follow-up slice: Agent terminal interaction handlers now live in `src/hooks/useAgentTerminalActions.ts`.
   - Follow-up slice: Agent Workbench session lifecycle actions and UI callbacks now live in `src/hooks/useAgentWorkbenchSessionActions.ts`.
   - Follow-up slice: dirty-close dialogs, Quick Open, Preferences, and workspace context-menu overlay rendering now live in `src/components/AppOverlays.tsx`.
   - Follow-up slice: main workspace shell rendering now lives in `src/components/AppWorkspace.tsx`.
   - Follow-up slice: top tab/document chrome shell rendering now lives in `src/components/AppTopChrome.tsx`.
   - Follow-up slice: Find/Replace and recovery message shell rendering now lives in `src/components/AppDocumentFeedback.tsx`.
   - Follow-up slice: native menu action bundle refs now live in `src/hooks/useAppMenuActionsRef.ts`.
   - Follow-up slice: native menu action refs/listener wiring now lives in `src/hooks/useAppMenuIntegration.ts`.
   - Follow-up slice: document export actions and auto-backup scheduling now route through `src/hooks/useDocumentPersistence.ts`.
   - Follow-up slice: workspace tree loading, workspace opening, and file opening now route through `src/hooks/useWorkspaceFileOpening.ts`.
   - Follow-up slice: tab close, recovery, and external-change actions now route through `src/hooks/useDocumentSafetyActions.ts`.
   - Follow-up slice: compare setup and execution actions now route through `src/hooks/useCompareController.ts`.
   - Follow-up slice: save/save-as, export, and auto-backup wiring now route through `src/hooks/useDocumentIoController.ts`.
   - Follow-up slice: tab navigation and pointer reordering wiring now route through `src/hooks/useTabBarController.ts`.
   - Follow-up slice: localized app copy and Agent mode badge derivation now live in `src/hooks/useLocalizedAppCopy.ts`.
   - Follow-up slice: status bar localization and Agent label rendering now lives in `src/components/AppStatusBar.tsx`.
   - Follow-up slice: dialog/window-close refs and modal-open derivation now live in `src/hooks/useAppDialogRefs.ts`.
   - Follow-up slice: Find/Replace panel state and match derivation now live in `src/hooks/useFindReplaceState.ts`.
   - Follow-up slice: editor/find/preview/tabs refs now live in `src/hooks/useAppEditorRefs.ts`.
   - Follow-up slice: compare view state now lives in `src/hooks/useCompareState.ts`.
   - Follow-up slice: workspace shell state now lives in `src/hooks/useWorkspaceShellState.ts`.
   - Follow-up slice: editor selection state now lives in `src/hooks/useEditorSelectionState.ts`.
   - Follow-up slice: dialog state now lives in `src/hooks/useAppDialogState.ts`.
   - Follow-up slice: view mode state now lives in `src/hooks/useAppViewState.ts`.
   - Follow-up slice: draft recovery state now lives in `src/hooks/useDraftRecoveryState.ts`.
   - Follow-up slice: app feedback state now lives in `src/hooks/useAppFeedbackState.ts`.
   - Follow-up slice: editor tabs state now lives in `src/hooks/useEditorTabsState.ts`.
   - Follow-up slice: Agent Workbench runtime state now lives in `src/hooks/useAgentWorkbenchRuntimeState.ts`.
   - Follow-up slice: active Agent session derivation now lives in `src/hooks/useAgentWorkbenchRuntimeState.ts`.
   - Follow-up slice: active document identity derivation now lives in `src/hooks/useActiveDocumentIdentity.ts`.
   - Follow-up slice: pending close-tab dialog open-state derivation now lives in `src/hooks/useAppDialogRefs.ts`.
   - Follow-up slice: active document presence derivation now lives in `src/hooks/useActiveDocumentIdentity.ts`.
   - Follow-up slice: active document surface derivation now lives in `src/hooks/useActiveDocumentSurface.ts`.
   - Follow-up slice: side pane state/resize/toggle orchestration now lives in `src/hooks/useSidePaneController.ts`.
   - Follow-up slice: app shell/menu/title/theme/workspace persistence sync now lives in `src/hooks/useAppShellSync.ts`.
   - Follow-up slice: workspace restore/opened-files/drag-drop/context-menu effects now live in `src/hooks/useWorkspaceRuntimeEffects.ts`.
   - Follow-up slice: keyboard/focus effects now live in `src/hooks/useAppKeyboardFocusEffects.ts`.
   - Follow-up slice: Find/Replace state/actions/index sync now live in `src/hooks/useFindReplaceController.ts`.
   - Follow-up slice: app activity/session/shell/workspace/keyboard effects now route through `src/hooks/useAppRuntimeEffects.ts`.
   - Follow-up slice: Find/Replace match-count derivation now lives in `src/hooks/useFindReplaceState.ts`.
   - Follow-up slice: Insert Table command handling now lives in `src/hooks/useEditorCommands.ts`.
   - Follow-up slice: Compare review UI callbacks now live in `src/hooks/useCompareExecution.ts`.
   - Bug-check slice: duplicate pasted-image saves are regression-tested to reuse the existing hash-named `assets/<hash>.png`.
2. **Cmd+P クイックオープン** ✅ — fzf-style file name search + Enter to open.
3. **自動保存 + バックアップ** ✅ — periodic save to `.hazakura/backups/` with Draft restore recovery. Trust foundation.
4. **Replace (置換)** ✅ — Find bar gets replace input, Replace one / Replace all.
5. **Agent 差分ポーリング** ✅ — `last_seen_seq` incremental output fetching. Eliminates polling lag.
6. **選択範囲→Agent 送信** ✅ — select text in editor → Cmd+Shift+Enter sends to terminal stdin.
7. **プリセットプロンプトボタン** ✅ — [要約] [校正] [翻訳] [コードレビュー] chips above the terminal.
8. **タブのドラッグ並び替え** ✅ — Drag-and-drop tab reordering.
9. **Multi-cursor** ✅ — CodeMirror 6 built-in: Alt+click, Cmd+D.
10. **矩形選択 (Rectangular selection)** ✅ — Alt+Shift+drag.

**v0.6 progress: 10/10 items implemented.**

Release-prep checkpoint: stop additional v0.6 refactor work here unless a release-blocking bug appears. Version surfaces are aligned to `0.6.0`, local app/release naming now uses `hazakura editor` / `hazakura-editor`, the GitHub repository moved to `lero003/hazakura-editor`, the warning-expected DMG preview builds and verifies locally, dependency audits report 0 local vulnerabilities, and focused built-app smoke passed for save/export, compare/diff, tab reorder, auto-backup, Replace, and Quick Open. Before tagging, review the pushed source branch, inspect the GitHub moderate Dependabot alert reported after push, and perform release approval.

Deliberately deferred to v0.7:
- Global Search (Cmd+Shift+F)
- コマンドパレット (Cmd+Shift+P)
- ツリー Rename / Delete
- セッションログ保存
- ファイルコンテキスト自動添付
- Alt text 編集UI
- **文字コード表示 + 別名保存で文字コード変更**: status bar encoding display + Save As dialog with encoding dropdown (UTF-8/Shift-JIS/EUC-JP). Rust `encoding_rs` conversion.
- ペイン切替ショートカット

Do not use this phase to add SDK integration, background sessions, session restore, provider plugins, arbitrary command execution, automated approval of provider actions, zustand/Context architecture changes, Pi RPC, theme editor, KaTeX, Mermaid, tab split, or external file rename tracking.

## 0.7: Workspace Power Release

Goal: make the workspace experience powerful enough that users never need to leave the app for file/search operations.

Candidate work:

- Global Search (Cmd+Shift+F): workspace-wide grep via Rust
- コマンドパレット (Cmd+Shift+P): fuzzy-accessible all actions
- ツリー Rename / Delete: in-app file management
- セッションログ保存: save Agent chat as .md
- ファイルコンテキスト自動添付: auto-attach active file path to Agent messages
- Alt text 編集UI: improve image paste completeness

Do not use this phase to add Git integration, LSP, plugin system, theme editor, or project-wide indexing.

## 0.8: Writing Experience Release

Goal: refine the Markdown editing experience beyond basic functionality.

Candidate work:

- プレビュースクロール同期: scroll preview to match editor position
- Markdown スニペット展開: auto-complete blockquote, list, heading
- Markdown ツールバー拡充: heading / bold / italic / strikethrough / list / code block buttons
- Markdown UI 再配置: move document-mutating controls such as line-ending conversion out of the current preview/control row and place authoring tools in a dedicated Markdown toolbar row.
- フォーカスモード / タイプライターモード: highlight only the current line
- 書き出し品質向上: CSS polish for HTML export
- ピン留め / お気に入り: quick-access pinned files

## Future

Possible later work, only after a fresh boundary review:

- Developer ID signed and notarized distribution
- Markdown lint or manual formatting checks
- heading-level or paragraph-level Markdown diff
- Pi RPC integration, only after CLI mode improvements prove insufficient
- KaTeX 数式レンダリング
- Mermaid 図レンダリング
- テーマ自動切替（macOS appearance sync）
- タブ分割編集
- Homebrew Cask 対応
- GitHub Actions .dmg 自動ビルド
- アップデート通知

These are not approval to add a general terminal, arbitrary command execution, Git client behavior, plugin execution, auto-apply, auto-commit, or multi-agent orchestration.

## Roadmap Review Questions

Use these when asking for external review:

1. Does 0.2 clearly communicate the current value and preview limits?
2. Is Safe Editor Mode still visually and conceptually primary?
3. Does 0.3 complete the "check with diff" promise without becoming Git-aware?
4. Does 0.4 improve Markdown review/navigation without over-predicting or auto-rewriting user text?
5. Does 0.5 add Pi as a bounded CLI provider without making Agent Workbench feel like the default app mode?
6. Does 0.6 deliver a daily-drivable safe editor — Cmd+P, auto-save, Replace, App.tsx split — before adding more Agent features?
7. Does 0.7 add workspace power (Global Search, command palette, Rename) without scope creep?
8. Does 0.8 refine Markdown authoring controls without mixing preview toggles, document mutation, and workspace/IDE behavior?
