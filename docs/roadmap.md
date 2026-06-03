# Roadmap

Status: Operational
Scope: Current release sequence and planning boundaries
Authority: Medium
Last reviewed: 2026-06-03 (v0.7 published, v0.8 Assist Surface separation / Claude Code CLI readiness lane / TS hook unit-test layer bring-up, v0.10+ Apple Local Assist direction, and post-v0.8 feature-folder refactor lane — `lib/tauri.ts` / `lib/locale.ts` / `tests.rs` / agent_workbench state machine / CodeMirror theme / format helpers)

## Current Position

`hazakura-note` is no longer in the early `v0.1` planning sequence.

> **Renamed at v0.6**: `hazakura-note` became **`hazakura editor`** at the v0.6 release. The name change signals the product identity as a text editor first (evoking the classic サクラエディタ heritage), rather than a note-taking app.

The current public line is:

- `v0.1.0`: source-only developer preview
- `v0.1.0-warning-expected-dmg-preview`: separate warning-expected DMG preview lane
- `v0.2.0-pre.0`: pre0.2 warning-expected DMG preview with normal-mode and Agent Workbench screenshots in README
- `v0.2.0-pre.1`: pre0.2 warning-expected DMG preview with Finder/app-icon text document open support
- `v0.2.0`: Safe Editor preview warning-expected DMG release with theme/Japanese UI polish and the current Agent Workbench boundary kept optional
- `v0.3.0`: Safe Editor non-Git diff / change-review warning-expected DMG release
- `v0.4.0`: Markdown Review Navigation warning-expected DMG release
- `v0.5.0`: Pi CLI Provider, Image Assets, and Authoring Stability warning-expected DMG release
- `v0.6.0`: Foundation Release / Daily-Drivable Safe Editor warning-expected DMG release under the `hazakura editor` identity
- `v0.7.0`: Review Desk MVP warning-expected DMG release with manual candidate review, slash command polish, and existing Change Review routing fixes

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

Future assist work is tracked by `docs/assist-surface-strategy.md`. The design goal is to keep assist features detachable from the Safe Editor so the product can later switch some workflows from External Agent Workbench to Apple Local Assist / Foundation Models-based document help without turning `hazakura editor` into a general AI platform.

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

Status: Released as `v0.5.0` warning-expected DMG preview.

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

Release checkpoint: v0.6.0 is published as a warning-expected DMG prerelease at `https://github.com/lero003/hazakura-editor/releases/tag/v0.6.0`. Version surfaces are aligned to `0.6.0`, local app/release naming uses `hazakura editor` / `hazakura-editor`, the GitHub repository moved to `lero003/hazakura-editor`, dependency audits report 0 local vulnerabilities, focused built-app smoke passed for save/export, compare/diff, tab reorder, auto-backup, Replace, and Quick Open, and remote verification passed for the published DMG/checksum assets. Keep v0.6.0 immutable; future work should continue on `main`.

Deliberately moved beyond v0.6:
- Global Search (Cmd+Shift+F)
- コマンドパレット (Cmd+Shift+P)
- Settings consolidation
- Diff / Review UI consolidation
- Review Desk entry surface
- **文字コード表示 + 別名保存で文字コード変更**: status bar encoding display + Save As dialog with encoding dropdown (UTF-8/Shift-JIS/EUC-JP). Rust `encoding_rs` conversion.
- Frontmatter display
- KaTeX beta
- Alt text 編集UI
- ペイン切替ショートカット

Do not use this phase to add SDK integration, background sessions, session restore, provider plugins, arbitrary command execution, automated approval of provider actions, zustand/Context architecture changes, Pi RPC, theme editor, KaTeX, Mermaid, tab split, or external file rename tracking.

## 0.7: Hazakura Review Desk MVP And Release Prep

Goal: ship a small, honest Review Desk MVP on top of the existing non-Git diff and recovery review foundation, while using the release-prep window to tighten structure, smoke coverage, and documentation. Keep Safe Editor Mode primary and Agent Workbench as a separate trust boundary.

Status: release-prep lane. Do not expand v0.7 into the full Review Desk UX vision unless a blocking MVP bug requires a small correction.

Delivered or in-flight foundation:

