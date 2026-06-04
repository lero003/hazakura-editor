# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-04 (v0.10.0 published)

## Current Position

`hazakura editor` is a Markdown-first safe editor. It is not an IDE, Git client, general terminal, plugin platform, or automatic agent-apply system.

Current release state:

- Latest published preview: `v0.10.0` warning-expected DMG preview.
- v0.10.0 theme: **L Mode Alpha Preview**.
- No active release candidate is open yet after v0.10.0 publication.
- Next planning lane: v0.11 Assist Planning / Apple Local Assist Exploration.

Historical phase details and old milestone text are archived in `docs/archive/roadmaps/roadmap-through-v0.10-doc-refactor.md` and `docs/archive/roadmaps/roadmap-v0.1-archived.md`.

## Product Boundary

These boundaries stay active across roadmap changes:

- Safe Editor remains the primary product surface.
- Markdown/text source remains canonical.
- Default Safe Editor Mode has no general terminal, arbitrary command execution, Git client, LSP, plugin system, project-wide indexing, auto-apply, or auto-commit behavior.
- Agent Workbench is a separate trust boundary: explicit, consent-gated, allowlisted providers only, selected workspace root only, one active session, no restore, no auto-apply.
- Review Desk is manual candidate review: compare explicitly, apply explicitly, save explicitly.
- Workspace file operations stay bounded to the selected workspace and must not become a full file manager.

## Published Lane: v0.10 L Mode Alpha Preview

Goal: ship a credible alpha of えるモード / L Mode without changing the saved Markdown model.

In scope:

- L Mode readability, scroll, keyboard focus, source-marker suppression/reveal, link-marker handling, code-block readability, floating chrome, and theme-aware status display.
- Release docs, version-surface checks, warning-expected DMG preview verification, and remote verification after publication.
- Small release-candidate polish that protects the current shipped feature claims.

Out of scope:

- WYSIWYG editing.
- Preview DOM editing.
- AI generation or automatic formatting inside L Mode.
- Apple Local Assist implementation.
- New Agent Workbench capability.
- Git, terminal, LSP, plugin, or broad workspace-analysis behavior.

Publication result:

- Local release gates passed.
- The warning-expected DMG preview was verified locally.
- Release notes clearly state ad-hoc signing, no Developer ID signing, no notarization, and expected Gatekeeper warnings.
- GitHub Release assets were re-downloaded and verified from a fresh temp directory after publication.

## Next Lane: v0.11 Assist Planning / Apple Local Assist Exploration

Goal: decide whether Apple Local Assist / Foundation Models-based document help belongs in the product, without turning Safe Editor into a general AI platform.

Current planning source:

- `docs/assist-surface-strategy.md`

Rules:

- Keep assist features detachable from Safe Editor.
- Prefer selected text or document-fragment suggestions.
- Route candidate output through Review Desk or Diff before applying.
- Do not add arbitrary command execution, broad workspace indexing, provider plugins, auto-apply, or agent orchestration.

## Continuing Backlog

Use these current docs rather than old roadmap bodies:

- `docs/authoring-feature-readiness.md` for incomplete authoring/export claims.
- `docs/l-mode-plan.md` for L Mode background and follow-up polish.
- `docs/agent-workbench-boundary.md` for Agent Workbench constraints.
- `docs/development-automation.md` for small quality-loop work.

## Release And Distribution Boundary

Current preview releases are warning-expected DMG previews unless the user opens a different lane.

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging, and stable distribution are future distribution-lane work.
