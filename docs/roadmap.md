# Roadmap

Status: Operational
Scope: Active release lane and future planning boundaries
Authority: Medium
Last reviewed: 2026-06-06 (post-v0.13 L Mode WYSIWYG Accuracy Ramp)

## Current Position

`hazakura editor` is a Markdown-first safe editor. It is not an IDE, Git client, general terminal, plugin platform, or automatic agent-apply system.

Current release state:

- Latest published preview: `v0.11.0` warning-expected DMG preview.
- Latest source / local-app tag: `v0.13.0`.
- Current package/app version: `0.13.0`.
- v0.13.0 theme: **Distribution Probe / L Mode Bridge**.
- Active lane: v0.14 L Mode WYSIWYG Accuracy Ramp.
- Active product polish direction: make L Mode credible as a source-preserving WYSIWYG writing surface, not just a focus-mode presentation layer.

Historical phase details and old milestone text are archived in `docs/archive/roadmaps/roadmap-through-v0.10-doc-refactor.md` and `docs/archive/roadmaps/roadmap-v0.1-archived.md`.

## Product Boundary

These boundaries stay active across roadmap changes:

- Safe Editor remains the primary product surface.
- Markdown/text source remains canonical.
- Default Safe Editor Mode has no general terminal, arbitrary command execution, Git client, LSP, plugin system, project-wide indexing, auto-apply, or auto-commit behavior.
- Agent Workbench is a separate trust boundary: explicit, consent-gated, allowlisted providers only, selected workspace root only, one active session, no restore, no auto-apply.
- Manual Review Desk entry points are hidden for the current App Store-oriented surface. Diff, recovery review, and Apple Local Assist edit review remain explicit, unsaved, and inspectable.
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

## Tagged Lane: v0.12 Apple Local Assist Alpha

Goal: ship Apple Local Assist / Foundation Models-based document help as an alpha source / local-app checkpoint, without turning Safe Editor into a general AI platform.

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

- `v0.12`: Apple Local Assist live local preview, availability plumbing, rough requests, L Mode smoke, AI edit transaction, and alpha / experimental labeling.
- `v0.13`: Distribution Probe / L Mode Bridge, including App Store build separation, sandbox / entitlement draft, helper sidecar sandbox proof, lane split, and L Mode peer-mode polish.
- `v0.14`: L Mode WYSIWYG Accuracy Ramp, including rendering fidelity, editing stability, IME / caret behavior, hidden-marker regression fixtures, and visual-overlap checks.
- `v0.15`: Store Review Prep, including metadata, review notes, final TestFlight smoke, and submission readiness.
- `v1.0`: App Store Candidate / Review if the App Store build can omit External Agent Workbench cleanly and Apple Local Assist remains document-assist only.

v0.12 tag state (source / local-app tag only):

- Apple Local Assist has moved to a live local preview, backed by a bundled Swift helper when Apple Foundation Models is available on the current Mac.
- The feature remains alpha / experimental, unavailable-safe, no-network-fallback, no-auto-save, and bounded to explicit AI edit transactions.
- Safe Editor behavior does not depend on Apple Local Assist availability.
- No App Store sandbox / TestFlight packaging change has been made.
- No Developer ID signing / notarization lane has been completed for the bundled helper.
- `v0.12.0` is a source / local-app tag. No GitHub Release, DMG asset, or App Store submission exists for this live helper state.

The next implementation work should prioritize built-app smoke, prompt quality, unavailable / disabled states, and distribution readiness. Do not broaden Apple Local Assist into network fallback, generic chat, tool calling, workspace indexing, or external-agent replacement.

## Tagged Lane: v0.13 Distribution Probe / L Mode Bridge

Goal: prove the App Store / Developer-GitHub lane shape and bring L Mode closer to being a peer writing mode, without claiming App Store readiness or WYSIWYG completion.

Current evidence:

- `npm run build` builds the App Store preview / normal lane.
- `npm run build:macos-lanes` also produces a separate Developer / GitHub lane bundle named `hazakura editor Dev.app` with bundle identifier `lab.hazakura.note.dev`.
- `npm run build:dmg-preview` packages the Dev lane bundle for the warning-expected GitHub preview lane.
- The App Store preview lane hides or omits Agent Workbench settings, menu, command-palette, IPC, and `agent.html` entry points.
- Draft sandbox entitlements exist for the app and Apple Local Assist helper.
- Ad-hoc sandbox signing verifies, and the real sandboxed Tauri parent can spawn the inherited-sandbox Apple Local Assist helper for an availability probe.
- L Mode now has a temporary workspace drawer, local floating dirty-buffer review, clearer `編集モード` switching, normal-mode `えるモード` routing, stronger dark diff contrast, Typewriter-mode access, and fixes for active list markers and Setext-style divider rendering.

Boundaries:

- No GitHub Release or DMG asset is published for `v0.13.0`.
- No App Store, TestFlight, Developer ID signing, notarization, updater, or installer claim is made.
- Apple Developer / App Store signing, provisioning, upload validation, and review behavior remain future proof.
- L Mode WYSIWYG accuracy is improved only enough to establish direction; the deeper editing/rendering pass moves to `v0.14`.

## App Store Publication Roadmap

This is an internal roadmap for moving from the current Apple Local Assist preview to App Store review. It is not user-facing release copy.

### 1. Completed Distribution Probe

Goal: prove the App Store lane can exist before investing more in app polish.

