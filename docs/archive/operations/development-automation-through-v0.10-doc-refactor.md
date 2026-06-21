# Development Automation

Status: Operational
Scope: Recurring automation guidance for v0.10 release-candidate and alpha follow-up triage
Authority: High
Last reviewed: 2026-06-04

## Purpose

This document is the source of truth for unattended or recurring `hazakura-note` improvement loops.

The automation should make the app safer and more comfortable to use in small verified slices. It should not turn the project into an IDE, agent platform, or project analyzer.

When implementation is delegated to an external agent and Codex is asked to review, use `docs/external-agent-review-workflow.md` as the role contract.

## Current Automation Lane

Name: `hazakura-note-quality-loop`

Cadence: temporary quality loop during the v0.10 L Mode alpha release lane.

Current phase: v0.10.0 release-candidate / alpha triage. Recurring automation should prefer quality gates, latest-HEAD built-app smoke, release docs/version alignment, reproduced L Mode / workspace file operation / Agent provider availability bugs, safety-boundary checks, documentation drift, Safe Editor daily-use polish, and post-release verification over new feature expansion.

Primary outcome: one coherent post-release quality-check, bug-fix, smoke-coverage, or documentation-alignment slice per run, verified and documented. A verified no-op is acceptable when no safe useful slice is found.

Each run should fit the temporary hourly cadence. If the useful slice is larger than that, narrow it, leave a short next-step note, or stop with a verified no-op instead of stretching the scope.

Do not expand Review Desk into a larger workbench by default. Treat it as a low-prominence candidate-review receiver for pasted or Agent output now, and for future v0.11+ Hazakura Local Assist output after Foundation Models work begins, unless the user explicitly resumes Review Desk feature work.

Claude Code CLI is now an allowlisted local CLI provider inside the existing Agent Workbench boundary, not a replacement strategy. Do not add Claude-specific permission UI, MCP UI, arbitrary arguments, provider-add UI, auto-apply, or Git integration.

The automation should not create test code just to produce activity. Add or change tests only when a real regression risk, reproduced bug, backend/safety contract, or high-value smoke gap justifies it.

Do not decide verified no-op from documentation review alone when app inspection is practical. Before a no-op, look at the current app surface through a built-app smoke or Vite/browser smoke, or state why app inspection was not practical in that run.

## Start Every Run

1. Read `AGENTS.md`, `README.md`, `docs/current-status.md`, `docs/roadmap.md`, `docs/smoke-checklist.md`, `docs/external-agent-review-workflow.md`, and this document.
2. Run `git status --short --branch`.
3. Treat existing uncommitted changes as user or previous-run work. Do not revert them. If they are relevant, inspect and close them before starting new work.
4. Use Hazakura Habitat before substantial implementation, dependency or lockfile work, automation changes, Git/GitHub mutations, release work, or command-selection uncertainty.
5. Inspect the actual app surface when practical, using a built-app smoke or Vite/browser smoke that matches the slice. For no-op runs, prefer at least a quick Safe Editor startup or focused UI surface check.
6. If a smoke opens the built app, quit `hazakura-note` before final reporting. Do not leave a provider session or app process running after an automation pass.
7. Keep the slice small enough to verify in the same run, ideally within 30 minutes.

## External Agent / Codex Review Mode

Use this mode when another agent has already produced, or is about to produce, the implementation diff.

- The external implementation agent owns the code change.
- Codex owns the review pass unless the user explicitly asks Codex to fix the findings.
- Codex review should lead with findings, ordered by severity, and include file/line references when possible.
- Acceptance requires no unresolved blocking findings, honest docs, and verification appropriate to the touched surface.
- Do not let the review turn into unrelated cleanup, broad refactoring, or a second implementation plan.

Review focus:

- approved slice match
- Safe Editor Mode remains primary
- Agent Workbench remains explicit, allowlisted, one-session, no-restore, and no-auto-apply
- no hidden Git, LSP, terminal, plugin, project-indexing, or arbitrary command behavior
- file/path handling remains bounded to user-selected files or workspace roots
- docs do not claim production signing, notarization, stable distribution, or stronger safety than the implementation proves

## Selection Order

Choose the first useful slice that is both small and verifiable.

0. v0.10 release-candidate / alpha quality triage lane:
   - run the relevant quality gates when evidence is stale or a recent slice needs confirmation
   - inspect the latest built app against one v0.9 release surface from `docs/smoke-checklist.md` when practical
   - fix one reproduced bug or visible quality issue from current implemented Review Desk / Slash / Diff behavior
   - update smoke notes or status docs only when behavior, evidence, or automation guidance changed
   - treat broader v0.10/v0.11 feature implementation as out of scope unless the user explicitly reopens feature work