- Read-only Review Desk Readiness Gate completed and recorded in `docs/reviews/v0.7-readiness-gate.md`.
- Design decisions for the initial Review Desk state, compare-case shape, and shortcut reservation are recorded in `docs/reviews/v0.7-review-desk-design-decisions.md`.
- Visible Review Desk entry, manual candidate comparison, candidate apply-to-buffer safety checks, and slash/menu discoverability are the intended MVP surface.
- Refactor work should be limited to changes that reduce concrete Review Desk release risk or make the release gates easier to trust.

v0.7 release-prep priorities:

1. Audit the current Review Desk / Slash / Diff diff and close only blocking UX or safety bugs.
2. Keep manual candidate review explicit: compare first, show changed amount and target, then apply only by user action.
3. Confirm the Review Desk entry paths are discoverable from visible UI, native menu, shortcut, and slash command.
4. Run the source-preview quality gates and latest-HEAD built-app smoke for Safe Editor basics plus the Review Desk MVP path.
5. Update version surfaces and release notes only after the release lane is explicitly approved.
6. Avoid new feature expansion once the MVP smoke is acceptable.

Do not use v0.7 to add Global Search, Command Palette, editable two-column Review Desk, detached Agent windows, Frontmatter, KaTeX, encoding conversion, Git integration, LSP, plugin system, theme editor, project-wide indexing, arbitrary file management, Tree Rename / Delete, session log persistence, Agent auto-apply, or Agent session restore.

External-agent workflow:

- Let an implementation agent take one small v0.7 release-prep slice at a time.
- Codex should review the resulting diff before the slice is treated as accepted.
- Review focus: boundary regressions, hidden Git/terminal/command behavior, unsafe file/path handling, missing tests or smoke evidence, and docs claims that exceed implementation.

## 0.8: Assist Surface Separation And Daily Editor Polish

Status: candidate work landed 2026-06-03 (Claude Code CLI allowlist landed via 97f4249, with the same launch gate / trusted-workspace smoke path as `codex` / `opencode` / `pi`). No v0.8 candidate-work items remain open. v0.8 was not tagged / published; the v0.7 line (`v0.7.0` warning-expected DMG) is the most recent published release. The assist/agent surface separation it set up is the foundation for v0.10+ Apple Local Assist.

Goal: keep the Safe Editor pleasant for daily writing and review while preparing the assist/agent surface for future v0.10+ Apple Local Assist adoption. v0.8 is not an assist-platform release; it should separate surfaces and logic so optional assist behavior can later produce reviewed candidates without becoming the default editor experience.

Review Desk direction:

- Treat Review Desk as a small safety receiver for candidate text, not as the main workbench. Its durable job is to compare Apple Local Assist / Agent / pasted candidate output against the active buffer before the user explicitly applies it.
- Keep the current Review Desk safety model: explicit Compare, explicit Apply, no auto-save, no auto-apply, stale-preview guards, and no persistent review logs by default.
- Reduce Review Desk's default visual prominence. Keep shortcut, View menu, and slash entry points, but do not make Review Desk a primary top-chrome control unless user testing proves it belongs there.
- Do not pursue editable two-column workbench, live diff refresh, candidate temporary-document policy, or review history until the assist boundary and daily-editor basics are more settled.
- Agent output may enter Review Desk as candidate text for review, and Apple Local Assist output may do the same in v0.10+ after Foundation Models work begins. Do not route generated output directly into the editor body, and do not add Agent auto-apply.

Assist Surface design direction:

- Separate assist/agent surfaces from Safe Editor presentation and state so Safe Editor remains useful when assist features are disabled, unavailable, or removed from a build.
- Keep External Agent Workbench as its own explicit trust boundary: allowlisted providers, responsibility consent, selected workspace root, one active session, no restore, no provider-add UI, and no auto-apply.
- Treat Claude Code CLI as a candidate external CLI provider to add, not as a replacement for the current provider set. It should enter through the same allowlist / launch gate / trusted-workspace smoke path as `codex`, `opencode`, and `pi`.
- Use v0.8 to clarify shared request / candidate / review logic that a future v0.10+ Apple Local Assist helper could reuse, without implementing Foundation Models behavior yet.
- Any Apple Foundation Models path in v0.10+ should start as selected-text or document-excerpt assistance that returns candidate text to Review Desk or Diff for explicit review.
- Agent Workbench may work better as a separate window or detachable surface in a later design pass. Any separation must follow `docs/assist-surface-strategy.md` and preserve the existing trust boundary.

