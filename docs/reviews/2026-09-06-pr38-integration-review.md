# PR #38 integration review

Status: Review evidence
Scope: Local Assist sidebar source integration
Authority: Advisory
Date: 2026-09-06

## Findings and fixes

- **P2: Preview controls clipped at 1,200px.** With Workspace, Editor, Preview,
  and Assist open, the editor/preview grid needed 546px inside a 506px allocation.
  The previous 1,000px breakpoint left the Preview close button under Assist.
  Switch Assist to the existing stacked layout through 1,400px. Browser screenshots
  verified visible controls at 1,200px and side-by-side layout at 1,600px.
- **Verification blocker: six modal focus tests failed.** Their jsdom visibility
  stub still supplied offsetParent while the updated focus trap uses client
  rectangles. Updated the test-only geometry stub and restored it after each test;
  kept the real focus trap and its fixed-position/hidden/inert tests.
- Added an integration test using the real reviewed-proposal writer and CodeMirror:
  apply replaces only the selected text, consumes the proposal, marks the buffer
  changed, and one Undo restores the source and unchanged state.

## Verified

Dependencies restored with `npm ci --ignore-scripts` from the unchanged lockfile.
No dependency or lockfile update is included.

- `npm run typecheck`: passed (also run by the final Vite build).
- `npm test`: 225 files / 1,918 tests passed.
- `npm run smoke:app-store-surface`: 10 files / 111 tests passed.
- `npm run build:vite` and `npm run build`: passed; local ad-hoc macOS app only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 368 passed / 2 ignored.
- `git diff --check`: passed.
- Chromium: real sidebar with a disposable Japanese document, 1,200px stacked,
  1,600px side-by-side, and L Mode. Native IPC/model availability is absent in
  this browser, so these screenshots are layout evidence only.

The existing Vite large-chunk warning and jsdom canvas diagnostics remain;
these did not fail the builds or tests.

## Remaining boundaries

Real model generation, native IME, VoiceOver, native save, and the complete
macOS select → generate → refine → Diff → apply → Undo/Redo → save flow remain
unverified. The existing running user app was not restarted for this review.
CodeMirror integration is not native host or App Store proof. No publication,
tag, upload, model/provider expansion, or saving contract change is included.

The local main had six unpublished commits beyond the PR base. They were kept
outside this PR; no force-push or incorporation of that unrelated history.
