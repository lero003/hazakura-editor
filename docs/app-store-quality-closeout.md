# App Store Quality Closeout

Status: Complete
Scope: Queue 1–5 evidence summary and residual risk triage
Recorded: 2026-06-09
Version: v0.17

## Purpose

This document is the single-view closeout for the five ordered queues in
`docs/app-store-current-work.md`. It provides a short evidence summary,
verification snapshot, and residual risk triage so the next person
picking up App Store-facing work (metadata, screenshots, certificates,
submission) can understand what is tested and what still needs a human look.

## Queue Evidence Summary

### Queue 1: save-restore-regression

| Slice | Scope | Key commit |
|---|---|---|
| 1.1 | UTF-8 BOM | `01d1ea05` |
| 1.2 | Shift-JIS / EUC-JP | `ff050135` |
| 1.3 | dirty tab close | `1436ed40` |
| 1.4 | Cmd+Q / app-quit | `3f6c043d` |
| 1.5 | moved / deleted / directory errors | `3b2deb76` |

Coverage: LF/CRLF preservation, UTF-8 BOM round-trip, Shift-JIS/EUC-JP
round-trip, external-change conflict refusal, Save As overwrite rejection,
dirty-tab close confirmation, Cmd+Q app-quit dirty guard, missing-file /
directory-path save errors.  All paths have at least one focused Rust or
frontend unit test.

### Queue 2: markdown-preview-export-security

| Slice | Scope | Key commit |
|---|---|---|
| 2.1 | script / event handler / javascript: | `d81c6d8b` |
| 2.2 | malformed data:image | `ea641488` |
| 2.3 | oversized data:image / style/form/input FORBID | `a0467a7c` |

Coverage: `<script>`, event handlers (`onclick`, `onerror`, etc.),
`javascript:` URLs, external images, workspace-boundary image paths,
malformed `data:image`, oversized `data:image` (2 MB cap), `<object>` /
`<embed>` / `<iframe>` / `<style>` / `<form>` / `<input>` in
FORBID_TAGS, `data:` URI in `<a href>`, source Markdown non-mutation.

### Queue 3: accessibility-smoke

| Slice | Scope | Key commit |
|---|---|---|
| 3.1 | TabBar aria-describedby / StatusBar live region | `6b7c6c21` |
| 3.2 | TabBar keyboard navigation | `bdd45b6d` |
| 3.3 | image tab nav test / L Mode task checkbox aria-label | `39433f05` |

Coverage: tab-bar dirty-dot accessible descriptor, StatusBar
`role="status"` + `aria-live`, tab-bar arrow-key / Home / End keyboard
navigation, image-preview-tab keyboard nav, L Mode task checkbox
`aria-label`.  Apple Local Assist review bar, RightPaneToggleControls,
CloseDialogs, WorkspaceTree, and reduced-motion CSS are verified no-op.

### Queue 4: support-diagnostics

| Slice | Scope | Key commit |
|---|---|---|
| 4 | diagnostics helper + redaction test | `c4797570` |

Coverage: `collectDiagnostics()` serialization helper collecting app
version, distribution lane, navigator.platform, feature flags, and
allowlist-sanitised error categories.  `assertNoForbiddenKeys()` redaction
checker for `documentContents` / `workspacePath` / `apiKey` etc., including
array recursion and absolute-path detection.  No telemetry, no upload.

### Queue 5: performance-bundle-baseline

| Slice | Scope | Key commit |
|---|---|---|
| 5 | bundle baseline doc | `c4797570` |

Coverage: `docs/app-store-performance-baseline.md` records `npm run
build:vite` chunk sizes (raw + gzip) for all entry points as of 2026-06-09.
Only `main` (978 kB raw) triggers the 500 kB chunk warning.  No
optimisation performed.

## Verification Snapshot (2026-06-09)

```
npx vitest run                                      → 587 passed
cargo test --manifest-path src-tauri/Cargo.toml     → 265 passed
npm run build:vite                                  → built in 272 ms (vite)
git diff --check                                    → clean
```

## Residual Risk Triage

### Before App Store Submission — Manual Smoke Recommended

These are verified by unit tests.  A lightweight human spot check on
2026-06-09 raised confidence for core Safe Editor editing, dirty close /
quit, and tab navigation, but VoiceOver and full keyboard-only coverage
remain open manual checks:

- **macOS red-button close with dirty tabs** — unit-tested via
  `useWindowCloseConfirmation.test.tsx`; a 2026-06-09 human spot check
  reported no issue for dirty red-button close, but this was not an
  exhaustive keyboard / VoiceOver audit.
- **Cmd+Q with dirty tabs** — Rust `RunEvent::ExitRequested` handler
  is unit-tested via `useAppExitConfirmation.test.tsx`; a 2026-06-09
  human spot check reported no issue for dirty `Cmd+Q`, but final
  submission smoke should still keep this path visible.
- **Keyboard-only tab navigation** — arrow-key handler is unit-tested
  via `AppTopChrome.test.tsx`; 2026-06-09 human spot checks covered some
  tab movement, while full keyboard-only traversal remains partial.
- **VoiceOver tab-bar announcement** — `aria-describedby` wiring is
  unit-tested; real VoiceOver smoke is recommended.
- **prefers-contrast** — `prefers-contrast: more` is now implemented
  in `src/styles/a11y.css` (panel borders / focus ring / placeholder /
  scrollbar).  CSS-only, theme-aware, and uses `color-mix` against
  existing tokens.  Manual smoke with macOS "Increase Contrast"
  enabled is still recommended.

### Before App Store Submission — Recorded Decisions and Deferred Items

These are either intentional v0.17 keep-decisions, recorded
with rationale, or open items that App Review may surface
later. They are not blockers for an external agent and do
not require another implementation pass before submission
metadata / certificate work begins.

| Item | Priority | Notes |
|---|---|---|
| WorkspaceTree `role="tree"` pattern | Decision (2026-06-09) | Keep the current button-based model for v0.17. See `docs/workspace-tree-accessibility-decision.md` for the rationale and revisit criteria. The current model satisfies the relevant WCAG 2.2 AA Name / Role / State / Keyboard guidance via real `<button>` rows, `aria-expanded` on directory rows, a real `<input>` during rename, and an `Escape` clear-compare affordance on the container. |

### Out of Scope for Safe Editor / App Store Lane

These are intentionally not part of the App Store lane:

- Agent Workbench (separate trust boundary, omitted from App Store)
- Git, LSP, terminal, plugin, arbitrary command execution
- Auto-apply, auto-commit, project indexing
- Telemetry, background collection, automatic upload

## Next Phase: Submission Preparation

The App Store quality queue is complete.  The next phase involves
human-executed, certificate-gated, or metadata-only work that is
**not in scope for automated implementation agents**:

- App Store Connect metadata (description, keywords, screenshots)
- Certificate / provisioning profile work
- App Store upload and submission
- Notarization
- DMG creation and publication for review
- Privacy Policy final publication URL / metadata review
- Complete third-party license packet review
- App Review Notes finalization (`docs/app-store-review-notes-draft.md`)

These are recorded in `docs/app-store-current-work.md` under
"Explicitly Out Of Scope".
