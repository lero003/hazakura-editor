# External Agent Review Workflow

Status: Operational
Scope: External implementation agent plus Codex review workflow
Authority: High
Last reviewed: 2026-06-01

## Purpose

Use this workflow when another agent implements a small Hazakura slice and Codex is asked to review it before acceptance.

The goal is not to make two agents race. The goal is to separate implementation from review so boundary regressions, over-claims, and missing verification are caught before a slice becomes part of the roadmap.

## Roles

External implementation agent:

- chooses one explicitly approved slice from `docs/roadmap.md`, `docs/next-goals.md`, or a user prompt
- implements only that slice
- preserves Safe Editor Mode as primary
- keeps Agent Workbench behind its existing explicit trust boundary
- runs the required checks for the slice
- reports changed files, verification, known risks, and any skipped smoke

Codex reviewer:

- reviews the external agent's diff from a code-review stance
- prioritizes bugs, boundary regressions, missing tests, unsafe file/path behavior, and docs claims that exceed implementation
- checks whether the slice matches the roadmap and project docs
- runs focused verification when practical
- reports findings before summaries
- does not silently broaden the slice while reviewing

## External Agent Contract

Before implementation, the external agent should read:

- `AGENTS.md`
- `README.md`
- `docs/current-status.md`
- `docs/roadmap.md`
- `docs/development-automation.md`
- `docs/external-agent-review-workflow.md`
- any boundary document directly touched by the slice, especially `docs/security-boundary.md` or `docs/agent-workbench-boundary.md`

Implementation rules:

- Pick one coherent slice only.
- Do not add Git integration, LSP, arbitrary command execution, general terminal behavior, plugin systems, project-wide indexing, Agent auto-apply, Agent auto-commit, provider-add UI, or session restore.
- Do not implement signing, notarization, updater, or paid-distribution work unless the user explicitly opens that lane.
- Do not treat Review Desk as a Git client or merge tool.
- Do not route Agent output directly into the editor body. Candidate text must go through a review surface before any explicit user accept path is added.
- Do not change dependencies or lockfiles without explicit user approval.
- Keep docs claims honest: preview, advisory, designed to, and warning-expected wording are preferred until behavior is proven.

Verification:

- For code changes, run the project quality gates from `docs/development-automation.md`.
- For docs-only changes, run `git diff --check`.
- For UI behavior changes, update or exercise `docs/smoke-checklist.md`; do not claim smoke passed unless it was actually exercised.

## Codex Review Contract

Codex review should start by reading the same source docs plus the external agent's summary.

Review order:

1. Check the diff scope against the approved slice.
2. Check Safe Editor and Agent Workbench boundaries.
3. Check file/path handling, destructive operations, and persistence locations.
4. Check tests, smoke evidence, and docs updates.
5. Run focused verification where practical.
6. Report findings first, ordered by severity, with file and line references.

If there are no blocking findings, say so clearly and name any residual test or smoke gaps.

Codex should patch issues only when the user asks for a follow-up fix, or when the review request explicitly includes "review and fix". Otherwise, Codex remains reviewer, not co-implementer.

## v0.7 Review Desk Review Focus

For `v0.7: Hazakura Review Desk Preview`, review these risks especially:

- Diff / Review UI becoming Git-shaped through labels such as stage, commit, branch, merge, checkout, or apply patch.
- Workspace grep becoming project-wide indexing or background analysis.
- Command palette exposing unsafe operations that were not already available through the app.
- Settings consolidation blurring Safe Editor Mode and Agent Workbench.
- Frontmatter or KaTeX preview widening external content loading or command execution.
- Encoding conversion corrupting line endings, final-newline behavior, or save-conflict protections.
- AI candidate work bypassing Review Desk and modifying editor text directly.

## Acceptance

A reviewed slice can be accepted when:

- the implementation matches the approved slice
- required checks passed or skipped checks are explicitly justified
- docs were updated only where truth changed
- Safe Editor Mode remains usable without Agent Workbench
- Agent Workbench remains opt-in, allowlisted, one-session, no-restore, and no-auto-apply
- Codex review has no unresolved blocking findings
