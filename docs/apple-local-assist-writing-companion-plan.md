# Apple Local Assist — Writing Companion Plan

Status: Planning
Scope: v0.12+ Apple Local Assist user experience direction
Authority: Medium
Last reviewed: 2026-06-05

## Purpose

This memo records the updated product direction for Apple Local Assist after the v0.11 L Mode release.

The important change is that Apple Local Assist should not be treated mainly as a command-palette selected-text helper. The stronger product shape is an external writing companion that can help the user from beside the editor, especially while the user is writing in L Mode.

## Product Decision

Apple Local Assist should be an **external Writing Companion / Assist Window**.

It is conceptually close to the detached Agent Window because it lives outside the main editor surface, but it does not share the same trust boundary or UI. The user should normally see either:

- External Agent Workbench, or
- Apple Local Assist Writing Companion

not both at the same time. Treat this as a single external companion slot with different provider classes.

Apple Local Assist is still document assistance, not a CLI agent. It must not become command execution, tool calling, provider plugins, broad workspace indexing, or a general chat product.

## Experience Target

The target experience is:

1. The user writes in Safe Editor or L Mode.
2. The user opens the Apple Local Assist companion.
3. The user gives a rough request, such as "整えて", "続きを書いて", "自然にして", "校正して", or "この章を直して".
4. The app infers a bounded target from the current writing context:
   - selected text, if present
   - otherwise the current paragraph or block
   - otherwise the current section
   - only with explicit user choice, a larger document excerpt
5. Apple Local Assist proposes or applies an edit as an **AI edit transaction**.
6. The user can inspect what changed through Diff / change history, then save explicitly.

The product should be forgiving of vague instructions. Many writers cannot or will not describe the exact operation they want. The UI should make rough intent usable rather than requiring the user to know whether they need "summarize", "rephrase", "proofread", or "extract".

## L Mode Priority

L Mode is the primary authoring experience for v0.11+. Apple Local Assist should be useful there.

The companion can stay outside the document, but its actions should feel like they affect the current writing surface. The user should not need to leave L Mode just to ask for a broad prose improvement. When review details are needed, the app may open the normal Diff / Review layer as an escape hatch.

## Direct Edit Model

The old "no auto-apply" rule should not be read as "AI can never write into the editor buffer." The updated rule is:

- no auto-save
- no hidden or irreversible edits
- no background rewriting
- no edits without an explicit user request
- every AI-written buffer change must be recorded as an AI edit transaction
- AI edits must remain reviewable through Diff / change history before the user saves

An AI edit transaction should record at least:

- source: Apple Local Assist
- operation or request text
- target range / document scope
- before text
- after text
- timestamp
- whether the transaction is still unsaved

The ideal future state is that human edits and AI edits can be separated in change history or diff views. That is not required for the first mock, but the data model should avoid making it impossible.

## Review Desk Role

Review Desk remains useful, but it should not be the primary Apple Local Assist experience.

Use Review Desk / Diff as the detailed inspection layer:

- compare AI change against the previous buffer
- inspect stale or conflicting candidate state
- recover from an unwanted edit
- review larger replacements before saving

Do not force every Apple Local Assist action to start inside Review Desk. The companion should help the user write first; review surfaces should appear when they clarify or protect the edit.

## Current v0.12 Implementation Status

Existing v0.12 slices are still useful foundation work:

- availability types and gate-default-hidden behavior
- main-window-only IPC boundary
- helper fixture / supervisor / watchdog / cooldown
- locale and command-palette plumbing
- Review Desk handoff prototype

However, the command-palette selected-text entries should be treated as early plumbing, not the final product shape.

## First Mock Slice

Before flipping any live Foundation Models gate, build a touchable mock that proves the experience:

1. Add an external Apple Local Assist companion slot that replaces, rather than coexists with, the Agent Window slot.
2. Support fixture-only rough requests against the current editor context.
3. Let the mock directly update the unsaved editor buffer through an AI edit transaction.
4. Show a compact "AI changed this" affordance with a path to Diff / change history.
5. Smoke in L Mode and normal editor mode.

The mock may use deterministic fixture output. It does not need live Foundation Models.

## Non-Goals

This plan is not approval for:

- live Foundation Models gate flip
- `tauri.conf.json` `bundle.externalBin`
- minimum macOS version changes
- App Store submission changes
- network-backed LLM fallback
- provider-add UI
- tool calling
- shell / Git / LSP / package-manager integration
- auto-save
- background AI rewriting
