# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-04 (v0.10.0 published; L Mode v0.11 polish in flight)

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current published preview is `v0.10.0` at `https://github.com/lero003/hazakura-editor/releases/tag/v0.10.0`.
- Current package/app version is `0.10.0` across npm, Tauri, Cargo, and Cargo.lock metadata.
- v0.10.0 is the **L Mode Alpha Preview**: a follow-up to v0.9.0 that keeps Markdown source canonical while polishing L Mode scroll/focus behavior, source-marker suppression/reveal, reference-link marker handling, code-block readability, floating chrome, and theme-aware status display.
- Active v0.11 design work: **L Mode WYSIWYG-tier polish** — magazine-feel typography (strong heading jump rate, distinctive H1/H2/H3, serif body, generous line-height), block-element treatments (pull-quote, soft code, table with bold header, task checkboxes, HR), inline rendering (emphasis / strong / strike / link as the document), and layout stability (no horizontal shift on cursor move). The source model stays Markdown; the visual target moves from "presentation layer" to "custom writing-app feel that goes beyond dedicated WYSIWYG editors." See `docs/l-mode-plan.md` for the updated direction.
- Local v0.10.0 gates and warning-expected DMG preview generation passed on 2026-06-04. DMG SHA-256: `a3dcbb5a2580639ae70060d1fe85d81ed298e33ffcfa7fe0498686faffadec05`.
- GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
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
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The published v0.10.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

For future releases, re-check local artifact evidence and, after publication, re-download GitHub Release assets into a fresh temp directory and verify checksum, `hdiutil verify`, mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.

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

1. If continuing quality work, use `docs/development-automation.md` and keep to one small verified slice.
2. If planning v0.11 assist work, use `docs/assist-surface-strategy.md` and keep assist output detachable from Safe Editor.
3. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
