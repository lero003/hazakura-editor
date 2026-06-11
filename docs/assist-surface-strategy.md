# Assist Surface Strategy

Status: Planning
Scope: Future assist and agent surface direction
Authority: Medium
Last reviewed: 2026-06-10

## Purpose

This document records the future direction for separating assist and agent features from the Markdown-first Safe Editor.

The goal is not to build a general AI platform in `hazakura editor`. The goal is to keep the core editor safe and understandable while leaving a clean path to move optional assist features between:

- the current External Agent Workbench model
- a future Apple Local Assist model based on Apple's Foundation Models framework
- future OS-provided assist surfaces, if they can fit the same boundary

## Decision

`hazakura editor` should treat assist features as a detachable or separately gated surface rather than as part of the default Safe Editor.

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
+ may later host Apple Local Assist document helpers
+ must remain removable from the default Safe Editor experience
```

This is an architectural direction, not approval to add a provider plugin system.

For the post-v0.11 distribution plan, use [Apple Local Assist And Distribution Plan](apple-local-assist-distribution-plan.md) as the detailed planning memo. For the user-facing Apple Local Assist experience, use [Apple Local Assist Writing Companion Plan](apple-local-assist-writing-companion-plan.md).

## Provider Shape

Use provider separation to keep responsibilities clear, but do not expose arbitrary provider configuration to users.

Initial conceptual provider classes:

- `external-cli`: existing Agent Workbench provider family for allowlisted local CLI agents.
- `apple-local`: macOS-only experimental document-assist provider using Apple's on-device model when available.
- `none`: Safe Editor default with no assist provider active.

Do not add `local-http`, MCP, arbitrary executable paths, provider-add UI, or generic tool/plugin registration without a fresh boundary review.

Implementation note (v0.12 work-in-progress): the Preferences dialog now exposes this as a restart-applied shared outside companion-slot choice (`Apple Local Assist (Experimental)` / `CLI Agent` / `Off`). Selecting `CLI Agent` continues to use the existing Agent Workbench restart-required mode gate, consent, and allowlisted provider selection. Selecting `Apple Local Assist` switches the normal companion button to the Apple Local Assist window after restart and shows alpha / availability disclosure; it does not enable CLI launch, provider selection, or Agent Workbench consent.

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

## Apple Local Assist

Apple Local Assist is an **alpha / experimental** local writing-help surface. It is a possible replacement or alternative for some lightweight text-assist workflows after v0.11, but it is not the main AI feature and not a replacement for external agents or future local LLM runtimes.

Apple documents the Foundation Models framework as access to the on-device language model that powers Apple Intelligence, with support for text understanding and generation tasks such as summarization, extraction, classification, and refinement. Apple also documents that availability must be checked at runtime because it depends on Apple Intelligence support, user settings, and model readiness.

References:

- [Foundation Models](https://developer.apple.com/documentation/foundationmodels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/foundationmodels/generating-content-and-performing-tasks-with-foundation-models)

For `hazakura editor`, Apple Local Assist should start as a document-writing companion, not as an agent. The strongest product shape is an external Assist Window that uses the same broad "outside companion" slot as Agent Workbench, while keeping a different UI and trust boundary. The app should normally show either Apple Local Assist or External Agent Workbench, not both side by side.

Short user-facing distinction:

- **Apple Local Assist**: experimental on-device text help for selected text or the current writing context; useful for short summaries, rephrasing, heading / tag ideas, light cleanup, and small direct edits that remain unsaved and diff-reviewable.
- **External Agent Workbench**: explicit CLI-agent boundary for allowlisted external tools such as Codex / OpenCode / pi / Claude Code in a selected workspace; useful for agent-led development work, but outside the default Safe Editor trust boundary.

The companion should work naturally with L Mode and accept rough writing requests:

- "整えて" / "自然にして" / "校正して"
- "続きを書いて"
- "この段落を短くして"
- "この章を直して"
- "変更点を説明して"

The request target should stay bounded: selected text when present, otherwise the current paragraph / block / section, and only with explicit user choice a larger document excerpt.

Because the current Apple model path is small and availability-gated, product claims should stay modest. Apple Local Assist is not intended for code review, multi-file understanding, long-document restructuring, autonomous agent work, broad design judgment, or advanced reasoning.

Apple Local Assist may update the unsaved editor buffer directly **only** as an AI edit transaction: explicit user request, before/after record, source label, no auto-save, and a path to Diff / change history. Manual Review Desk entry points are not the primary Apple Local Assist surface.

The companion may show compact operation feedback so users can
understand alpha behaviour during real-app smoke.  This should be an
ephemeral UI trail of app-known events (target acquired, request sent,
generation started, applied, failed), not raw Foundation Models prompts,
responses, hidden instructions, provider transcripts, or model
reasoning.  It must not become a persistent log, diagnostics payload, or
general chat history.

Apple Local Assist must not start as:

- a general chat surface
- a coding agent
- a tool-calling automation layer with side effects
- background project indexing
- automatic rewriting
- automatic file application
- command execution
- network-backed provider fallback

## Implementation Boundary

If Apple Local Assist is implemented, prefer a narrow macOS helper, sidecar, or similarly inspectable Swift boundary instead of mixing macOS-only model code into the cross-platform editor core.

A possible shape:

```txt
hazakura editor
  -> structured request for selected text / current writing context
