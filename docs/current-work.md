# Current Work

Status: Operational
Scope: Active v0.18 UX polish and submission-prep routing
Authority: High
Last reviewed: 2026-06-10

## Purpose

Start here when choosing the next small `hazakura editor` slice.
This file is the current work queue.  Older v0.17 App Store-quality
request packets and closeout evidence now live under
`docs/archive/operations/app-store-v0.17/`.

Keep every slice small, verifiable, and inside the Markdown-first Safe
Editor boundary.

## Product Boundary

- Safe Editor remains primary.
- Markdown/text source remains canonical.
- Do not add Git, LSP, terminal, arbitrary command execution, plugins,
  project-wide indexing, auto-apply, or auto-commit.
- Workspace file operations stay bounded to the selected workspace.
- Agent Workbench remains a separate, explicit Developer / GitHub lane
  trust boundary and is not part of the App Store lane.

## Active UX Queue

Pick one item at a time.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | Markdown preview task checkboxes | `- [ ]` and `- [x]` render as task checkboxes in Preview, not as plain list text. Keep saved Markdown unchanged. Add or update focused preview tests and smoke checklist coverage. |
| P0 | Left workspace sidebar collapse | Normal mode gets a reversible collapse / restore affordance for the left workspace sidebar. It must not broaden the file-tree model, hide the only restore path, or conflict with L Mode's temporary workspace drawer. |
| P1 | WorkspaceTree rename row markup | Rename state should avoid rendering a text `<input>` inside a row `<button>`. Normal rows may stay button-based. Keep rename Enter / Escape / blur behavior and add focused tests. Historical context: `docs/archive/reviews/workspace-tree-accessibility-decision-v0.17.md`. |
| P1 | Encoding-only dirty indication | Tab dirty state and auto-backup dirty detection should include encoding-only changes, matching shared editor dirty logic. |
| P1 | Manual accessibility smoke | Record Help readability, full keyboard-only traversal, VoiceOver tab-bar announcement, and Increase Contrast smoke before submission. |
| P2 | Help copy overlap cleanup | Separate Privacy Policy, Local Data Disclosure, Support Diagnostics, About, and Open Source Acknowledgements so each page has one job. |
| P2 | `data:image` size wording | Align implementation and docs: either call the check a data-URI length cap or measure decoded image bytes. |

## Submission-Prep Queue

These are not ordinary UX polish and may require human account,
certificate, or App Store Connect access.

| Priority | Slice | Acceptance |
|---|---|---|
| P0 | App Store entitlement / signing lane | Define the official helper-free App Store build/signing path. Do not claim App Store-ready, notarized, submitted, or approved status until verified. |
| P0 | Distribution probe helper entitlement wording | `scripts/probe-macos-distribution.sh` should check the helper for `com.apple.security.inherit`, while the app bundle check remains `com.apple.security.app-sandbox`. |
| P1 | App Review Notes final copy | Keep private draft notes under ignored `docs/internal/`; public docs should only carry generic review boundaries and say CLI Agent / Agent Workbench execution surfaces are omitted from the App Store lane. |
| P1 | Public Privacy Policy URL / metadata | Finalize public Privacy Policy URL, support URL, category, keywords, screenshots, age rating, and App Store metadata. |
| P1 | Third-party license packet | Generate or review the complete lockfile-derived license packet before public submission. Help acknowledgements alone are not the final legal packet. |
| P2 | Bundle-size follow-up | Measure first. Split Help / Diagnostics / Assist chunks only if it reduces real startup or review risk. |

## Where To Look

- Current implementation truth: `docs/current-status.md`
- Phase order and boundaries: `docs/roadmap.md`
- Product and safety boundaries: `docs/product-brief.md`,
  `docs/security-boundary.md`, `docs/agent-workbench-boundary.md`
- Manual smoke: `docs/smoke-checklist.md`
- Release gates: `docs/source-release-checklist.md`,
  `docs/dmg-preview-checklist.md`, `docs/release-pre-check.md`
- Private App Review draft: ignored `docs/internal/` files only
- Historical v0.17 App Store-quality work:
  `docs/archive/operations/app-store-v0.17/`

## Do Not Use As Current

- `docs/archive/operations/app-store-v0.17/quality-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/external-agent-requests.md`
- `docs/archive/operations/app-store-v0.17/current-work-closeout.md`

Those files are retained as evidence and background only.  They should
not be the starting point for new UX work.
