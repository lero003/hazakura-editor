# Development Automation

Status: Operational
Scope: Current recurring automation guidance
Authority: High
Last reviewed: 2026-06-07 (v0.15 User-Test Quality Polish / Commercial Quality Baseline framing)

## Purpose

This document is the current source of truth for unattended or recurring `hazakura editor` improvement loops.

The loop should make the app safer and more comfortable in one small verified slice. It must not turn the product into an IDE, agent platform, Git client, terminal, or project analyzer.

Historical automation prompts and old milestone instructions are archived in `docs/archive/operations/development-automation-through-v0.10-doc-refactor.md` and `docs/archive/operations/next-goals-through-v0.7.md`.

## Current Lane

Name: `hazakura-note-quality-loop`

Phase: v0.15 User-Test Quality Polish.

Prefer work in this order:

1. Stale or failing quality gates.
2. Latest-HEAD built-app smoke gaps for Apple Local Assist, L Mode, auto-backup restore, export, theme/settings, and Safe Editor boundaries.
3. One concrete user-test friction point from Apple Local Assist, L Mode, theme, settings, status / error copy, export, or file/recovery workflows.
4. Apple Local Assist rough-request quality, unavailable-state, unsupported-language, stale-target recovery, and App Store / developer-build distribution planning drift.
5. Theme/settings polish with persistence, native menu sync, window-theme sync, and restart-required copy checks.
6. Commercial-quality baseline slices from `docs/commercial-quality-baseline.md`: accessibility baseline, performance/L Mode measurement baseline, honest feature-scope docs, or Developer / GitHub distribution-readiness audit.
7. Safety-boundary regression checks.
8. Post-release docs/version drift.
9. One reproduced bug in implemented L Mode WYSIWYG behavior, especially caret, IME, Backspace/Delete, hidden markers, lists, dividers, links, tables, images, visual overlap, source preservation, or a measured performance baseline.
10. Focused refactor only when it directly supports a verified user-facing polish fix; do not split a large file for architecture aesthetics alone.
11. Documentation drift.
12. Verified no-op after inspection when no useful small slice is safe.

## Start Every Run

1. Read `AGENTS.md`, `README.md`, `docs/README.md`, `docs/current-status.md`, `docs/roadmap.md`, `docs/smoke-checklist.md`, `docs/commercial-quality-baseline.md`, and this document.
   If the run touches Apple Local Assist, App Store distribution, or assist-provider shape, also read `docs/assist-surface-strategy.md`, `docs/apple-local-assist-distribution-plan.md`, `docs/security-boundary.md`, and `docs/agent-workbench-boundary.md`.
2. Run `git status --short --branch`.
3. Treat existing uncommitted changes as user or previous-agent work. Do not revert them.
4. Use Hazakura Habitat before substantial implementation, automation changes, dependency or lockfile work, release work, Git/GitHub mutation, or command-selection uncertainty.
5. Choose exactly one coherent slice that can be verified in the same run. For v0.15, name the observed friction or evidence gap before editing.

## Product Boundaries

Do not implement or imply:

- Git integration.
- LSP or IDE behavior.
- Arbitrary terminal or shell access.
- Arbitrary command execution.
- Arbitrary path input UI.
- Provider-add UI or arbitrary provider configuration.
- Multiple Agent sessions, session restore, auto-apply, auto-commit, or persistent agent/review logs.
- Plugin systems.
- Project-wide indexing beyond the shipped bounded search behavior.
- Strong predictive autocomplete or broad automatic formatting.
- Signing, notarization, updater, or installer completion without an explicit distribution lane.
- Full E2E suite, privacy policy, support page, Sparkle updater, or automated release pipeline unless the user opens that lane explicitly. Small smoke harnesses, accessibility audits, and performance baselines are acceptable when they stay bounded.
- Dependency or lockfile changes without explicit approval.
- Apple Local Assist distribution-lane changes (`minimumSystemVersion`, App Store/TestFlight settings, signing, entitlements, sandbox assumptions, notarization, helper packaging shape, or network fallback) without explicit user approval. The live local helper is already on `main`; future work should harden quality, unavailable states, and distribution evidence without broadening the trust boundary.

Keep Agent Workbench explicit, allowlisted, one-session, no-restore, and no-auto-apply. Keep Review Desk low-prominence and manual unless the user explicitly resumes feature work. Refactoring is acceptable when it is the smallest way to fix or verify a concrete polish issue, but do not turn the quality lane into a broad architecture rewrite.

## Inspection Rules

Do not decide verified no-op from docs alone when app inspection is practical.

Use one focused inspection path:

- built app smoke for release or desktop behavior
- Vite/browser smoke for focused UI behavior
- source/read-only inspection only when app smoke is blocked or irrelevant

If `open -n` or browser policy blocks inspection, report the blocker as environment evidence. Do not claim manual smoke passed.

## Verification

For code changes, normally run:

```bash
npm run build:vite
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
git diff --check
```

For changes that touch `src-helpers/apple-assist/`, also run:

```bash
npm run build:apple-assist-helper:fixture
```

This builds the Swift helper in fixture mode and runs the JSON-over-stdio smoke test. It does NOT exercise the live Foundation Models binding (that path is stubbed). It does NOT modify `tauri.conf.json`, `binaries/` is gitignored, and the script does NOT publish or sign anything.

For docs-only changes, run:

```bash
git diff --check
```

For UI behavior changes, update or exercise `docs/smoke-checklist.md`. If the built app or an Agent provider session was opened, quit it before final reporting when practical.

For release-candidate work, use `hazakura-note-release-candidate`, `docs/source-release-checklist.md`, and `docs/dmg-preview-checklist.md`. Do not tag, publish, release, or attach assets without explicit user approval.

## Documentation Duties

Update only docs whose truth changed:

- `docs/current-status.md` for current implementation state, release-candidate state, risks, and next actions.
- `docs/roadmap.md` when active lanes or phase boundaries change.
- `docs/smoke-checklist.md` when manual checks change.
- `docs/external-agent-review-workflow.md` when implementation/review ownership changes.
- `README.md` when public feature, limit, or run/build instructions change.
- `docs/source-release-checklist.md` or `docs/dmg-preview-checklist.md` when release gates change.

Do not add new historical logs to current docs. Preserve historical evidence under `docs/archive/` or `docs/releases/` as appropriate.

## Final Report

Report:

- selected slice or verified no-op reason
- changed files
- checks run
- app smoke performed or why it was blocked/skipped
- residual risk
- next small action