1. v0.7 Review Desk Readiness Gate:
   - perform read-only structure review before new Review Desk implementation
   - inventory `src/App.tsx` responsibilities still left after the v0.6 split
   - check whether hooks/components should be grouped by Diff / Review / Tabs / FileTree / Agent Workbench / Preferences boundaries
   - identify tiny files that make the code harder to navigate, but do not merge them without a concrete readability win
   - inspect Rust `src-tauri/src/lib.rs` for module split candidates
   - output findings as: fix now, fix before v0.7 implementation, v0.8+, fold back together, and Review Desk structural risk
2. External-agent implementation review:
   - use `docs/external-agent-review-workflow.md`
   - review the diff before accepting the slice
   - prefer findings and verification over additional implementation
   - only patch findings if the user explicitly asks for review-and-fix
3. v0.7 release readiness:
   - audit current Review Desk / Slash / Diff changes against the approved MVP
   - confirm Review Desk entry paths and manual candidate review remain explicit and non-Git
   - prepare source-preview release notes and version-surface checks only after the release lane is explicitly approved
   - do not add bounded Global Search, Command Palette, editable two-column Review Desk, detached Agent windows, Frontmatter, KaTeX, encoding conversion, or settings consolidation in v0.7 unless the user explicitly reopens feature work
4. Markdown authoring feature readiness:
   - use `docs/authoring-feature-readiness.md` as the source of truth for image paste, export, Zen, spellcheck, table, and Agent authoring gaps
   - prefer safe workspace-relative `assets/...` preview/export rendering before adding more image UX
   - treat image drag-and-drop into `assets/` as separate from the existing file-open drag/drop behavior
   - keep PDF export described as Print to PDF unless a real PDF pipeline is explicitly approved
   - keep current table behavior described as Insert table until row/column/alignment editing exists
   - do not claim Agent authoring actions until selected text, candidate output, diff review, and explicit apply are designed inside the safe boundary
5. Agent Workbench patch follow-up:
   - keep `pi` and `claude` only as allowlisted local CLI providers inside the existing Agent Workbench gate
   - keep Pi / Claude launch behavior inside explicit mode, restart boundary, responsibility consent, selected workspace root, and one active session
   - improve provider availability, launch failure, stop/exit, resize, app-close cleanup, and terminal responsiveness from focused smoke findings
   - run trusted-workspace manual smoke for Pi / Claude when the provider exists locally, and record provider-not-found cleanly when it does not
   - no Pi RPC, Pi SDK, Claude-specific permission / MCP / argument UI, arbitrary provider configuration, provider-add UI, multi-agent orchestration, auto-apply, auto-commit, general terminal, or Git client behavior
6. v0.4 Markdown Review Navigation patch follow-up:
   - treat shipped v0.4 behavior as patch-follow-up only
   - current-file heading outline
   - current heading or section context
   - diff hunk heading context for Markdown files
   - local Markdown link navigation limited to explicit workspace files
   - open-tabs and recent-files navigation
   - readable Markdown preview/review display polish
   - avoid strong autocomplete, automatic lint fixes, broad formatting rewrites, project-wide indexing, and symbol search
7. v0.3 Diff / Change Review patch follow-up:
   - re-smoke file comparison and change-review paths from the released `v0.3.0` surface
   - fix narrow regressions in current buffer versus disk, explicit file-to-file comparison, draft/recovery comparison, or save-conflict review
   - keep labels in file/workspace/change-review language and avoid Git wording
   - no repository status, branch, staging, history, apply, commit, push, pull, or merge behavior
8. Everyday usability polish:
   - menu placement, menu language, button labels, dialog wording, external-change messages, save-conflict wording, layout fit, and built-app smoke notes
   - prefer the smallest visible improvement that makes manual use clearer
9. Safety-boundary regression checks:
   - Safe Editor default startup
   - Agent Workbench explicit mode gate and restart boundary
   - responsibility-boundary consent
   - allowlisted `codex` / `opencode` / `pi` / `claude` providers only
   - selected workspace root only
   - one active session
   - no arbitrary shell, arbitrary command input UI, arbitrary path input UI, session restore, auto-apply, auto-commit, provider-add UI, or Git integration
10. Stability and responsiveness:
   - stale snapshot handling, external-change live refresh, save/reopen failure paths, theme switching, search responsiveness, and Agent Workbench lifecycle regressions when touched
   - prefer fake-provider coverage for hazakura-owned Agent lifecycle behavior and trusted-workspace manual smoke for real `codex` / `opencode` / `pi` / `claude` behavior