- Inspect current bundle signing, entitlements, helper signing, and Gatekeeper state.
- Design an App Store build that omits External Agent Workbench and all CLI launch paths.
- Draft sandbox entitlements and avoid temporary exceptions unless evidence proves a need.
- Verify whether the bundled Apple Local Assist helper can run under sandbox assumptions.
- Keep the Developer / GitHub lane distinct and do not imply it is App Store-ready.

Current probe memo: `docs/v0.13-distribution-probe.md`.

### 2. L Mode WYSIWYG Accuracy Ramp

Goal: make L Mode stable enough for ordinary Markdown writing and correction.

- Treat L Mode WYSIWYG accuracy as the main app-quality brush-up track. The goal is higher-fidelity rendering and editing behavior for headings, inline marks, links, lists, tasks, HRs, Setext-style underlines, blockquotes, code blocks, tables, images, Japanese prose, IME composition, caret movement, and selection/copy behavior, while Markdown source remains canonical.
- Use `docs/l-mode-plan.md` as the planning source for this work. Prefer source-preserving CodeMirror decoration, widget, CSS, and editing-behavior fixes over any Preview DOM, `contenteditable`, HTML-document-model, or save-time auto-formatting approach.
- Smoke the built app with normal editor, L Mode, Diff / explicit change review, export / print, and Apple Local Assist.
- Polish Apple Local Assist with real lightweight Japanese writing examples: short summaries, rephrasing, heading / tag ideas, light cleanup, and short explanations.
- Verify unavailable, disabled, unsupported-language, and unsupported-device states without blocking Safe Editor.
- Keep every AI-written change explicit, unsaved, diff-reviewable, and discardable.
- Fix only high-confidence daily-use polish; do not add major new feature surfaces before review prep.

L Mode WYSIWYG Accuracy Ramp acceptance:

- Common Markdown writing can stay in L Mode without switching back to normal mode for small corrections.
- Moving the cursor does not remove bullets, ordered numbers, dividers, or other visible structure.
- Typing near hidden / replaced markers does not make nearby document structure disappear.
- IME and Japanese prose remain stable.
- Source text remains predictable and byte-preserving except for explicit user edits.

### 3. Official Distribution Prep

Goal: prepare the two binary lanes without creating a third official free build.

- App Store build: remove / omit External Agent Workbench and all CLI launch paths from the reviewable build.
- Developer / GitHub build: keep Agent Workbench separate and plan Developer ID signing / notarization for broader outside-App-Store sharing.
- Prepare Apple Developer account, bundle identifiers, signing certificates, provisioning profiles, app sandbox entitlements, hardened runtime, and helper signing assumptions.
- Decide whether `minimumSystemVersion` stays editor-wide `11.0` with Apple Local Assist availability-gated, or whether a separate App Store build policy is needed.
- Confirm the bundled Apple Local Assist helper works under the App Store sandbox or replace the helper shape before submission.

### 4. Store Review Prep

Goal: assemble a clean App Store review package.

- Create the App Store Connect app record, metadata, screenshots, icon, category, age rating, support URL, privacy policy URL, and release notes.
- Prepare concise review notes: Markdown/text editor, user-selected file access, Apple Local Assist is optional/on-device/availability-gated, AI edits are explicit and unsaved, and the App Store build has no Agent Workbench or arbitrary command execution.
- Add in-app disclosure for Apple Local Assist acceptable-use / output-responsibility expectations.
- Run TestFlight packaging and internal smoke before App Review submission.
- Align `README.md`, `docs/current-status.md`, release notes, and smoke checklist with the exact submitted build.

### 5. Review And Post-review

Goal: handle App Review without disturbing the Developer / GitHub lane.

- Submit the App Store build and track review feedback separately from developer-preview work.
- If review requests changes, patch only the App Store build surface or documentation needed for review unless a true product bug is found.
- After approval, update public docs from future-tense to published-state wording and keep historical preview release notes intact.
- Keep Developer / GitHub builds distinct; do not imply Agent Workbench is part of the App Store build.
- Record any review constraints that should become durable roadmap or boundary rules.

## Continuing Backlog

Use these current docs rather than old roadmap bodies:

- `docs/authoring-feature-readiness.md` for incomplete authoring/export claims.
- `docs/l-mode-plan.md` for the L Mode WYSIWYG Accuracy Ramp and source-preserving writing-surface work.
- `docs/apple-local-assist-distribution-plan.md` for Apple Local Assist and App Store / developer-build release lanes.
- `docs/agent-workbench-boundary.md` for Agent Workbench constraints.
- `docs/development-automation.md` for small quality-loop work.

## Release And Distribution Boundary

Current preview releases are warning-expected DMG previews unless the user opens a different lane.

The intended stable distribution shape is two public binary lanes:

- App Store build: Safe Editor + L Mode + Diff / explicit change review + Apple Local Assist, without External Agent Workbench or CLI launch.
- Developer / GitHub build: the same base plus optional Agent Workbench for allowlisted local CLI providers.

An official site may explain the product and route users to those lanes, but should not create a separate official free binary by default.

- Source-preview release rules: `docs/source-release-checklist.md`
- Warning-expected DMG rules: `docs/dmg-preview-checklist.md`
- Release-note evidence: `docs/releases/`

Developer ID signing, notarization, updater work, installer packaging, and stable distribution are future distribution-lane work.
