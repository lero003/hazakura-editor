# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-05 (v0.11.0 release candidate prepared)

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current published preview is `v0.10.0` at `https://github.com/lero003/hazakura-editor/releases/tag/v0.10.0`.
- Current release-candidate version is `0.11.0` across npm, Tauri, Cargo, and Cargo.lock metadata.
- v0.11.0 is the **L Mode WYSIWYG-tier Polish** candidate: it keeps Markdown source canonical while rendering inline emphasis, strong, strike, links, inline code, task checkboxes, horizontal rules, tables, blockquotes, code blocks, ordered/bullet lists, and images as a document-like writing surface through CodeMirror display decoration.
- The v0.11.0 candidate also includes auto-backup restore through an explicit backup-vs-buffer diff/apply flow, hash-based pasted-image deduplication, export CSS parity with Preview, workspace path rekey hardening, common text-extension save filters, and a native View menu L Mode toggle.
- Local v0.10.0 gates and warning-expected DMG preview generation passed on 2026-06-04. DMG SHA-256: `a3dcbb5a2580639ae70060d1fe85d81ed298e33ffcfa7fe0498686faffadec05`.
- GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
- v0.11.0 local release gates and warning-expected DMG preview verification passed on 2026-06-05. DMG SHA-256: `09194d22ed6a61164fbf72b7a1b17301e530bca289f42a104d3bb6c4305767e8`.
- v0.11.0 focused manual smoke for L Mode entry/source preservation, View menu L Mode toggling, long-document keyboard and user-operated trackpad/mouse-wheel scrolling, action-rail workspace/diff escape hatches, typewriter preference visibility, Export HTML, Print to PDF handoff, and auto-backup restore apply/save behavior passed on 2026-06-05. Publication approval and remote asset verification remain pending. Do not tag or publish until explicit user approval is complete.
- Older public tags remain immutable.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal, arbitrary command execution, plugin system, project-wide indexing, auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted `codex`, `opencode`, `pi`, or `claude` provider session in the selected workspace after restart-required enablement and responsibility-boundary consent.
- Review Desk remains manual candidate review: compare explicitly, apply explicitly, and never auto-save candidate output.
- Workspace file operations are bounded to the selected workspace. Workspace-internal drag/drop Move remains experimental; New File, New Folder, Rename, and Move to Trash are the dependable file-tree operations.

## Release Readiness

Use these documents for release evidence and future release decisions:

- `docs/releases/0.10.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.11.0-warning-expected-dmg-preview.release.md`
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The published v0.10.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

The prepared v0.11.0 release body is a warning-expected DMG preview draft with local verification evidence, including focused built-app manual smoke for L Mode, action-rail escape hatches, export/print, and auto-backup restore. Publication and remote asset verification remain pending explicit approval.

For future releases, re-check local artifact evidence and, after publication, re-download GitHub Release assets into a fresh temp directory and verify checksum, `hdiutil verify`, mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.

## Active Planning Sources

- `README.md`: public entry point and current user-facing feature/limit summary.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/roadmap.md`: current release sequence and future phase boundaries.
- `docs/l-mode-plan.md`: v0.11 L Mode WYSIWYG-tier planning memo.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/assist-surface-strategy.md`: future assist-surface direction.
- `docs/authoring-feature-readiness.md`: incomplete authoring/export claims that should not be overstated.

Historical detailed status logs through 2026-06-04 were archived to `docs/archive/status/current-status-through-2026-06-04.md`.

## Next Safe Actions

1. If continuing quality work, use `docs/development-automation.md` and keep to one small verified slice.
2. If preparing v0.11.0 publication, use `docs/releases/0.11.0-warning-expected-dmg-preview.release.md`, `docs/source-release-checklist.md`, and `docs/dmg-preview-checklist.md`; do not tag or publish without explicit approval.
3. If planning assist work after v0.11.0, use `docs/assist-surface-strategy.md` and keep assist output detachable from Safe Editor.
4. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
