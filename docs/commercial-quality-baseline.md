# Commercial Quality Baseline

Status: Planning
Scope: Non-App-Store product-quality work before treating `hazakura editor` as a sellable product
Authority: Medium
Last reviewed: 2026-06-07

## Purpose

This memo records the commercial-quality work that is worth doing after the current v0.15 user-test polish slice, excluding App Store review preparation.

The goal is not to add more product surface. The goal is to make the existing Safe Editor, L Mode, Apple Local Assist, settings, release lane, and documentation trustworthy enough that the app can be evaluated as a paid or otherwise commercial product.

## Current Decision

Do not make a full E2E suite the next default investment. Tauri desktop E2E can be valuable, but the setup/runtime cost is high enough that it should wait until the product flow and distribution lane are steadier, or be limited to a very small smoke harness.

Do not prioritize a privacy policy in the immediate quality lane. It is required before public commercial distribution, especially if crash reporting or analytics are added, but it can follow the more concrete quality baseline work.

L Mode should continue improving, but broad L Mode refactors should start from evidence: a reproduced writing bug, a built-app smoke gap, or a small performance baseline. The first move for "make L Mode feel 80-90 point" is measurement and fixture work, not a large rewrite.

## Near-Term Priorities

Use these as good follow-up requests once the current separate work is finished.

1. **User-visible status and recovery audit**
   - Find failures that are silent or console-only.
   - Prefer save, external-change, image paste / drag-drop, Apple Local Assist apply, theme/window sync, and command-palette/slash-menu failures.
   - Fix one class of failure at a time with localized status copy and a recovery path where practical.

2. **Settings and theme clarity**
   - Keep immediate settings and restart-required settings visually and textually clear.
   - Polish Japanese copy, Preferences grouping, theme hint visibility, native menu sync, and window-theme sync.
   - Verify persistence and restart-pending behavior when relevant.

3. **Accessibility baseline**
   - Audit the main editor shell, Preferences, close/dirty dialogs, file tree actions, L Mode chrome, task widgets, Apple Local Assist review bar, and status/error surfaces.
   - Prioritize keyboard operation, focus visibility, focus trapping, accessible names, contrast, reduced motion, and screen-reader-friendly status.
   - Treat this as a baseline: fix critical/major barriers first, then record remaining lower-priority issues.

4. **Performance and L Mode measurement baseline**
   - Add or reuse fixed Markdown fixtures: small note, long Japanese prose, mixed Markdown, and large Markdown.
   - Measure open, edit responsiveness, L Mode toggle, selection movement, typewriter recentering, search, and long-document scrolling where practical.
   - Use the results to decide whether L Mode needs targeted fixes, decoration-cache work, CSS/layout tuning, or no change.

5. **Honest feature-scope documentation**
   - Keep claims precise for images, tables, spellcheck, Print to PDF, Apple Local Assist, and Agent Workbench.
   - Prefer "Print to PDF handoff" over "PDF export" unless the app generates PDF itself.
   - Prefer "experimental on-device text help on supported Macs" over broad "local AI" claims.
   - Keep Safe Editor's "does not execute / does not auto-apply / review before save" promise easy to understand.

6. **Developer / GitHub distribution readiness audit**
   - Before adding Sparkle or a fully automated release pipeline, prove the manual Developer / GitHub lane can be signed, notarized, packaged, checksummed, downloaded, and verified.
   - Keep this distinct from App Store review prep and from the warning-expected DMG preview lane.
   - Treat Sparkle, updater feeds, and release-pipeline automation as follow-up work after one clean manual distribution pass.

## Deferred For Now

- Full Playwright / Tauri E2E coverage as a default gate.
- Privacy policy, support-page, and commercial website copy.
- Sparkle auto-update implementation.
- Fully automated signing / notarization / upload / release-note pipeline.
- App Store Connect metadata, screenshots, TestFlight, or review-note work.
- Broad L Mode WYSIWYG rewrite without measurement or a reproduced writing failure.

These are not rejected. They are simply not the next most efficient quality slice.

## L Mode Rule

For L Mode quality work, use this decision rule:

- If there is a concrete regression around IME, caret, Backspace/Delete, lists, links, tables, images, visual overlap, or source preservation, reproduce it and fix the smallest behavior cluster.
- If the proposal is performance or architecture oriented, collect a baseline first.
- If the proposal is visual polish only, check whether it improves daily writing confidence without making the saved Markdown source harder to predict.

Do not introduce Preview DOM editing, `contenteditable`, HTML as the saved model, hidden save-time rewriting, automatic formatting, auto-apply, or network-backed assist behavior.

## Suggested Request Labels

Future agents can pick one of these labels and execute a bounded slice:

- `commercial-quality: status-recovery-audit`
- `commercial-quality: settings-theme-clarity`
- `commercial-quality: accessibility-baseline`
- `commercial-quality: performance-baseline`
- `commercial-quality: l-mode-measured-follow-up`
- `commercial-quality: honest-feature-scope`
- `commercial-quality: developer-distribution-audit`

Each slice should name the evidence gap, change only the smallest relevant surface, and verify with `git diff --check` for docs-only work or the normal build/test commands for code.