11. Markdown-first safe editor quality:
   - save failure recovery, external-change recheck, dirty close, draft restore, Save As, line endings, preview sanitize, workspace image preview, scroll sync, resizable panes, window close, workspace tree, theme switching, search, long file names, constrained-width layout, Japanese IME, and keyboard focus
12. Local release readiness:
   - source-only release P0 gates from `docs/source-release-checklist.md`
   - dependency audit review with `npm audit` and `cargo audit` only when the run has enough time and risk justification
   - treat the open `glib` / `GHSA-wrw7-89jp-8q8g` Dependabot alert as a triaged Linux Tauri/wry GTK/WebKit dependency item unless Linux support, a Tauri/wry dependency-refresh lane, distribution-readiness sign-off, severity escalation, or a compatible patched upstream path makes it actionable
   - latest-HEAD built-app smoke evidence before tag approval
   - app version/about metadata and source release notes
   - packaging docs without signing or notarization claims; Developer ID signing, notarization, installer packaging, and updater work belong to v1.0 or an explicit distribution-lane approval
   - do not tag, publish, release, or attach a DMG without explicit user approval
13. Verified no-op:
   - If no small useful slice is safe after reading docs and inspecting the app surface when practical, run the relevant checks, update docs only if facts changed, and report no-op clearly.
   - A no-op report should say whether app inspection was performed, or why it was skipped.

## Test Discipline

Tests are valuable when they protect behavior that is easy to regress and hard to notice manually. They are noise when they only restate an implementation detail that was not changed.

Add or update automated tests when:

- a bug was reproduced and can be fixed with a stable regression test
- a backend or safety-boundary contract changes
- an Agent Workbench lifecycle, gate, output/input, stop/exit, or external-change path gains new behavior
- a fake provider can verify hazakura-owned behavior without depending on real provider internals

Prefer docs or manual smoke notes instead of new tests when:

- the change is UI wording, menu placement, visual density, or checklist language only
- existing tests already cover the contract being touched
- the test would duplicate another fake-provider case without covering a new behavior
- the slice is a verified no-op

## Boundaries

Do not implement during this automation:

- Git integration
- LSP
- arbitrary terminal or shell access
- new AI assistance surfaces outside the existing Agent Workbench boundary
- arbitrary command execution
- arbitrary path input UI
- plugin system
- project-wide analysis or indexing
- strong predictive autocomplete
- automatic lint fixes or broad formatting rewrites
- Pi RPC or SDK integration
- arbitrary provider configuration or provider-add UI
- Apple Developer ID signing or notarization completion
- merge editor
- advanced Git diff
- dependency or lockfile changes unless explicitly approved by the user

## Verification

For code changes, run:

```bash
npm run build:vite
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
git diff --check
```

For docs-only changes, run:

```bash
git diff --check
```

For UI behavior changes, also update or exercise `docs/smoke-checklist.md`. Use the built app when practical, and do not claim manual smoke passed unless it was actually exercised.

If built-app smoke launches `src-tauri/target/release/bundle/macos/hazakura editor.app`, quit the app before reporting. If Agent Workbench was running, stop the provider session or quit the app and confirm cleanup when practical.

For source-release prep, use `docs/source-release-checklist.md`. Do not claim release readiness until its P0 gates, dependency checks, and latest-HEAD built-app smoke evidence are recorded.

For DMG preview prep, use `docs/dmg-preview-checklist.md`. Do not attach a DMG to a release unless the user explicitly approves changing the release lane from source-only to DMG preview.

## Documentation Duties

Update only the docs that changed truth:

- `docs/current-status.md` for implemented behavior, verification results, risks, and next action.
- `docs/roadmap.md` when a phase, lane, or priority changes.
- `docs/external-agent-review-workflow.md` when implementation/review ownership changes.
- `docs/smoke-checklist.md` when manual checks change.
- `README.md` when user-facing features, limits, or run/build instructions change.
- `docs/archive/operations/next-goals-through-v0.7.md` only when preserving superseded goal-prompt history. Current reusable automation guidance belongs in this document.
- `docs/source-release-checklist.md` when source-release gates or boundaries change.

## Completion Rules

If checks pass and the slice is complete:

1. Stage only related files.
2. Commit with a concise message.
3. Push to the tracking branch over the configured HTTPS remote.
4. Report changed files, verification, commit hash, push result, residual risk, and the next small action.

If checks fail:

1. Do not commit or push.
2. Report the exact failing command and the most likely next fix.
3. Leave unrelated changes untouched.