Candidate work:

- demote Review Desk from persistent top-chrome placement while preserving shortcut / View menu / slash access (landed)
- Assist Surface / Agent Workbench presentation separation, limited to surface boundaries and state ownership (landed via the detached Agent Window workstream and preferences extract)
- Claude Code CLI allowlist readiness: add `claude` as a candidate local CLI provider only after checking the UI/backend allowlist, provider-not-found flow, trusted-workspace smoke checklist, and docs claim boundaries; do not make it the default provider in the first slice (landed via 97f4249 — `claude` is on the implemented allowlist with the same launch gate / trusted-workspace smoke path as `codex` / `opencode` / `pi`)
- shared candidate-review request shape for future assist output, limited to selected text / active document excerpt inputs
- clearer separation between Safe Editor state, Agent Workbench state, and Review Desk candidate state (landed via the Agent Workbench preferences extract + boundary-docstring slices)
- daily-editor polish that makes the app worth opening before assist features arrive: search/replace quality, file navigation, save/recovery clarity, preview/diff readability, and keyboard comfort
- command palette for existing safe app actions only (landed 2026-06-03)
- bounded Global Search (Cmd+Shift+F) as workspace grep, not background indexing (landed 2026-06-03)
- settings consolidation so editor and Agent Workbench preferences are not scattered (verified clean — Agent Workbench is already in its own pane, editor / application sections in Preferences are already grouped)
- detached or separate-window Agent Workbench experiment, only if the trust boundary stays explicit and follows `docs/assist-surface-strategy.md` (landed; detached Agent Window is now the primary route)
- pinned / recent / starred files if they support review flow (landed 2026-06-03 as pinned start-panel files; `RecentEntry.pinnedAt` + star toggle, two-group start panel)
- Print-ready HTML export polish before native PDF export (landed 2026-06-03; print stylesheet with serif body, `@page` margins, page-break hints, mirrored across `exportPdf` and `exportHtml`)
- Markdown toolbar and writing-experience polish where it supports review

Do not require persistent review logs for the MVP. `.hazakura/reviews/` or app-managed review history needs a separate storage-policy decision.

Do not use v0.8 to add Git integration, merge editing, project-wide indexing, arbitrary command execution, Agent auto-apply, Agent auto-commit, Foundation Models-backed behavior, Claude-specific permission/MCP/argument UI, provider-add UI, or signing/notarization work.

## 0.9: Product Preview Hardening / Calm Markdown Workspace

Goal: make the product feel coherent enough for broader preview feedback before the v0.10 Apple Local Assist experiment and the v1.0 outward-preview lane. This is still a preview-quality lane, not a signed/notarized release promise.

Focus this lane on the refactoring, quality-stabilization, and daily-workspace usability work that should wait until the v0.8 UX direction has settled. Prefer changes that reduce release risk, improve startup/responsiveness, simplify large surfaces, and make the app feel worth opening for ordinary Markdown writing. Do not use this lane as a feature-expansion catch-all.

Writing experience direction:

- Move toward a calm Markdown workspace: quieter chrome, better reading rhythm, and a writing feel inspired by Typora / Notion, while keeping Markdown source as the canonical document model.
- Do not turn the editor into Notion. Block databases, collaboration, embeds-as-apps, arbitrary rich document objects, and workspace knowledge-base behavior are out of scope.
- Do not promise a full Typora-style editing model in v0.9. Inline / WYSIWYG Markdown editing, block-level document transforms, and source/preview fusion belong to a later editing-model decision if the product still needs them.
- Preserve Markdown syntax when copying. If visual rendering becomes calmer than raw Markdown, provide an explicit Copy as Markdown path or make normal copy keep Markdown tags for supported headings, code, links, tables, and image references.
- Keep Preview, Diff, Review Desk, export, and copy behavior aligned so the document reads calmly but still round-trips as Markdown.

Workspace/file-tree direction:

