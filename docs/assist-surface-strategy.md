# Assist Surface Strategy

Status: Planning
Scope: Future assist and agent surface direction
Authority: Medium
Last reviewed: 2026-06-02

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

## Provider Shape

Use provider separation to keep responsibilities clear, but do not expose arbitrary provider configuration to users.

Initial conceptual provider classes:

- `external-cli`: existing Agent Workbench provider family for allowlisted local CLI agents.
- `apple-local`: future macOS-only document-assist provider using Apple's on-device model when available.
- `none`: Safe Editor default with no assist provider active.

Do not add `local-http`, MCP, arbitrary executable paths, provider-add UI, or generic tool/plugin registration without a fresh boundary review.

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

Moving Agent Workbench into a detached window or separate surface does not weaken these requirements.

## Apple Local Assist

Apple Local Assist is a possible future replacement or alternative for some assist workflows in v1.1 or later.

Apple documents the Foundation Models framework as access to the on-device language model that powers Apple Intelligence, with support for text understanding and generation tasks such as summarization, extraction, classification, and refinement. Apple also documents that availability must be checked at runtime because it depends on Apple Intelligence support, user settings, and model readiness.

References:

- [Foundation Models](https://developer.apple.com/documentation/foundationmodels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/foundationmodels/generating-content-and-performing-tasks-with-foundation-models)

For `hazakura editor`, Apple Local Assist should start as document assistance, not as an agent:

- summarize selected Markdown or the active document section
- extract headings, TODOs, review points, or frontmatter candidates
- explain a selected diff or candidate change
- shorten, rephrase, or proofread selected text
- generate candidate text that goes through Review Desk or explicit diff review before apply

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

If Apple Local Assist is implemented, prefer a narrow macOS helper or sidecar boundary instead of mixing macOS-only model code into the cross-platform editor core.

A possible shape:

```txt
hazakura editor
  -> structured request for selected text / current document excerpt
hazakura-apple-assist-helper
  -> Foundation Models framework
hazakura editor
  <- structured candidate output
Review Desk / Diff
  -> user explicitly applies or discards
```

The helper must receive only the text needed for the selected task. It should not receive broad workspace context by default.

## Store And Distribution Variants

Future distribution may use build-time variants rather than runtime settings alone:

- Safe Editor build: no External Agent Workbench code path.
- Official-site developer build: may include External Agent Workbench if the boundary remains explicit.
- Apple Local Assist build: may include macOS-only document helpers when availability and review requirements are understood.

Build-time separation is preferred for distribution trust because it is easier to explain and audit than hiding risky features behind settings.

## v0.8 To v1.1 Path

v0.8 should not try to complete an assist platform.

Recommended sequence:

1. Keep v0.8 focused on Safe Editor daily-use polish plus Assist Surface separation: reduce Review Desk to a low-prominence candidate-review receiver, clarify Agent Workbench surface/state boundaries, and keep generated output reviewable through Review Desk or Diff.
2. Use v0.9 and v1.0 to harden preview/distribution quality and prove Safe Editor remains coherent without assist behavior.
3. Treat Review Desk's full product usefulness as v1.1+ work, after Apple Local Assist / Foundation Models can generate selected-text or document-excerpt candidates that need explicit review.
4. Consider Apple Local Assist only after distribution requirements, availability handling, and explicit-review flows are designed.

## Non-Goals

This strategy is not approval for:

- generic agent orchestration
- arbitrary local HTTP providers
- MCP integration
- provider plugins
- multiple agent sessions
- broad workspace indexing
- background assist tasks
- direct agent output application
- Git, terminal, LSP, debugger, package manager, or build integration

If a future proposal needs any of those behaviors, it must receive a fresh product and security boundary review before implementation.
