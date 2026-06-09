# App Store Current Work

Status: Operational
Scope: Current App Store-facing quality work for external agents
Authority: High
Last reviewed: 2026-06-09

## Purpose

Use this file as the single current work queue for App Store-facing quality work.

This is not App Store Connect metadata, certificate work, notarization, upload, DMG packaging, or final legal copy.
It is the ordered implementation/review queue for proving that the App Store lane remains a Markdown-first Safe Editor.

For detailed request background, use `docs/app-store-quality-agent-requests.md` as the packet catalog.
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

## Ordered Queue

### 1. `app-store-quality: save-restore-regression`

Goal: strengthen evidence around data-loss prevention.

Focus:

- LF / CRLF and final-newline preservation.
- UTF-8 BOM, Shift-JIS, and EUC-JP round trips where supported.
- External-change conflict refusal.
- Save As existing-file overwrite rejection.
- Dirty-tab close and app-close recovery.
- Moved, deleted, or permission-lost file errors.

Good outcome:

- Add focused tests for the selected save/restore risk.
- Fix only the smallest proven behavior gap.
- Keep user edits recoverable when a file path, permission, or disk state changes.

Verification:

- Focused frontend/Rust tests for the touched behavior.
- `npm run build:vite`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git diff --check`

Codex review focus:

- No silent overwrite.
- No stale path treated as authorization.
- No data-loss-prone clean/dirty state.
- Error copy does not overclaim full sandbox readiness.

### 2. `app-store-quality: markdown-preview-export-security`

Goal: add regression evidence for Markdown preview and HTML export safety.

Focus:

- `<script>` and event handlers.
- `javascript:` URLs.
- External images.
- Workspace-outside relative paths.
- Oversized or malformed `data:image`.
- Broken local images.
- HTML export image inlining.

Good outcome:

- Dangerous preview/export inputs are covered by tests.
- Export does not rewrite Markdown source.
- Workspace-relative handling stays bounded to selected workspace behavior.

Verification:

- Focused preview/export tests.
- `npm run build:vite`
- `git diff --check`

Codex review focus:

- No script execution or external fetch path appears.
- Link/image behavior matches `docs/security-boundary.md`.
- Docs do not claim broader web sandboxing than implemented.

### 3. `app-store-quality: accessibility-smoke`

Goal: audit and fix the most important accessibility barriers in the main editing flow.

Focus:

- Tab names and unsaved state.
- File tree actions and disclosure state.
- Preview / Wrap / Invisibles state.
- Save-conflict dialog focus and labels.
- L Mode controls and task checkboxes.
- Apple Local Assist review controls.
- Contrast and reduced-motion behavior.

Good outcome:

- Main editor flow is reachable by keyboard.
- Important state changes are visible and labeled.
- Any VoiceOver/manual smoke is reported only if actually exercised.

Verification:

- Focused UI tests where practical.
- Keyboard smoke notes.
- `npm run build:vite`
- `git diff --check`

Codex review focus:

- No large UI redesign.
- Focus order and labels serve the existing Safe Editor flow.
- App Store lane does not expose Agent Workbench controls.

### 4. `app-store-quality: support-diagnostics`

Goal: add a privacy-preserving support / diagnostics path.

Focus:

- App version.
- macOS version and architecture.
- Distribution lane.
- Apple Local Assist availability.
- Sandbox / reauthorization state where implemented.
- Relevant feature flags.
- Recent error categories, not document contents.

Must not include:

- Document contents.
- Full workspace listings.
- Secret-looking values.
- Provider transcripts.
- Unnecessary full file paths.

Verification:

- Focused tests for diagnostics serialization and redaction.
- UI smoke for copy/view route if UI changes are made.
- `npm run build:vite`
- `git diff --check`

Codex review focus:

- Diagnostics are user-initiated and reviewable before sharing.
- No telemetry, automatic upload, or background collection is introduced.
- Agent Workbench internals are not mixed into App Store diagnostics.

### 5. `app-store-quality: performance-bundle-baseline`

Goal: measure before optimizing bundle size or performance.

Focus:

- Production chunk-size warning source.
- Editor / preview / Apple Local Assist lazy-loading opportunities.
- Open, edit, L Mode toggle, search, and long-document scroll timing on fixed fixtures.

Good outcome:

- Record a reproducible measurement baseline.
- Propose fixes only when measurement justifies the slice.
- Avoid broad architecture changes.

Verification:

- Document exact commands and fixture sizes.
- `npm run build:vite`
- `git diff --check`

Codex review focus:

- Measurement is repeatable.
- No speculative optimization churn.
- No L Mode redesign without evidence.

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

