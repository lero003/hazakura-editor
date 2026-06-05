# Assist Surface Strategy

Status: Planning
Scope: Future assist and agent surface direction
Authority: Medium
Last reviewed: 2026-06-05

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
Markdown/text reading, editing, preview, file comparison, Review Desk, export
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
- `apple-local`: future macOS-only document-assist provider using Apple's on-device model when available.
- `none`: Safe Editor default with no assist provider active.

Do not add `local-http`, MCP, arbitrary executable paths, provider-add UI, or generic tool/plugin registration without a fresh boundary review.

Implementation note (v0.12 work-in-progress): the Preferences dialog now exposes this as a restart-applied shared outside companion-slot choice (`Apple Assist` / `CLI Agent` / `Off`). Selecting `CLI Agent` continues to use the existing Agent Workbench restart-required mode gate, consent, and allowlisted provider selection. Selecting `Apple Assist` switches the normal companion button to the Apple Assist window after restart and shows fixture/live availability disclosure; it does not enable CLI launch and does not by itself flip the live Foundation Models helper gate.

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

Apple Local Assist is a possible future replacement or alternative for some assist workflows after v0.11.

Apple documents the Foundation Models framework as access to the on-device language model that powers Apple Intelligence, with support for text understanding and generation tasks such as summarization, extraction, classification, and refinement. Apple also documents that availability must be checked at runtime because it depends on Apple Intelligence support, user settings, and model readiness.

References:

- [Foundation Models](https://developer.apple.com/documentation/foundationmodels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/foundationmodels/generating-content-and-performing-tasks-with-foundation-models)

For `hazakura editor`, Apple Local Assist should start as a document-writing companion, not as an agent. The strongest product shape is an external Assist Window that uses the same broad "outside companion" slot as Agent Workbench, while keeping a different UI and trust boundary. The app should normally show either Apple Local Assist or External Agent Workbench, not both side by side.

The companion should work naturally with L Mode and accept rough writing requests:

- "整えて" / "自然にして" / "校正して"
- "続きを書いて"
- "この段落を短くして"
- "この章を直して"
- "変更点を説明して"

The request target should stay bounded: selected text when present, otherwise the current paragraph / block / section, and only with explicit user choice a larger document excerpt.

Apple Local Assist may update the unsaved editor buffer directly **only** as an AI edit transaction: explicit user request, before/after record, source label, no auto-save, and a path to Diff / change history. Review Desk remains a detailed inspection layer, not the primary Apple Local Assist surface.

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

Future distribution may use build-time variants rather than runtime settings alone:

- App Store build: Safe Editor, L Mode, Review Desk / Diff, and Apple Local Assist when available; no External Agent Workbench, no CLI launch, no arbitrary process execution, no provider-add UI, and no custom updater.
- Developer / GitHub build: App Store feature set plus External Agent Workbench when the boundary remains explicit; this lane may carry warning-expected DMG previews until Developer ID signing and notarization are ready.

Build-time separation is preferred for distribution trust because it is easier to explain and audit than hiding risky features behind settings.

Do not create a separate "official free build" by default. An official website can explain the product and route users to the App Store build or GitHub developer build without owning a third binary lane.

## Post-v0.11 Path

v0.11 shipped L Mode WYSIWYG-tier polish without adding Apple Local Assist. The next assist lane should stay narrow, but it should test the Writing Companion experience rather than treating selected-text command-palette entries as the final UX.

Recommended sequence:

1. Use v0.12 for Apple Local Assist planning and prototype: availability detection, fixture-backed Writing Companion mock, rough writing requests, AI edit transaction, unavailable-state UI, and Diff / history escape hatches.
2. Use v0.13 for Assist Preview only after v0.12 is stable: add live Foundation Models binding and broader proofreading / continuation flows if prompt quality and review UX are strong enough.
3. Use v0.14 for Distribution Hardening: App Store build separation, sandbox / entitlement checks, TestFlight packaging, and App Review notes.
4. Use v1.0 as the App Store Candidate if the App Store build can omit External Agent Workbench cleanly and Apple Local Assist remains document-assist only.

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
