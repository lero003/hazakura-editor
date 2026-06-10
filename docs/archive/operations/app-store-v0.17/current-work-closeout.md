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

### Queue 3: accessibility-focused unit smoke — Complete ✅

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

## External Review Intake For v0.18 (2026-06-10)

Chika review after the v0.17 closeout mostly confirms that the v0.17
quality lane is coherent.  Treat the following as the v0.18 /
submission-prep intake, not as a reason to reopen the published v0.17
preview unless a concrete blocker is reproduced.

### Already handled before / during v0.17 publication

| Review item | Current state |
|---|---|
| Version surfaces still at `0.16.0` | Resolved for v0.17: `package.json`, Tauri config, Cargo metadata, README, About Help, and Support Diagnostics now report `0.17.0`. Future releases should still keep the one-pass version-surface checklist. |
| App Review Notes app-name drift | Partially resolved in this doc pass: this internal draft now uses `hazakura editor` in the summary. Keep Store metadata, screenshots, Help, and App Review Notes aligned during final copy. |
| App Review Notes reauthorization wording too strong | Partially resolved in this doc pass: describe the current behavior as skipping inaccessible restored paths and telling the user to use Open / Open Folder to reauthorize, unless a dedicated CTA is implemented later. |

### v0.18 implementation / verification candidates

| Priority | Item | Why it matters | Suggested next slice |
|---|---|---|---|
| P0 | WorkspaceTree rename input is rendered inside a row `<button>` | The v0.17 decision to keep the button-based model is still valid, but nested interactive controls can confuse VoiceOver, focus, click, and blur behavior. | Rework only rename rows so normal rows stay buttons, while rename state renders a non-button row containing the text input. Add focused tests and real VoiceOver / keyboard smoke. |
| P0 | App Store entitlement pipeline remains proof-only | Draft entitlements and sandbox smoke exist, but normal App Store/TestFlight signing/provisioning is not yet a completed distribution pipeline. | Define the official App Store build/signing lane and keep it separate from warning-expected DMG previews. Do not imply submitted, notarized, or App Store-ready status until verified. |
| P0 | `scripts/probe-macos-distribution.sh` checks helper `app-sandbox` instead of helper `inherit` | The helper is expected to use `com.apple.security.inherit`; the current probe can produce misleading "missing" output. | Update the read-only probe to report `helper inherit entitlement: present` for the helper and retain app sandbox checks for the app bundle. |
| P1 | TabBar / auto-backup dirty detection does not include encoding-only changes | Shared dirty logic includes `encoding`, but local helpers in tab display and auto-backup compare only contents / line endings. | Use the shared `isDirty()` helper or include `encoding !== lastSavedEncoding` in local signatures, then add an encoding-only dirty indicator test. |
| P1 | Manual accessibility smoke remains pending | Queue 3 is focused/unit coverage, not a full VoiceOver or keyboard-only audit. | Record Help readability, full keyboard-only traversal, VoiceOver tab-bar announcement, and Increase Contrast smoke before submission. |
| P1 | App Review Notes need Assist Surface lane wording | App Store lane omits CLI Agent / Agent Workbench execution surfaces, while Assist Surface may still expose Apple Local Assist / Off. | Final copy should say CLI Agent / Agent Workbench execution surfaces are omitted; Assist Surface remains only for App Store-allowed assist choices. |
| P1 | Quit / dirty-close comments drift from `app.exit(0)` implementation | The behavior is important and the stale comments point at an older `std::process::exit(0)` description. | Correct comments only; do not change behavior unless a focused test fails. |
| P1 | Source/config file associations are broad for a "not IDE" product | Opening source-like text is consistent with Safe Editor, but Store metadata should not make it look like an IDE. | Either narrow App Store file associations or explain that source-like files open as plain text only, without build, Git, LSP, terminal, or execution behavior. |
| P2 | Help / Privacy / Local Data / Support copy overlaps | The current Help pages are honest but repetitive. | Final copy pass: make Privacy Policy the public/legal copy, Local Data Disclosure the technical local-data explanation, and Support Diagnostics the diagnostic JSON explanation. |
| P2 | Third-party license packet is not final | Help acknowledgements are readable, not a complete legal packet. | Generate/review dependency license material from `package-lock.json` and `src-tauri/Cargo.lock` before public submission. |
| P2 | Vite main chunk warning remains | Not a submission blocker by itself, but it affects startup/perceived quality. | Measure first; consider lazy-splitting Help / Diagnostics / Assist surfaces only if it reduces real risk. |
| P2 | `data:image` "2 MB" wording is length-based | Current check is safe-side `src.length`, not decoded byte size. | Either rename the claim to a data-URI length cap or implement decoded-byte measurement. |

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