hazakura-apple-assist-helper
  -> Foundation Models framework
hazakura editor
  <- structured candidate output / edit proposal
AI edit transaction
  -> unsaved buffer change, Diff / history remains available
```

The helper must receive only the text needed for the selected task. It should not receive broad workspace context by default.

Apple Local Assist may reuse Agent Workbench implementation patterns such as availability probes, active-vs-preference state, restart-required preference changes, and explicit consent. It must not inherit Agent Workbench's CLI trust boundary or become a tool-calling agent. In user-facing docs, describe it as an Assist Surface provider class rather than a CLI-agent provider.

## Store And Distribution Variants

Current submission work uses build-time variants rather than runtime settings alone:

- App Store build: Safe Editor, L Mode, Diff / explicit change review, and local export; no External Agent Workbench, no CLI launch, no Apple Local Assist helper, no external AI/API calls, no arbitrary process execution, no provider-add UI, and no custom updater.
- Developer / GitHub build: Safe Editor feature set plus optional Apple Local Assist and External Agent Workbench when their boundaries remain explicit; this lane may carry warning-expected DMG previews until Developer ID signing and notarization are ready.

Build-time separation is preferred for distribution trust because it is easier to explain and audit than hiding risky features behind settings.

Do not create a separate "official free build" by default. An official website can explain the product and route users to the App Store build or GitHub developer build without owning a third binary lane.

## Shipped Assist Path And Current Lane

v0.11 shipped L Mode WYSIWYG-tier polish without adding Apple Local Assist. Later assist work stayed narrow and tested the Writing Companion experience rather than treating selected-text command-palette entries as the final UX.

Recommended sequence:

1. v0.12 shipped Apple Local Assist planning and alpha live-helper foundation: availability detection, rough writing requests, AI edit transaction, unavailable-state UI, and Diff / discard escape hatches.
2. v0.13 shipped the distribution probe: App Store / Developer build separation, sandbox / entitlement draft, and helper parent-spawn proof for the then-current Apple Local Assist experiment.
3. v0.14 shipped L Mode stability plus bounded Apple Local Assist harness polish: target-centered document context, safer context snapping, L Mode review-sheet horizontal-scroll cleanup, and localized apply-error copy.
4. v0.15-v0.17 carried user-test polish, App Store-quality request packets, and warning-expected DMG preview evidence. Treat those notes as historical background, not the active queue.
5. For current UX and submission-prep work, start from `docs/current-work.md` and `docs/app-store-build.md`. Apple Local Assist remains a Developer / GitHub lane document-assist surface, and current App Store work must omit both External Agent Workbench and Apple Local Assist helper.
6. Use v1.0 as the App Store Candidate only if the App Store build can omit External Agent Workbench, CLI launch, Apple Local Assist helper, and external AI/API calls cleanly.

## Non-Goals

This strategy is not approval for:

- generic agent orchestration
- arbitrary local HTTP providers
- MCP integration
- provider plugins
- multiple agent sessions
- broad workspace indexing
- background assist tasks
- hidden or irreversible AI output application
- Git, terminal, LSP, debugger, package manager, or build integration

If a future proposal needs any of those behaviors, it must receive a fresh product and security boundary review before implementation.
