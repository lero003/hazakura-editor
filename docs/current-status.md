# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-13 (v0.20 UX planning)

## Current State

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: `0.19.0` across npm, Tauri, Cargo, and lockfile metadata.
- Latest published GitHub source / local-app release: `v0.19.0`.
- Latest published downloadable preview: `v0.18.0` warning-expected DMG preview.
- `v0.18.0` is a Developer / GitHub lane preview, ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- The helper-free App Store lane delivered `0.18.0` build `4` to
  TestFlight on 2026-06-12 with no reported Apple validation warnings;
  basic TestFlight launch / save smoke passed.
- The current App Store submission candidate is `0.19.0` with App Store
  build counter `9`; upload, App Store Connect validation, fuller
  TestFlight smoke, metadata finalization, and App Review submission
  remain separate evidence.
- Human-side App Store lane smoke on 2026-06-12 passed launch,
  basic document creation/open, preview/export, image paste/drag-drop,
  App Store surface omission, dirty-close confirmation, Move to Trash,
  and network observation. Save As UX remains an observation, workspace
  restore is acceptable with a residual Google Drive /
  quit-before-interaction risk, and live accessibility is partial before
  final App Review submission. A `Cmd+Shift+F` global-search result
  activation bug found during smoke has a focused code-level fix.
- Older public tags and release assets remain immutable.
- Current active work is v0.19 App Store submission-candidate smoke and
  submission prep. Local pre-review regression evidence is archived under
  `docs/archive/operations/`; the highest-risk remaining queue items are
  basic editor surfaces
  (open/save/close, restore/recovery, preview,
  diff/review, workspace files, standalone files, image handling,
  keyboard/IME, and error recovery). Accessibility work should stay a
  lightweight sanity pass unless a concrete issue appears. Use
  `docs/current-work.md` first.
- The v0.20 Sakura workspace ergonomics slice is implemented locally:
  the tab row has a new-file `+` entry, the main chrome can collapse /
  restore the workspace sidebar, the central editor pane shows the
  active file with path context, Markdown preview hierarchy is more
  card-like, and the selected workspace file has Sakura-specific
  accenting. Workspace switching dropdowns remain deferred to preserve
  the simple single-workspace model.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal,
  arbitrary command execution, plugin system, project-wide indexing,
  auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted
  `codex`, `opencode`, `pi`, or `claude` provider session in the
  selected workspace after restart-required enablement and
  responsibility-boundary consent.
- Manual Review Desk entry points are hidden for the current App
  Store-oriented surface. Diff, recovery review, and Apple Local Assist
  edit review remain explicit, unsaved, and inspectable.
- Workspace file operations are bounded to the selected workspace.
  Workspace-internal drag/drop Move remains experimental; New File, New
  Folder, Rename, and Move to Trash are the dependable file-tree
  operations.

## Implemented Surface Summary

- Safe open/edit/save for Markdown and text files, including LF / CRLF,
  final-newline, UTF-8 BOM, Shift-JIS, and EUC-JP handling.
- The sandbox-oriented direct save fallback preserves the normal atomic
  save path, and when direct write / sync fails after a partial write it
  attempts to restore the original bytes before reporting failure.
- Read-only preview for user-selected local PNG/JPEG/GIF/WebP image files
  up to 20 MB, including directly opened files outside the selected
  workspace.
- Clipboard image paste now rejects decoded PNG/JPEG/GIF/WebP payloads
  above the same 20 MB image boundary before allocating the decoded
  buffer; drag/drop image import keeps the existing 20 MB file-size cap.
- Multi-tab editor with dirty-tab close protection, app/window close
  confirmation, save-conflict recovery, and explicit draft recovery.
- Normal Safe Editor chrome now exposes a tab-row new-file button and a
  main-chrome workspace sidebar toggle, both routed through the existing
  file creation and sidebar collapse flows.