- Add bounded workspace file operations only where they support daily editing: New File, New Folder, Rename, and workspace-internal Move via drag/drop.
- Keep all file-tree operations inside the selected workspace root. No arbitrary path field, no move outside the workspace, no Git status coupling, and no project-wide analysis.
- Preserve open-tab safety: renames and moves must update open tab paths when safe, warn on dirty tabs or external changes, and avoid silently discarding recovery state.
- Treat overwrite, symlink, case-only rename, and cross-directory move conflicts as explicit review points, not silent operations.
- Defer Delete unless it goes through a fresh destructive-file-operation review. If Delete enters v0.9, prefer Move to Trash over permanent deletion and keep it separate from the first New/Rename/Move slice.

Candidate work:

- Calm Markdown Workspace polish: quieter editor chrome, focus/Zen writing improvements, readable editor/preview spacing, and Markdown-first copy/export behavior
- bounded file-tree operations: New File, New Folder, Rename, and workspace-internal drag/drop Move with tab-path tracking and conflict prompts
- production bundle chunk-splitting for heavy editor / preview / Agent Workbench dependencies, including a before/after build-size and startup-smoke note
- post-v0.8 component and hook boundary review for Review Desk, Diff, Agent Workbench, Markdown preview, and editor chrome
- focused performance and memory smoke for large Markdown files, Review Desk comparisons, image preview, and Agent Workbench open/close
- dependency and release-note freshness review, including known Vite chunk-size and cargo-audit warning posture
- smoke checklist consolidation so release candidates have one repeatable source-preview and built-app pass
- official icon, About surface, and first-run orientation if not finished in v0.8
- Frontmatter display for Markdown review context
- KaTeX beta only if it stays preview/export-safe and does not widen command execution
- encoding display / Save As encoding selection if it can be kept inside the existing safe text-open/save boundary
- keybinding customization and line bookmarks if they support the lightweight editor identity
- privacy policy
- first-pass product messaging for the "AI-age notepad / Safe Review Editor" positioning
- crash / log policy
- TS hook unit-test layer bring-up: extend the Vitest 4 + jsdom 29 + @testing-library/react 16 foundation (current 6 hook tests / 56 tests / 6 files covering find / diff / document / agent, ~430ms cold start) to the remaining pure-logic hooks, alongside the existing 134-test Rust `cargo test` layer. Future Tauri-touching hooks should stub the small Tauri surface they need at the call site; the Rust runtime stays covered by `cargo test --manifest-path src-tauri/Cargo.toml`. The remaining low-risk target from the 2026-06-03 bring-up is `useTabReorder` (DOM-stubbing required for `document.elementFromPoint` / `setPointerCapture` / `getBoundingClientRect`; the reorder callback itself is pure).
- `useAppShellController` 1473-line split: deferred v0.8 refactor. With the TS hook test layer now in place, the split can land alongside tests in the same slice — break the orchestrator into per-feature sub-hooks (editor shell, workspace shell, agent shell, document surface, dialog refs, app shell sync, etc.) without behavior change, mirroring the post-v0.8 `lib/tauri.ts` / `lib/locale.ts` per-feature-area split.
- Assist Surface boundary hardening: prove that Safe Editor can remain usable without assist code paths, and that any detached Agent Workbench surface still obeys the existing allowlist, consent, one-session, no-restore, and no-auto-apply gates
- Assist Surface boundary hardening only; do not run Apple Local Assist / Foundation Models product work before the v0.10 lane

Do not add Developer ID signing, notarization, installer packaging, automatic updater work, block database behavior, collaboration, broad WYSIWYG editing-model rewrites, permanent Delete, Git-aware file operations, or external-path file management in v0.9 unless the user explicitly reopens that lane.

## 0.10: Apple Local Assist Experiment

Goal: prove whether Apple Foundation Models / Apple Local Assist can generate useful document candidates without turning `hazakura editor` into an AI agent, chat app, or IDE.

Candidate work:

- Foundation Models availability detection and safe disabled-state messaging
- selected-text and document-excerpt request flow into a narrow macOS Apple Local Assist helper
- candidate text returned without applying it to the editor body
- internal request / candidate structure that can later route into Review Desk or Diff
- no network-backed fallback when Apple Local Assist is unavailable
- no background workspace indexing, generic chat, command execution, tool calling, auto-rewrite, auto-apply, or agent-style provider behavior

