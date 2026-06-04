# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-04 (v0.10.0 release-candidate docs cleanup)

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current published preview is `v0.9.0` at `https://github.com/lero003/hazakura-editor/releases/tag/v0.9.0`.
- Current release-candidate version is `0.10.0` across npm, Tauri, Cargo, and Cargo.lock metadata.
- v0.10.0 is intended as the **L Mode Alpha Preview**: a follow-up to v0.9.0 that keeps Markdown source canonical while polishing L Mode scroll/focus behavior, source-marker suppression/reveal, reference-link marker handling, code-block readability, floating chrome, and theme-aware status display.
- Local v0.10.0 gates and warning-expected DMG preview generation passed on 2026-06-04. DMG SHA-256: `a3dcbb5a2580639ae70060d1fe85d81ed298e33ffcfa7fe0498686faffadec05`.
- Tag creation and GitHub Release publication remain pending explicit user approval.
- Older public tags remain immutable.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal, arbitrary command execution, plugin system, project-wide indexing, auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted `codex`, `opencode`, `pi`, or `claude` provider session in the selected workspace after restart-required enablement and responsibility-boundary consent.
- Review Desk remains manual candidate review: compare explicitly, apply explicitly, and never auto-save candidate output.
- Workspace file operations are bounded to the selected workspace. Workspace-internal drag/drop Move remains experimental; New File, New Folder, Rename, and Move to Trash are the dependable file-tree operations.

## Release Readiness

Use these documents for the current release decision:

- `docs/releases/0.10.0-warning-expected-dmg-preview.release.md`
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The v0.10.0 release lane is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

Before publishing, re-check the local artifact evidence and, after publication, re-download GitHub Release assets into a fresh temp directory and verify checksum, `hdiutil verify`, mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.

## Active Planning Sources

- `README.md`: public entry point and current user-facing feature/limit summary.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/roadmap.md`: current release sequence and future phase boundaries.
- `docs/l-mode-plan.md`: v0.9/v0.10 L Mode planning memo.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/assist-surface-strategy.md`: future assist-surface direction.
- `docs/authoring-feature-readiness.md`: incomplete authoring/export claims that should not be overstated.

Historical detailed status logs through 2026-06-04 were archived to `docs/archive/status/current-status-through-2026-06-04.md`.

## Next Safe Actions

1. If releasing v0.10.0, use `hazakura-note-release-candidate` and complete the tag / GitHub Release / remote verification loop only after explicit approval.
2. If continuing quality work, use `docs/development-automation.md` and keep to one small verified slice.
3. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
