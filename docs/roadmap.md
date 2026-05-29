# Roadmap

Status: Operational
Scope: Current release sequence and planning boundaries
Authority: Medium
Last reviewed: 2026-05-29

## Current Position

`hazakura-note` is no longer in the early `v0.1` planning sequence.

The current public line is:

- `v0.1.0`: source-only developer preview
- `v0.1.0-warning-expected-dmg-preview`: separate warning-expected DMG preview lane
- `v0.2.0-pre.0`: pre0.2 warning-expected DMG preview with normal-mode and Agent Workbench screenshots in README
- `v0.2.0-pre.1`: pre0.2 warning-expected DMG preview with Finder/app-icon text document open support
- `v0.2.0`: Safe Editor preview warning-expected DMG release with theme/Japanese UI polish and the current Agent Workbench boundary kept optional

The old `v0.1` / `v0.3.x` phase map is archived in `docs/roadmap-v0.1-archived.md`.

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

Candidate work:

- current-file heading outline with click-to-jump
- current heading or section context in the editor/review surface
- diff hunk heading context for Markdown files
- local Markdown link navigation limited to explicitly selected workspace files
- open-tabs and recent-files navigator
- display/readability polish for Markdown preview and review
- small Markdown editing helpers only when they are predictable, reversible, and not aggressive

This phase should prefer navigation, visibility, and manual review over prediction. Avoid strong autocomplete, automatic lint fixes, broad formatting rewrites, workspace-wide indexing, or project-level symbol search unless a later boundary review explicitly approves them.

## 0.5: Release And Maintenance Quality

Goal: make the project easier to test, maintain, and distribute honestly.

Candidate work:

- minimal CI for TypeScript build, Rust format, and Rust tests
- Dependabot or equivalent dependency visibility without auto-merge
- documented cross-machine smoke matrix
- release checklist tightening for source-only and warning-expected DMG lanes
- clearer dependency-audit triage for Tauri/wry transitive warnings
- README and release-note polish based on external tester feedback
- evaluate whether a Safe Editor-only build variant would make review and distribution easier

Notarization remains a separate future decision. Do not imply production distribution quality until Developer ID signing, hardened runtime review, notarization, stapling, Gatekeeper verification, and installation guidance are actually implemented.

## Future

Possible later work, only after a fresh boundary review:

- Developer ID signed and notarized distribution
- Markdown lint or manual formatting checks
- heading-level or paragraph-level Markdown diff
- carefully scoped Git-adjacent review helpers
- Agent Workbench reliability hardening and real-provider smoke evidence, kept as boundary maintenance rather than feature expansion

These are not approval to add a general terminal, arbitrary command execution, Git client behavior, plugin execution, auto-apply, auto-commit, or multi-agent orchestration.

## Roadmap Review Questions

Use these when asking for external review:

1. Does 0.2 clearly communicate the current value and preview limits?
2. Is Safe Editor Mode still visually and conceptually primary?
3. Does 0.3 complete the "check with diff" promise without becoming Git-aware?
4. Does 0.4 improve Markdown review/navigation without over-predicting or auto-rewriting user text?
5. Does Agent Workbench still read as a separate optional trust boundary rather than the default app mode?
