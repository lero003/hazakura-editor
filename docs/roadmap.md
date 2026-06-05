# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-05 (v0.11.0 published)

## Current Position

`hazakura editor` is a Markdown-first safe editor. It is not an IDE, Git client, general terminal, plugin platform, or automatic agent-apply system.

Current release state:

- Latest published preview: `v0.11.0` warning-expected DMG preview.
- Current package/app version: `0.11.0`.
- v0.11.0 theme: **L Mode WYSIWYG-tier Polish**.
- Active lane: post-v0.11 follow-up and v0.12 Apple Local Assist / distribution planning.

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

Out of scope (as scoped at v0.10 publication):

- Visual / structural WYSIWYG table editing, Mermaid / math / image-layout editing, save-time auto-formatting.
- Direct Preview DOM editing of the active document.
- AI generation or automatic formatting inside L Mode.
- Apple Local Assist implementation.
- New Agent Workbench capability.
- Git, terminal, LSP, plugin, or broad workspace-analysis behavior.

The v0.10 framing treated the visual as a "presentation layer, not WYSIWYG." v0.11+ refines that aspiration: L Mode should look and feel like a custom WYSIWYG writing app, while the source model stays Markdown and editing stays inside CodeMirror. See `docs/l-mode-plan.md` for the updated direction.

Publication result:

- Local release gates passed.
- The warning-expected DMG preview was verified locally.
- Release notes clearly state ad-hoc signing, no Developer ID signing, no notarization, and expected Gatekeeper warnings.
- GitHub Release assets were re-downloaded and verified from a fresh temp directory after publication.

## Published Lane: v0.11 L Mode WYSIWYG-tier Polish

Goal: ship えるモード / L Mode as a custom WYSIWYG-tier writing surface while keeping Markdown source canonical and editing inside CodeMirror.

In scope:

- Magazine-feel typography: strong heading jump rate (H1 ≈ 2.2em, H2 ≈ 1.6em, H3 ≈ 1.25em), centered H1, distinctive H2/H3, serif body, generous line-height.
- Block element treatments: pull-quote blockquote, soft code block, table with bold header row, task checkbox glyphs, HR as a divider.
- Inline rendering: emphasis / strong / strike / link rendered as the document (no visible markers).
- Layout stability: no horizontal shift when the cursor moves; soft focus dimming without reflow.
- L Mode action-rail escape hatches and View menu toggle.
- Auto-backup restore through explicit backup-vs-buffer diff/apply, without auto-save.
- Export CSS parity with Preview, hash-based pasted-image deduplication, and path rekey hardening needed to keep the authoring surface credible.
- Release docs, version-surface checks, warning-expected DMG preview verification, and remote verification after publication.

Out of scope:

- Direct Preview DOM editing or `contenteditable` substitution.
- Structural visual table / Mermaid / math / image-layout editing.
- AI generation or save-time auto-formatting inside L Mode.
- Apple Local Assist implementation (this lane stays separate).
- New Agent Workbench capability.

Publication result:

- Version surfaces are aligned to `0.11.0`.
- Release body: `docs/releases/0.11.0-warning-expected-dmg-preview.release.md`.
- Local gates, launch smoke, focused L Mode / auto-backup restore manual smoke, DMG checksum/image checks, mounted-app metadata, and local codesign checks passed on 2026-06-05.
- GitHub Release `v0.11.0` was published as a warning-expected DMG prerelease, and remote assets were re-downloaded and verified from a fresh temp directory after publication.

## Next Lane: v0.12 Apple Local Assist Planning

Goal: decide whether Apple Local Assist / Foundation Models-based document help belongs in the product, without turning Safe Editor into a general AI platform.

Current planning source:

- `docs/assist-surface-strategy.md`
- `docs/apple-local-assist-distribution-plan.md`
- `docs/apple-local-assist-writing-companion-plan.md`
- `docs/apple-local-assist-v0.12-design-review.md`

Rules:

- Keep assist features detachable from Safe Editor.
- Treat Apple Local Assist as an external Writing Companion / Assist Window, not as a CLI-agent provider.
- Agent Window and Apple Local Assist should normally replace each other in the outside companion slot, not appear together.
- Make the experience work with L Mode and rough writing requests, not only precise selected-text operations.
- AI may update the unsaved editor buffer only as an explicit AI edit transaction with Diff / change-history review and no auto-save.
- Do not add arbitrary command execution, broad workspace indexing, provider plugins, auto-apply, or agent orchestration.
- Separate App Store build decisions from the existing developer / warning-expected DMG preview lane.

Likely phase shape:

- `v0.12`: Apple Local Assist Writing Companion mock, availability plumbing, rough requests, L Mode smoke, and AI edit transaction.
- `v0.13`: Assist Preview, adding live Foundation Models binding and broader proofreading / continuation only if v0.12 is stable.
- `v0.14`: Distribution Hardening, including App Store build separation, sandbox / entitlement checks, TestFlight packaging, and App Review notes.
- `v1.0`: App Store Candidate if the App Store build can omit External Agent Workbench cleanly.

v0.12 in-flight slice progress (no release, no distribution-config change):

- Slice 1 — `src/lib/tauri/appleAssist.ts` + `src-tauri/src/commands/apple_assist.rs` define types, gates, and stubs.
- Slice 2 — `useAppleAssistAvailability` hook + per-mount probe + 3-language locale.
- Slice 3 — `useAppleAssistCandidate` hands generated text to the existing Review Desk `runCandidateCompare` (no auto-apply).
- Slice 4 — Two command palette entries gated on availability (`Summarize selection`, `Rephrase selection`).
- Slice 5 — `src-helpers/apple-assist/` SwiftPM helper builds in `FIXTURE_MODE`; `npm run build:apple-assist-helper:fixture` writes `binaries/hazakura-apple-assist-helper-<rust-triple>` and smoke-tests the JSON-over-stdio wire protocol. Live Foundation Models binding is stubbed (`unsupported` / `deferred`) pending an Apple-Silicon end-to-end check, and `tauri.conf.json` has not been changed.

These slices are now foundation plumbing. The next implementation request should review this work against the Writing Companion direction before adding more selected-text command-palette behavior.

## Continuing Backlog

Use these current docs rather than old roadmap bodies:

- `docs/authoring-feature-readiness.md` for incomplete authoring/export claims.
- `docs/l-mode-plan.md` for L Mode background and follow-up polish.
- `docs/apple-local-assist-distribution-plan.md` for Apple Local Assist and App Store / developer-build release lanes.
- `docs/agent-workbench-boundary.md` for Agent Workbench constraints.
- `docs/development-automation.md` for small quality-loop work.

## Release And Distribution Boundary

Current preview releases are warning-expected DMG previews unless the user opens a different lane.

The intended stable distribution shape is two public binary lanes:

- App Store build: Safe Editor + L Mode + Review Desk / Diff + Apple Local Assist, without External Agent Workbench or CLI launch.
- Developer / GitHub build: the same base plus optional Agent Workbench for allowlisted local CLI providers.

An official site may explain the product and route users to those lanes, but should not create a separate official free binary by default.

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging, and stable distribution are future distribution-lane work.
