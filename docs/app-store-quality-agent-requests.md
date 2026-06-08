# App Store Quality Agent Requests

Status: Planning
Scope: External-agent request packets for App Store quality work excluding certificates, signing, notarization, and DMG packaging
Authority: Medium
Last reviewed: 2026-06-08

## Purpose

Use this memo when asking an external implementation agent to work on App Store-facing quality before certificate, provisioning, notarization, upload, or DMG work begins.

The goal is to turn review-readiness concerns into small, reviewable slices. Each request should produce evidence that `hazakura editor` remains a Markdown-first safe editor under tighter distribution assumptions.

This document is not user-facing App Store copy. It is an internal request queue and Codex review guide.

## Current Decision

Prioritize evidence that the ordinary editor experience still works in the App Store lane:

- user-selected file and workspace access survives sandbox assumptions or fails into a clear reauthorization path
- App Store builds omit Agent Workbench behavior in both UI and backend command paths
- local data and Apple Local Assist behavior can be explained clearly to App Review and users
- save, restore, conflict, preview, export, and accessibility behavior have focused regression evidence

Do not ask external agents to handle:

- Apple Developer certificates
- provisioning profiles
- App Store upload
- Developer ID signing
- notarization
- updater implementation
- DMG creation or release-asset publication
- GitHub release automation

Those remain separate distribution-lane decisions.

## Request Rules

Each external-agent request must:

- choose exactly one request packet below
- name the evidence gap before changing code
- preserve Safe Editor as the primary product surface
- keep Markdown/text source canonical
- keep Agent Workbench out of the App Store lane
- avoid new Git, LSP, terminal, plugin, arbitrary command, project-indexing, auto-apply, or auto-commit behavior
- avoid dependency or lockfile changes unless explicitly approved
- update docs only where truth changes
- run the relevant checks and report skipped smoke honestly

Before implementation, the external agent should read:

- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/current-status.md`
- `docs/roadmap.md`
- `docs/development-automation.md`
- `docs/external-agent-review-workflow.md`
- `docs/security-boundary.md`
- `docs/agent-workbench-boundary.md`
- this document

## P0 Request Packets

### `app-store-quality: sandbox-file-restore`

Goal: prove that recent workspaces, restored tabs, Save, Save As, and backup / conflict flows behave safely under App Sandbox assumptions.

Good outcomes:

- if sandbox access can be restored safely, add the smallest implementation and test coverage for that path
- if durable restoration is not yet safe, add a clear reauthorization UX and record the remaining limitation
- no file is silently reopened, overwritten, or treated as authorized only because a stored path string exists

Out of scope:

- certificate, provisioning, upload, notarization, or DMG work
- broad file-manager behavior
- workspace-wide indexing
- automatic migration of arbitrary historical paths

Verification should include:

- focused Rust tests for path authorization / denial behavior where practical
- app or Vite smoke for Open Folder -> open file -> restart / restore or reauthorize -> edit -> save
- `npm run build:vite`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git diff --check`

Codex review focus:

- stored paths do not become hidden authorization
- failure states keep edits recoverable
- Save As still rejects accidental overwrite where current behavior requires it
- docs do not claim full App Store readiness unless the sandboxed path is actually proven

### `app-store-quality: app-store-agent-omission`

Goal: make the App Store lane's Agent Workbench omission testable and review-note-ready.

Good outcomes:

- App Store build UI has no Agent Workbench entry points
- direct IPC / command calls fail with the expected unavailable message
- provider discovery and process spawn paths are not reached in the App Store lane
- tests or smoke evidence make the omission easy to review

Out of scope:

- changing the Developer / GitHub lane provider model
- adding provider settings
- removing Agent Workbench from the Developer / GitHub build
- changing CLI provider internals

Verification should include:

