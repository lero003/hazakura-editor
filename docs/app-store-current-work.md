# App Store Current Work

Status: Operational
Scope: Current App Store-facing quality work for external agents
Authority: High
Last reviewed: 2026-06-09 (queues 1–5 complete; closeout in `docs/app-store-quality-closeout.md`)

## Purpose

Use this file as the single current work queue for App Store-facing quality work.

This is not App Store Connect metadata, certificate work, notarization, upload, DMG packaging, or final legal copy.
It is the ordered implementation/review queue for proving that the App Store lane remains a Markdown-first Safe Editor.

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

## Follow-Up Candidates (NOT ordered implementation queue)

These are residual items from the closeout review.  They are not
blockers for submission and do not require an implementation agent
before a human can proceed to certificate/metadata work.

- Manual smoke: red-button close, Cmd+Q, keyboard-only tab nav,
  VoiceOver tab-bar announcement.
- `prefers-contrast: more` CSS media query (not yet implemented).
- Diagnostics UI (serialisation helper exists; no copy/view button).
- WorkspaceTree `role="tree"` pattern (current button-based tree
  is keyboard-operable).

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
