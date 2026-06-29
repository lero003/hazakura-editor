# Command Discovery Final Polish Design

## Goal

Finish the v1.2 command-discovery slice before built-app testing by keeping the right-click slash menu inside the viewport and making Command Palette search reuse the localized slash-command vocabulary.

## Scope

- When the slash menu would extend below the viewport, position it above the invocation point with `bottom` rather than moving its top edge slightly upward.
- Keep the menu inside an 8px horizontal inset. Use right alignment near the right edge and clamp the left edge near the left side.
- Bound the menu's CSS max dimensions to the viewport while preserving the existing 320px vertical cap and compact visual style.
- Merge each slash command's localized label and `searchKeys` into its Command Palette keywords. Palette labels remain English.
- Update focused tests, smoke guidance, current-work state, and handoff evidence.

## Non-goals

- No new commands, toolbar, plugin surface, arbitrary command input, or palette-wide localization.
- No changes to Markdown insertion semantics, saved source, Agent Workbench, or release/version metadata.
- No unrelated EPUB, Local Assist, image-limit, Recovery, drag/drop, or Save-As work.

## Verification

- RED/GREEN focused tests for slash-menu position and localized palette search.
- Full npm tests, TypeScript/Vite build, Rust format/tests, local app bundle build, and `git diff --check`.
- Run packaged-app window smoke when available; do not claim interaction smoke from source tests alone.