- focused frontend and Rust tests for App Store lane gates where practical
- `npm run build:vite`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build:app-store-preview` if the touched path affects lane packaging
- `git diff --check`

Codex review focus:

- hidden UI is backed by backend rejection
- no arbitrary command or provider-add surface appears
- Developer / GitHub behavior is not accidentally broken
- docs and review notes keep the two lanes distinct

### `app-store-quality: privacy-local-data`

Goal: prepare clear local-data disclosure and in-app access to privacy information without overstating implementation.

Good outcomes:

- user-facing copy explains local documents, backups, Apple Local Assist, and App Store Agent Workbench omission
- no analytics, tracking, network fallback, or external upload is implied unless implementation proves it
- Privacy / Local Data entry point is reachable from an appropriate app surface if implemented

Out of scope:

- legal finalization of the public Privacy Policy
- website work
- analytics, crash reporting, or telemetry
- App Store Connect metadata submission

Verification should include:

- UI smoke for the new disclosure route if UI changes are made
- `npm run build:vite`
- relevant unit tests if copy/state logic is added
- `git diff --check`

Codex review focus:

- copy matches `docs/security-boundary.md`
- Apple Local Assist is described as explicit, local/on-device where available, reviewable, and unsaved until user save
- `.hazakura/backups/...` behavior is described carefully if mentioned
- App Store lane does not imply Agent Workbench availability

### `app-store-quality: review-notes-draft`

Goal: create an internal App Review Notes draft that explains non-obvious behavior before submission work starts.

Good outcomes:

- concise review notes explain the app as a Markdown/text editor, not an IDE or terminal
- notes describe user-selected file access, sandbox-sensitive restore behavior, Apple Local Assist availability, AI edit review, and App Store Agent Workbench omission
- reviewer smoke path is simple: Open Folder -> open Markdown/text -> edit/save -> preview/export -> optional Apple Local Assist availability check

Out of scope:

- App Store Connect metadata entry
- screenshots
- submission
- certificate / provisioning details

Verification should include:

- `git diff --check`

Codex review focus:

- notes do not promise signed, notarized, TestFlight, or approved state
- notes avoid alpha / beta marketing claims for user-facing surfaces while keeping internal limitations honest
- smoke instructions match shipped UI labels and App Store lane behavior

## P1 Request Packets

### `app-store-quality: save-restore-regression`

Goal: strengthen evidence around data-loss prevention.

Target examples:

- LF / CRLF and final-newline preservation
- UTF-8 BOM, Shift-JIS, and EUC-JP round trips where supported
- external-change conflict refusal
- Save As existing-file overwrite rejection
- dirty-tab close and app-close recovery
- moved, deleted, or permission-lost file errors

Verification should include focused tests for the chosen case plus the normal code-change gates.

### `app-store-quality: accessibility-smoke`

Goal: audit and fix the most important accessibility barriers in the main editing flow.

Target examples:

- tab names and unsaved state
- file tree actions and disclosure state
- Preview / Wrap / Invisibles state
- save-conflict dialog focus and labels
- L Mode controls and task checkboxes
- Apple Local Assist review controls
- contrast and reduced-motion behavior

Verification should include focused keyboard smoke and, where practical, VoiceOver notes. Do not claim VoiceOver smoke passed unless it was actually exercised.

### `app-store-quality: markdown-preview-export-security`

Goal: add regression evidence for Markdown preview and HTML export safety.

Target examples:

- `<script>` and event handlers
- `javascript:` URLs
- external images
- workspace-outside relative paths
- oversized or malformed `data:image`
- broken local images
- HTML export image inlining

Verification should include focused tests plus `npm run build:vite` and `git diff --check`.

### `app-store-quality: support-diagnostics`

Goal: add a privacy-preserving support / diagnostics path.

Good diagnostics include app version, macOS version, distribution lane, Apple Local Assist availability, sandbox / reauthorization state, and relevant feature flags.

Diagnostics must not include document contents, full workspace listings, secret-looking values, provider transcripts, or unnecessary file paths.

### `app-store-quality: performance-bundle-baseline`

Goal: measure before optimizing bundle size or L Mode performance.

Target examples:

- production chunk-size warning source
- editor / preview / Apple Local Assist lazy-loading opportunities
- open, edit, L Mode toggle, search, and long-document scroll timing on fixed fixtures

Do not split large chunks or rewrite L Mode architecture without measurement that justifies the slice.

## Review Hand-off Template

Ask the external agent to close with:

```md
## Selected request

`app-store-quality: ...`

## Evidence gap

What was unproven before this slice.

## Changed files

List only files changed by this slice.

## Verification

Commands and manual smoke actually run.

## Skipped checks

Skipped checks with reasons.

## Known risks

Residual risks or follow-up requests.
```

Codex review should then use `docs/external-agent-review-workflow.md` and this document as the acceptance contract.
