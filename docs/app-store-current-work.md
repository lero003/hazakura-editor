# App Store Current Work

Status: Closeout
Scope: Completed App Store-facing quality work and v0.18 deferrals
Authority: High
Last reviewed: 2026-06-10 (v0.17 follow-up implementation closed; optional Assist feedback slice documented)

## Purpose

Use this file as the closeout record for completed App Store-facing
quality work and as the handoff point for v0.18 / submission-prep
deferrals.

This is not App Store Connect metadata, certificate work, notarization, upload, DMG packaging, or final legal copy.
It records the completed implementation/review queue that proved the
App Store lane remains a Markdown-first Safe Editor.

For detailed request background, use `docs/app-store-quality-agent-requests.md` as the packet catalog.
For queue 1–5 evidence summary, see `docs/app-store-quality-closeout.md`.
For historical planning and older implementation records, use `docs/archive/` only when current docs do not answer the question.

## Already Covered

Do not reopen these unless a regression is found:

- `app-store-quality: sandbox-file-restore`
- `app-store-quality: app-store-agent-omission`
- `app-store-quality: privacy-local-data`
- `app-store-quality: review-notes-draft`

Current App Review explanation draft:

- `docs/app-store-review-notes-draft.md`

## Required Reading For Every External Agent

- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/current-status.md`
- `docs/roadmap.md`
- `docs/development-automation.md`
- `docs/external-agent-review-workflow.md`
- `docs/security-boundary.md`
- `docs/agent-workbench-boundary.md`
- `docs/app-store-current-work.md`
- `docs/app-store-quality-agent-requests.md`

## Global Rules

- Pick exactly one item from the ordered queue.
- Preserve Safe Editor as the primary product surface.
- Keep Markdown/text source canonical.
- Keep Agent Workbench out of the App Store lane.
- Do not add Git, LSP, terminal, plugin, arbitrary command execution, project indexing, auto-apply, or auto-commit behavior.
- Do not change dependencies or lockfiles without explicit approval.
- Update docs only when implementation truth changes.
- Report skipped smoke honestly.
- Do not claim App Store signed, submitted, reviewed, approved, TestFlight-ready, notarized, or production-ready status.

## Queue Completion Status (2026-06-09)

All five ordered queues are **complete**. The evidence summary,
verification snapshot, and residual risk triage are in
`docs/app-store-quality-closeout.md`.

### Queue 1: save-restore-regression — Complete ✅

Slices 1.1–1.5.  See closeout doc.

### Queue 2: markdown-preview-export-security — Complete ✅

Slices 2.1–2.3.  See closeout doc.

### Queue 3: accessibility-smoke — Complete ✅

Slices 3.1–3.3.  See closeout doc.

### Queue 4: support-diagnostics — Complete ✅

Single slice.  See closeout doc.

### Queue 5: performance-bundle-baseline — Complete ✅

Single slice.  See closeout doc.

## v0.17 Follow-Up Implementation Closeout

The three v0.17 follow-up requests are complete or closed by recorded
decision:

- `v0.17:a11y-prefers-contrast` — implemented as a CSS-only
  `prefers-contrast: more` pass.
- `v0.17:diagnostics-ui` — implemented as a Help-menu Support
  Diagnostics pane with copy / refresh UI.
- `v0.17:workspace-tree-role-audit` — closed by decision: keep the
  current button-based model for v0.17 and pin its behaviour with
  focused tests.  See `docs/workspace-tree-accessibility-decision.md`.

`docs/v0.17-external-agent-requests.md` is now a historical request
packet for this closeout, not the source of a new open implementation
queue.

## Optional v0.17 Release-Candidate Polish

One narrow Apple Local Assist polish slice may be attempted before the
v0.17 tag if the user wants more alpha smokeability:

- `v0.17:apple-local-assist-operation-feedback`

Use `docs/v0.17-apple-local-assist-operation-feedback-request.md` as
the request packet.  This is not a new App Store quality queue and does
not reopen the completed v0.17 external-agent request packet.  The
slice must stay inside the existing Assist Window, show only
window-local app-known lifecycle feedback, and avoid raw Foundation
Models transcripts, hidden prompts, responses, model reasoning,
persistence, diagnostics export, or any new automation capability.

## Deferred To v0.18 / Submission Prep

These are intentionally not part of the v0.17 implementation closeout:

- Remaining real-app smoke: Help document readability, full
  keyboard-only traversal, VoiceOver tab-bar announcement, and
  Increase Contrast visual smoke.
- Help document content polish: reduce overlap between Local Data
  Disclosure, Privacy Policy, Support Diagnostics, About, and Open
  Source Acknowledgements.
- Store submission materials: final public Privacy Policy URL,
  App Store metadata copy, screenshots, App Review Notes final copy,
  complete third-party license packet review, category / age rating /
  support URL / keywords.
- Official distribution work: Apple Developer account / certificates,
  provisioning, App Store signing, notarization decisions, upload,
  TestFlight, and review handling.

## Explicitly Out Of Scope

- App Store Connect metadata entry.
- Screenshots.
- Certificate / provisioning work.
- App Store upload.
- Developer ID signing.
- Notarization.
- DMG creation.
- Updater implementation.
- GitHub release automation.
- Public legal Privacy Policy finalization.