## Reusable Automation Prompt

```txt
Advance hazakura-note during the v0.10 L Mode alpha release lane by one small, verifiable release-candidate quality-check, bug-fix, smoke-coverage, or documentation-alignment slice.

Start by reading AGENTS.md, README.md, docs/current-status.md, docs/roadmap.md, docs/smoke-checklist.md, docs/external-agent-review-workflow.md, docs/development-automation.md, and checking git status --short --branch. Treat existing uncommitted changes as user or previous-run work and do not revert them.

Use docs/development-automation.md as the source of truth. The roadmap lane is now v0.10 L Mode alpha release-candidate triage. Choose from this priority order: stale or failing quality gates; latest-HEAD built-app smoke gaps; one reproduced bug in implemented L Mode / workspace file ops / Agent provider availability behavior; safety-boundary regression checks; release docs/version drift; Markdown-first editor quality and daily-use polish; documentation drift; verified no-op if no useful small slice is safe.

Keep Agent Workbench limited to explicit mode gate, restart boundary, responsibility consent, allowlisted `codex` / `opencode` / `pi` / `claude` providers, one selected workspace root, and one active session. Keep Pi and Claude Code only as local CLI providers in the existing provider model. Keep Review Desk work limited to existing explicit text/file comparison, low-prominence candidate review, candidate apply-to-buffer, and recovery review behavior unless the user explicitly asks to resume Review Desk feature work. Do not inspect or present Git repository state as an app feature. Do not implement Git integration, LSP, arbitrary terminal/shell access, arbitrary command execution, arbitrary path input UI, session restore, auto-apply, auto-commit, provider-add UI, plugin systems, project-wide indexing beyond the bounded Global Search grep, strong predictive autocomplete, automatic lint fixes, broad formatting rewrites, signing/notarization completion, merge editor, advanced Git diff, Pi RPC/SDK work, Claude-specific permission/MCP/argument UI, arbitrary provider configuration, Tree Rename/Delete, persistent review/session logs, editable two-column Review Desk, Foundation Models-backed behavior, Frontmatter, KaTeX, encoding conversion beyond the shipped text-encoding controls, or dependency/lockfile changes without explicit user approval. Release/publish/tag flow is allowed only when the user explicitly opens a release lane. The current `glib` / `GHSA-wrw7-89jp-8q8g` Dependabot alert is already triaged as a Linux Tauri/wry GTK/WebKit dependency item; revisit it only for Linux support, a Tauri/wry dependency-refresh lane, distribution-readiness sign-off, severity escalation, or a compatible patched upstream path.

For substantial implementation, automation changes, Git/GitHub mutation, release work, or command-selection uncertainty, run Hazakura Habitat first and read agent_context.md before continuing. Consult command_policy.md before risky or mutating commands.

Choose exactly one coherent slice that can fit the temporary hourly cadence. In external-agent review mode, review the existing diff first and do not implement unrelated fixes unless the user asks for review-and-fix. Prefer one narrow built-app smoke section from docs/smoke-checklist.md when UI behavior changed, fix only the smallest actionable quality issue found, update the relevant docs, and verify it. Do not decide verified no-op from documentation review alone when app inspection is practical; before no-op, inspect the current app surface through built-app smoke or Vite/browser smoke, or state why app inspection was skipped. If built-app smoke opens hazakura-note, quit the app before final reporting and do not leave Agent provider sessions running. Do not add test code merely to create activity across repeated runs. Add or change tests only for reproduced bugs, backend/safety contracts, Agent lifecycle/gate/output/input/stop/exit/external-change behavior, Review Desk candidate/apply safety, or high-value fake-provider coverage. Prefer docs or manual smoke notes for UI wording, menu placement, visual density, and verified no-op slices.

For code changes run npm run build:vite, cargo fmt --manifest-path src-tauri/Cargo.toml -- --check, cargo test --manifest-path src-tauri/Cargo.toml, npm run build, and git diff --check. For docs-only changes run git diff --check. For UI behavior changes, update or exercise docs/smoke-checklist.md and do not claim manual smoke passed unless it was actually exercised. For source-release prep, follow docs/source-release-checklist.md and do not tag or publish without explicit user approval. For DMG preview prep, follow docs/dmg-preview-checklist.md and keep it separate from source-only release approval. Keep published tags immutable; use a patch-release lane for release-critical fixes.

If checks pass, stage only related files, commit with a concise message, and push to the configured HTTPS tracking branch. If checks fail, do not commit or push; report the failing command and next fix.

Final report: selected slice, changed files, verification, commit hash and push result or reason not committed, residual risk, and the next small action.
```
