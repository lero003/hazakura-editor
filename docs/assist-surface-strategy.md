# Assist Surface Strategy

Status: Planning
Scope: Future assist and agent surface direction
Authority: Medium
Last reviewed: 2026-08-16 (v2.6 conversation / Diff separation + Core AI intent)

## Purpose

This document records the future direction for separating assist and agent features from the Markdown-first Safe Editor.

The goal is not to build a general AI platform in `Hazakura Editor`. The goal is to keep the core editor safe and understandable while leaving a clean path to move optional assist features between:

- the current External Agent Workbench model
- a future Hazakura Local Assist model based on Apple's Foundation Models framework
- future OS-provided assist surfaces, if they can fit the same boundary

## Decision

`Hazakura Editor` should treat assist features as a detachable or separately gated surface rather than as part of the default Safe Editor.

The design target is:

```txt
Safe Editor
=
Markdown/text reading, editing, preview, file comparison, explicit change review, export
+ no general terminal
+ no arbitrary command execution
+ no project-wide agent behavior

Assist Surface
=
optional, explicitly opened helper surface
+ may host allowlisted External Agent Workbench sessions
+ may later host Hazakura Local Assist document helpers
+ must remain removable from the default Safe Editor experience
```

This is an architectural direction, not approval to add a provider plugin system.

The former detailed Local Assist distribution and Writing Companion memos are
preserved under `docs/archive/planning/`. Use this strategy together with
`docs/app-store-build.md` for current decisions; archived memos are historical
context only.

## Provider Shape

Use provider separation to keep responsibilities clear, but do not expose arbitrary provider configuration to users.

Initial conceptual provider classes:

- `external-cli`: existing Agent Workbench provider family for allowlisted local CLI agents.
- `apple-local`: macOS-only experimental document-assist provider using Apple's on-device model when available.
- `none`: Safe Editor default with no assist provider active.

Do not add `local-http`, MCP, arbitrary executable paths, provider-add UI, or generic tool/plugin registration without a fresh boundary review.

Implementation note (v0.29 pre-submission): the Preferences dialog now exposes this as a restart-applied shared outside companion-slot choice (`Hazakura Local Assist (Preview)` / `CLI Agent` / `Off`). Selecting `CLI Agent` continues to use the existing Agent Workbench restart-required mode gate, consent, and allowlisted provider selection. Selecting `Hazakura Local Assist` switches the normal companion button to the Hazakura Local Assist window after restart and shows preview / availability disclosure; it does not enable CLI launch, provider selection, or Agent Workbench consent.

## External Agent Workbench

External Agent Workbench remains a separate trust boundary governed by [Agent Workbench Boundary](agent-workbench-boundary.md).

It may launch only allowlisted local CLI providers. The current boundary remains:

- explicit enablement
- restart-required mode change
- responsibility-boundary consent
- selected workspace root
- one active session
- no session restore
- no provider-add UI
- no arbitrary command field
- no Git client behavior
- no auto-apply, auto-commit, auto-push, or auto-publish

Claude Code CLI is implemented as an additional `external-cli` provider, but only through this same boundary. Treat it as provider availability, not as a replacement for Agent Workbench or as approval for Claude-specific permission controls, MCP configuration, arbitrary arguments, Git integration, provider-add UI, or auto-apply.

Moving Agent Workbench into a detached window or separate surface does not weaken these requirements.

## Hazakura Local Assist

Hazakura Local Assist is a **preview** local writing-help surface. It is a possible replacement or alternative for some lightweight text-assist workflows after v0.11, but it is not the main AI feature and not a replacement for external agents or future local LLM runtimes.

Apple documents the Foundation Models framework as access to the on-device language model that powers Apple Intelligence, with support for text understanding and generation tasks such as summarization, extraction, classification, and refinement. Apple also documents that availability must be checked at runtime because it depends on Apple Intelligence support, user settings, and model readiness.

References:

- [Foundation Models](https://developer.apple.com/documentation/foundationmodels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/foundationmodels/generating-content-and-performing-tasks-with-foundation-models)

For `Hazakura Editor`, Hazakura Local Assist should start as a document-writing companion, not as an agent. The strongest product shape is an external Assist Window that uses the same broad "outside companion" slot as Agent Workbench, while keeping a different UI and trust boundary. The app should normally show either Hazakura Local Assist or External Agent Workbench, not both side by side.

Short user-facing distinction:

- **Hazakura Local Assist**: preview on-device text help for selected text or the current writing context; useful for short summaries, rephrasing, heading / tag ideas, light cleanup, and small direct edits that remain unsaved and diff-reviewable.
- **External Agent Workbench**: explicit CLI-agent boundary for allowlisted external tools such as Codex / OpenCode / pi / Claude Code in a selected workspace; useful for agent-led development work, but outside the default Safe Editor trust boundary.

The companion should work naturally with L Mode and accept rough writing requests:

- "整えて" / "自然にして" / "校正して"
- "続きを書いて"
- "この段落を短くして"
- "この章を直して"
- "変更点を説明して"

The request target should stay bounded: selected text when present, otherwise the current paragraph / block / section, and only with explicit user choice a larger document excerpt.

Because the current Apple model path is small and availability-gated, product claims should stay modest. Hazakura Local Assist is not intended for code review, multi-file understanding, long-document restructuring, autonomous agent work, broad design judgment, or advanced reasoning.

### Conversational document edit (v2.6 A-2 candidate)

v2.6 moves Local Assist from **single-shot generate → immediate buffer apply**
toward a **proposal-first multi-turn revision conversation**:

1. Pin a document target on the first user request.
2. Use a conversation area for requests and short turn state.
3. Generate and refine an **unapplied proposal** in a separate Diff review area.
4. Apply to the unsaved editor buffer **only** from explicit “文書へ反映”.
5. Record an AI edit transaction and keep Diff / Review Bar discard.

Design SoT: `docs/local-assist-conversational-edit-ux.md`.
Plan IDs A-1–A-4 are recorded in `docs/v2.6-plan.md`.

A-1 is merged and the current A-2 candidate keeps the target pinned and the
proposal unapplied. A-3 explicit apply is not implemented yet; do not document
the v2.6 candidate as a released product surface.

Local Assist may keep a **bounded, document-scoped revision conversation**
for the active editing session (in-memory only). It must not become a
persistent general-purpose chat history, workspace-wide assistant, or
autonomous agent transcript.

The conversation is a control surface for refining the current proposal, not
the proposal viewer itself. User turns and short assistant state belong in the
conversation area. The full candidate text, original-versus-candidate Diff,
stale state, discard, and explicit apply belong in the separate Diff review
area. Narrow windows may stack those regions, but must not merge their
responsibilities.

Operation feedback (target acquired, request sent, generation started,
applied, failed) stays compact and must not be shown as chat turns or as
raw Foundation Models prompts, hidden instructions, provider transcripts,
or model reasoning.

Hazakura Local Assist may update the unsaved editor buffer **only** as an
AI edit transaction after explicit apply (v2.6) or, until migration, the
current single-shot path: before/after record, source label, no auto-save,
and a path to Diff / change history. Manual Review Desk entry points remain
retired from the primary Local Assist surface.

Hazakura Local Assist must not start as:

- a general chat surface (unrelated Q&A, search, workspace free chat)
- a coding agent
- a tool-calling automation layer with side effects
- background project indexing
- automatic rewriting
- automatic file application
- command execution
- network-backed provider fallback

## Implementation Boundary

If Hazakura Local Assist is implemented, prefer a narrow macOS helper, sidecar, or similarly inspectable Swift boundary instead of mixing macOS-only model code into the cross-platform editor core.

A possible shape:

```txt
Hazakura Editor
  -> structured request for selected text / current writing context
  -> (v2.6) revision packet: original + current proposal + recent user turns
hazakura-local-assist-helper
  -> Foundation Models framework  (primary)
  -> optional Core AI allowlisted writing model  (later)
Hazakura Editor
  <- structured candidate / proposal -> unapplied Diff review
explicit apply from Diff review
  -> AI edit transaction on unsaved buffer -> post-apply Review Bar / history
```

The helper must receive only the text needed for the selected task. It should not receive broad workspace context by default.

## Core AI — Allowlisted Writing Models (later)

Product intent for a **later** lane (not the v2.6 A-1 implementation slice):

- **Why:** Foundation Models (Apple Intelligence path) remains the default
  brain. When writing-specific quality or specialization is still missing,
  ship a narrow path to run **curated writing-oriented on-device models**.
- **What users can do:** download, list, delete, and select for Local Assist
  **only models on an app-maintained allowlist** (packaging may be platform
  Core AI / `.aimodel`-class artifacts — exact format is an implementation
  detail of the C-0 spike).
- **What users cannot do:** paste arbitrary URLs, load unsigned blobs, add
  generic “any GGUF”, or fall back to cloud inference when local models fail.

Hard rules:

- Allowlist entries are versioned, digest- or signature-verified, size-capped.
- Network is for **catalog download only**; generation stays on-device.
- Selecting a Core AI model does not weaken proposal-first apply consent,
  Diff / discard, or no auto-save.
- App Store vs Developer disclosure must stay honest about download size and
  on-device-only claims.
- Do not build a model marketplace UI or provider-add surface.

Sequence: C-0 design spike → C-1 lifecycle → C-2 Assist selection
(`docs/v2.6-plan.md`). Do not start C-1 until conversational apply (A-3) is
stable enough that a second model backend will not fork two UX stories.

Hazakura Local Assist may reuse Agent Workbench implementation patterns such as availability probes, active-vs-preference state, restart-required preference changes, and explicit consent. It must not inherit Agent Workbench's CLI trust boundary or become a tool-calling agent. In user-facing docs, describe it as an Assist Surface provider class rather than a CLI-agent provider.

## Store And Distribution Variants

Current submission work uses build-time variants rather than runtime settings alone:

- App Store build: Safe Editor, L Mode, Diff / explicit change review, local export, and Hazakura Local Assist as an on-device, availability-gated writing companion; no External Agent Workbench, no CLI launch, no external AI/API calls, no arbitrary process execution, no provider-add UI, no network fallback, and no custom updater.
- Developer / GitHub build: Safe Editor feature set plus optional External Agent Workbench when its boundary remains explicit; this lane may carry warning-expected DMG previews until Developer ID signing and notarization are ready.

Build-time separation is preferred for distribution trust because it is easier to explain and audit than hiding risky features behind settings.

Do not create a separate "official free build" by default. An official website can explain the product and route users to the App Store build or GitHub developer build without owning a third binary lane.

## Shipped Assist Path And Current Lane

v0.11 shipped L Mode WYSIWYG-tier polish without adding Hazakura Local Assist. Later assist work stayed narrow and tested the Writing Companion experience rather than treating selected-text command-palette entries as the final UX.

Recommended sequence:

1. v0.12 shipped Hazakura Local Assist planning and alpha live-helper foundation: availability detection, rough writing requests, AI edit transaction, unavailable-state UI, and Diff / discard escape hatches.
2. v0.13 shipped the distribution probe: App Store / Developer build separation, sandbox / entitlement draft, and helper parent-spawn proof for the then-current Hazakura Local Assist experiment.
3. v0.14 shipped L Mode stability plus bounded Hazakura Local Assist harness polish: target-centered document context, safer context snapping, L Mode review-sheet horizontal-scroll cleanup, and localized apply-error copy.
4. v0.15-v0.17 carried user-test polish, App Store-quality request packets, and warning-expected DMG preview evidence. Treat those notes as historical background, not the active queue.
5. For current UX and submission-prep work, start from `docs/current-work.md` and `docs/app-store-build.md`. Hazakura Local Assist may be exposed in the App Store lane only as a bounded on-device writing companion; External Agent Workbench remains out of that lane.
6. Use v1.0 as the App Store Candidate only if the App Store build can keep External Agent Workbench, CLI launch, arbitrary command execution, external AI/API calls, and network fallback out cleanly.

## Non-Goals

This strategy is not approval for:

- generic agent orchestration
- arbitrary local HTTP providers
- MCP integration
- provider plugins or arbitrary model URL loaders
- multiple agent sessions
- broad workspace indexing
- background assist tasks
- hidden or irreversible AI output application
- persistent general-purpose chat databases
- Git, terminal, LSP, debugger, package manager, or build integration

Allowlisted Core AI writing models (later) are a **narrow exception** for
curated on-device packages only; they are not a generic model marketplace.

If a future proposal needs any of those behaviors, it must receive a fresh product and security boundary review before implementation.

## Active Lane Pointer

For the current implementation queue, start at `docs/current-work.md` and
`docs/v2.6-plan.md`. v2.5 is released and closed; do not treat older alpha ship
notes in this file as the active slice list.
