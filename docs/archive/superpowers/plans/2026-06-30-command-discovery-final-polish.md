# Command Discovery Final Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the slash menu inside the viewport and make localized slash-command terms discoverable through Command Palette.

**Architecture:** `SlashMenu` will calculate fixed-position edges from the invocation rectangle and viewport dimensions, using `bottom` for upward placement and `right` for right-edge alignment. Command Palette will continue deriving execution from `slashCommands`, while also merging each command's localized label and search keys into palette keywords.

**Tech Stack:** React, TypeScript, Vitest, CSS, Markdown.

---

### Task 1: Pin slash-menu viewport containment

**Files:**
- Create: `src/components/editor/SlashMenu.test.tsx`
- Modify: `src/components/editor/SlashMenu.tsx`
- Modify: `src/styles/slash-menu.css`

- [x] Add focused tests requiring `bottom` placement near the lower edge, `right: 8px` near the right edge, and `left: 8px` clamping near the left edge.
- [x] Run `npm test -- src/components/editor/SlashMenu.test.tsx` and confirm the new expectations fail against the current `top` / raw-`left` implementation.
- [x] Implement the minimal fixed-position edge calculation and viewport-bounded CSS.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Reuse localized search vocabulary

**Files:**
- Modify: `src/hooks/commandPalette/useCommandPaletteController.test.ts`
- Modify: `src/hooks/commandPalette/useCommandPaletteController.ts`

- [x] Extend the existing real-registry parity test so kana query `みだし` finds `insert.heading1` while the palette label stays English.
- [x] Run `npm test -- src/hooks/commandPalette/useCommandPaletteController.test.ts` and confirm the localized search expectation fails.
- [x] Merge the source slash command label and `searchKeys` into the palette command keywords without changing execution callbacks.
- [x] Re-run the focused test and confirm it passes.

### Task 3: Synchronize smoke and handoff docs

**Files:**
- Modify: `docs/current-work.md`
- Modify: `docs/archive/operations/v1.1-v1.2-followup.md`
- Modify: `docs/smoke-checklist.md`
- Modify: `docs/handoff.md`

- [x] Mark context-menu containment and localized discovery as source-verified while keeping packaged interaction smoke pending.
- [x] Keep the slice inside command discovery; do not move unrelated observations.

### Task 4: Verify the complete slice

**Files:**
- Modify: `docs/handoff.md`

- [x] Run `npm test`.
- [x] Run `npm run build:vite`.
- [x] Run `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
- [x] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [x] Run `npm run build`.
- [x] Run `npm run smoke:macos-window` if the host can launch the packaged app.
- [x] Run `git diff --check` and record only checks that actually passed.