- Auto-backup snapshots for a workspace file remain distinct even when
  multiple backups are captured in the same second; filenames include
  millisecond precision with a bounded collision suffix, and recovery
  listing stays newest-first.
- Normal Safe Editor mode can collapse and restore the left workspace
  sidebar without changing the file-tree model or L Mode drawer.
- The normal-mode status bar avoids duplicating the active `UTF-8` /
  `LF`-style format values in the passive detail when the trailing
  encoding and line-ending dropdowns already expose them.
- The misleading file-level Recent Files surface is removed from the
  start panel and native File menu. Legacy file-recent localStorage is
  cleared, while Recent Folders and explicit Open / Open Folder remain.
- The macOS About panel inherits canonical Tauri bundle metadata:
  publisher `Hazakura Lab` and
  `Copyright (c) 2026 Hazakura Lab. All rights reserved.`.
- Sanitized Markdown preview, local workspace image handling,
  standalone HTML export, and Print to PDF handoff.
- Markdown preview and Help document links keep supported
  workspace-relative text files inside the app, but route explicit
  `http:` / `https:` / `mailto:` / `tel:` clicks to the OS default
  browser/app without navigating the main WebView.
- L Mode / えるモード as a source-preserving CodeMirror presentation
  layer, not a separate saved document model.
- Diff / explicit change review for active editor changes, recovery
  drafts, external-change conflicts, and Apple Local Assist edits.
- Optional Apple Local Assist alpha in the Developer / GitHub lane as an
  availability-gated, on-device assist surface with explicit unsaved AI
  edit transactions. The current App Store submission lane omits this
  helper, forces Assist Surface off, and hides command-palette assist /
  agent settings entries.
- Optional Developer / GitHub lane Agent Workbench, separated from the
  App Store lane.
- Help-readable Store-document drafts and Support Diagnostics UI.

## Release Evidence

Use release notes for detailed historical evidence:

- `docs/releases/0.19.0-source-tag.release.md`
- `docs/releases/0.18.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.17.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.16.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.15.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.14.0-source-tag.release.md`
- `docs/releases/0.13.0-source-tag.release.md`
- `docs/releases/0.12.0-source-tag.release.md`

For future releases, use:

- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/release-pre-check.md`
- `docs/smoke-checklist.md`

The detailed v0.17 App Store-quality queue, closeout, performance
baseline, and smoke evidence are archived under
`docs/archive/operations/app-store-v0.17/`.

## Active Planning Sources

- `docs/current-work.md`: current v0.19 App Store submission-candidate queue.
- `docs/roadmap.md`: phase order and future boundaries.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/security-boundary.md`: safe editor constraints.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/l-mode-plan.md`: L Mode source-preserving writing-surface direction.
- `docs/assist-surface-strategy.md`: assist-surface direction.
- `docs/apple-local-assist-distribution-plan.md`: Apple Local Assist and lane planning.
- `docs/apple-local-assist-writing-companion-plan.md`: Apple Local Assist companion UX direction.
- `docs/app-store-build.md`: public-safe App Store build/signing boundary.

## Next Safe Actions

1. For UX work, start with `docs/current-work.md` and pick one item:
   the v0.20 Sakura workspace ergonomics slice, one core Safe Editor
   quality probe, light accessibility sanity adjacent to that surface, or
   the next open slice named there.
2. For App Store submission prep, start with `docs/current-work.md`
   and `docs/app-store-build.md`; keep account-specific notes under
   ignored `docs/internal/` files;
   keep certificate, provisioning, signing, notarization, upload, fuller
   TestFlight smoke, and review handling as explicit distribution-lane
   work.
3. For Apple Local Assist, use `docs/assist-surface-strategy.md`,
   `docs/apple-local-assist-distribution-plan.md`, and
   `docs/apple-local-assist-writing-companion-plan.md`; keep direct
   buffer edits as explicit AI edit transactions.
4. For future release checkpoints, use the version-specific release
   note plus the release checklists. Do not tag or publish without
   explicit approval.