Do not treat v0.10 as a general AI surface. The experiment passes only if unavailable environments remain safe and boring.

## 0.11: Apple Local Assist Candidate Review

Goal: make Review Desk useful as an explicit review step for Apple Foundation Models / Apple Local Assist candidate output, after the v0.10 experiment proves the candidate source is worth keeping.

Candidate work:

- structured candidate output that routes through Review Desk or Diff before any user-visible apply
- Review Desk polish only where generated candidate review proves it is needed
- optional partial apply if the candidate-review flow proves it needs it
- no background workspace indexing, network-backed fallback, command execution, auto-rewrite, auto-apply, or agent-style tool use

Do not treat this as a general chat, coding-agent, or provider-platform lane.

## 1.0: Outward Product Preview

Goal: make the product understandable to external users. v1.0 is a messaging and preview-quality milestone, not proof that paid distribution, notarization, or updater work is finished.

Candidate work:

- landing page
- README two-layer structure: quick value first, detailed boundaries second
- screenshots and About surface polish
- first-run orientation
- official icon final pass
- privacy policy
- GitHub About / topics cleanup
- distribution story draft, explicitly separating source preview, warning-expected DMG preview, and future signed builds

## 1.x: Distribution Quality

Goal: prepare for paid or wider external distribution after Apple Developer registration and product-scope sign-off are available.

Candidate work:

- Developer ID signing
- hardened runtime review
- notarization and stapling
- installer or DMG distribution policy
- automatic updater
- distribution-grade Gatekeeper verification
- build-time distribution variants for Safe Editor only, official-site developer builds, and possible Apple Local Assist enabled builds, if the Assist Surface boundary has been reviewed

Do not move signing, notarization, or updater work earlier unless the user explicitly opens that distribution lane.

## Future

Possible later work, only after a fresh boundary review:

- Markdown lint or manual formatting checks
- heading-level or paragraph-level Markdown diff
- Pi RPC integration, only after CLI mode improvements prove insufficient
- Mermaid 図レンダリング
- テーマ自動切替（macOS appearance sync）
- タブ分割編集
- GitHub Actions .dmg 自動ビルド
- permanent Delete, multi-select file operations, and external-path file management after a fresh destructive-file-operation review
- session log persistence after storage policy is settled
- native PDF export beta
- iCloud sync, shared review, and Obsidian / Notion import
- future OS assist integrations only if they fit `docs/assist-surface-strategy.md` and do not add arbitrary command execution, broad workspace indexing, or agent auto-apply

These are not approval to add a general terminal, arbitrary command execution, Git client behavior, plugin execution, auto-apply, auto-commit, or multi-agent orchestration.

## Roadmap Review Questions

Use these when asking for external review:

1. Does 0.2 clearly communicate the current value and preview limits?
2. Is Safe Editor Mode still visually and conceptually primary?
3. Does 0.3 complete the "check with diff" promise without becoming Git-aware?
4. Does 0.4 improve Markdown review/navigation without over-predicting or auto-rewriting user text?
5. Does 0.5 add Pi as a bounded CLI provider without making Agent Workbench feel like the default app mode?
6. Does 0.6 deliver a daily-drivable safe editor — Cmd+P, auto-save, Replace, App.tsx split — before adding more Agent features?
7. Does 0.7 ship a small Review Desk MVP and release-prep pass without expanding into the larger Review Desk workbench vision?
8. Does the external-agent/Codex-review workflow catch boundary regressions before accepting implementation slices?
9. Does 0.8 separate Assist Surface concerns and improve daily Safe Editor use without pretending Review Desk is a mature workbench?
10. Does 0.9 improve calm Markdown writing and bounded workspace file operations without turning the app into Notion, a Git client, or a full WYSIWYG document editor?
11. Are signing, notarization, updater, and paid-distribution tasks kept out of the preview lane until v1.x or an explicit distribution-lane approval?
12. Does the Assist Surface strategy preserve a clean v0.10+ path to Apple Local Assist without turning Safe Editor into a generic AI platform?
13. If Claude Code CLI is added, does it remain just another allowlisted external CLI provider rather than replacing the trust boundary or adding provider-specific control surfaces?
