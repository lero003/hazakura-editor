# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-12 (v0.18 release prep)

## Current State

- `Hazakura Editor` is a Tauri desktop app for Markdown-first safe text editing.
- Current package/app version: `0.18.0` across npm, Tauri, Cargo, and lockfile metadata.
- Latest published downloadable preview: `v0.18.0` warning-expected DMG preview.
- `v0.18.0` is a Developer / GitHub lane preview, ad-hoc signed, not Developer ID signed, not notarized, and expected to show macOS security warnings.
- Older public tags and release assets remain immutable.
- Current active work is v0.18 follow-up polish and App Store submission prep. Use `docs/current-work.md` first.

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
- Read-only preview for user-selected local PNG/JPEG/GIF/WebP image files
  up to 20 MB, including directly opened files outside the selected
  workspace.
- Multi-tab editor with dirty-tab close protection, app/window close
  confirmation, save-conflict recovery, and explicit draft recovery.
- Normal Safe Editor mode can collapse and restore the left workspace
  sidebar without changing the file-tree model or L Mode drawer.
- Sanitized Markdown preview, local workspace image handling,
  standalone HTML export, and Print to PDF handoff.
- L Mode / えるモード as a source-preserving CodeMirror presentation
  layer, not a separate saved document model.
- Diff / explicit change review for active editor changes, recovery
  drafts, external-change conflicts, and Apple Local Assist edits.
- Optional Apple Local Assist alpha in the Developer / GitHub lane as an
  availability-gated, on-device assist surface with explicit unsaved AI
  edit transactions. The current App Store submission lane omits this
  helper and forces Assist Surface off.
- Optional Developer / GitHub lane Agent Workbench, separated from the
  App Store lane.
- Help-readable Store-document drafts and Support Diagnostics UI.

## Release Evidence

Use release notes for detailed historical evidence:

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

- `docs/current-work.md`: current v0.18 UX and submission-prep queue.
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
   manual accessibility smoke.
2. For App Store submission prep, start with `docs/current-work.md`
   and `docs/app-store-build.md`; keep account-specific notes under
   ignored `docs/internal/` files;
   keep certificate, provisioning, signing, notarization, upload, and
   review handling as explicit distribution-lane work.
3. For Apple Local Assist, use `docs/assist-surface-strategy.md`,
   `docs/apple-local-assist-distribution-plan.md`, and
   `docs/apple-local-assist-writing-companion-plan.md`; keep direct
   buffer edits as explicit AI edit transactions.
4. For future release checkpoints, use the version-specific release
   note plus the release checklists. Do not tag or publish without
   explicit approval.
