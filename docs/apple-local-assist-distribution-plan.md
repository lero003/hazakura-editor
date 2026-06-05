# Apple Local Assist And Distribution Plan

Status: Planning
Scope: v0.12+ Apple Local Assist direction and App Store / developer-build release lanes
Authority: Medium
Last reviewed: 2026-06-05

## Implementation Snapshot (v0.12, in-progress)

The first 5 slices of the Apple Local Assist work-stream are landed. Code, not policy:

- **Types and boundary** — `src/lib/tauri/appleAssist.ts` + `src-tauri/src/commands/apple_assist.rs` define the 4-state availability enum, the 5-operation request shape, `MAX_SELECTED_CHARS=4000`, `MAX_CONTEXT_CHARS=8000` (char-count, not byte-count), and the `*_with_label` shim gated by `ensure_label_is_main` (main window only; the agent window is explicitly rejected, even though `ensure_label_is_main_or_agent` exists). Stub implementations only; no Foundation Models binding.
- **Availability probe** — `useAppleAssistAvailability` defaults to `unsupported`, calls `probe_apple_assist_availability` on mount, maps IPC failure to `unavailable` with a reason. The probe is cached per mount.
- **Review Desk handoff** — `useAppleAssistCandidate.generateAndCompare(operation, selectedText)` calls `generateAppleAssistCandidate` and hands the response to the existing `runCandidateCompare` with `candidateSourceLabel: copy.candidateSourceAppleAssist`. **No auto-apply.** The candidate flows through the same explicit-apply UX as the manual paste flow.
- **UI entry** — Two command palette entries (`Summarize selection`, `Rephrase selection`) gated on availability. Hidden when the probe is not `available`. Sit under a new `Apple Assist` command category that is locale-aware (`あっぷる あしす と` in kana, `Apple Assist` otherwise).
- **Swift helper feasibility (fixture mode)** — `src-helpers/apple-assist/` is a SwiftPM executable. `npm run build:apple-assist-helper:fixture` compiles it and writes `binaries/hazakura-apple-assist-helper-<rust-triple>`. The fixture build (no FoundationModels import) returns canned candidate JSON whose prefix matches the Rust stub (`【要約案】`, `【書き換え案】`). Smoke test in the build script asserts both envelopes.

- **Gate-default-hidden contract** — the Rust probe returns `Unavailable { reason: "Foundation Models binding is not yet implemented in this build." }` on macOS and `Unsupported` elsewhere in v0.12. It must never return `Available` until a future slice lands a real Foundation Models binding; the React side hides the command palette entries whenever the probe is not `Available`, and the stub generate response carries `modelId: "stub:v0.12"` so a future regression is easy to spot.

What is **not** done yet, and is gated on explicit approval:

- `tauri.conf.json` is unchanged — no `bundle.externalBin`, no `minimumSystemVersion` bump
- `bundle_identifier` and code-signing entitlements are untouched
- No live (non-fixture) Foundation Models binding; `live mode` falls back to `unsupported` / `deferred`
- No App Store sandbox or TestFlight changes
- No release tag, no GitHub Release, no App Store submission

## Purpose

This memo turns the rough v0.12 Apple Local Assist idea into a release and architecture direction.

The goal is not to turn `hazakura editor` into a general AI agent platform. The goal is to make the existing Markdown-first editor feel more helpful by adding on-device document assistance where Apple Intelligence is available, while keeping every generated change explicit, reviewable, and reversible.

## Product Decision

Apple Local Assist should be treated as an **Assist Surface provider class**, not as a widening of Safe Editor and not as a CLI-agent provider.

The user-facing shape can still feel unified:

```txt
Assist Surface
=
none
or Apple Local document assist
or External Agent Workbench
```

But the trust boundaries stay different:

- **Safe Editor** remains the default text editor.
- **Apple Local Assist** is document help only: selected text or a document excerpt in, candidate text out.
- **External Agent Workbench** remains the separate CLI-agent trust boundary.

Implementation may reuse Agent Workbench patterns such as active-vs-preference state, restart-required changes, availability probes, and explicit consent. It must not describe Apple Local Assist as a CLI agent, tool-calling automation layer, shell, provider plugin, or automatic edit system.

## Initial Apple Local Assist Scope

v0.12 should start with the smallest useful document-assist surface:

- summarize selected text or the current section
- rephrase selected text
- optionally extract TODOs / headings / review points after the first two flows are stable

Every output must flow through Review Desk, Diff, or an equivalent explicit review/apply step before the document changes.

The first implementation must not include:

- generic chat
- background workspace indexing
- broad workspace context by default
- tool calling with side effects
- command execution
- local HTTP fallback
- external LLM fallback
- provider-add UI
- automatic file application
- automatic save

## Availability And Runtime Rules

Foundation Models is an on-device Apple Intelligence framework. It must be treated as optional at runtime, not as a hard requirement for the whole app.

Apple Local Assist must:

- check model availability before showing or enabling actions
- explain unavailable states without blocking Safe Editor
- send only the selected text or bounded document excerpt needed for the requested task
- cap input size before invoking the helper
- serialize requests or reject concurrent requests if the model/session cannot safely handle them
- expose no network-backed fallback in the App Store build

## Candidate Architecture

The current candidate shape is a narrow macOS helper boundary:

```txt
hazakura editor
  -> structured Apple Local Assist request
bundled Swift helper
  -> Foundation Models framework
hazakura editor
  <- structured candidate response
Review Desk / Diff
  -> explicit apply or discard
```

This keeps macOS-only model code away from the cross-platform editor core and makes the data boundary inspectable.

Open implementation questions before locking the design:

- whether the helper should be a bundled sidecar process or a Swift/AppKit integration layer
- whether the helper is acceptable under Mac App Store sandboxing in the final build
- whether Apple Local Assist should require restart-required preference changes or can be enabled dynamically
- whether the App Store build should raise the minimum macOS version, or whether only the Apple Local feature should be availability-gated

Do not raise the minimum OS for every distribution lane merely to support Apple Local Assist. Decide per build variant after the Foundation Models SDK and App Store sandbox proof is complete.

## Distribution Lanes

### App Store Build

Goal: a clean, sandboxed, reviewable build for ordinary users.

Include:

- Safe Editor
- L Mode
- Review Desk / Diff
- Apple Local Assist when available
- bounded workspace file access through user-selected files/folders

Exclude:

- External Agent Workbench
- CLI provider launch
- arbitrary process execution
- generic terminal behavior
- provider-add UI
- custom updater
- warning-expected unsigned/not-notarized messaging

This build should be prepared through TestFlight before App Store submission.

### Developer Build

Goal: preserve the current developer-oriented preview lane.

May include:

- External Agent Workbench
- allowlisted local CLI providers
- warning-expected DMG previews until the Developer ID lane is complete

Future Developer ID signing and notarization can make this build easier to share outside the App Store, but it should remain distinct from the App Store build if it includes CLI-agent behavior.

### Warning-Expected DMG Preview

Goal: continue short preview releases while distribution quality is still moving.

Rules:

- keep ad-hoc signing / no notarization explicit
- keep remote asset verification after publication
- do not describe this lane as App Store-ready or distribution-grade

## Release Sequence

### v0.12: Apple Local Assist Planning And Prototype

Target:

- availability probe
- selected-text summarize
- selected-text rephrase
- Review Desk / Diff handoff
- unavailable-state UI
- clear App Store build separation decision

Exit criteria:

- no Safe Editor behavior depends on Apple Local availability
- generated text never applies without explicit review
- App Store build exclusions are documented and testable
- Foundation Models acceptable-use and availability notes are reflected in release docs

### v0.13: Assist Preview

Target:

- add extract / proofread / explain-diff only if v0.12 is stable
- polish prompts and candidate labels
- verify App Store build can omit External Agent Workbench cleanly

### v0.14: Distribution Hardening

Target:

- App Store sandbox / entitlement review
- build variant automation
- TestFlight packaging
- App Review notes draft
- separate Developer ID / notarization plan for non-App-Store builds

### v1.0: App Store Candidate

Target:

- TestFlight feedback incorporated
- App Store build submitted with Safe Editor + Apple Local Assist only
- Developer build remains separate if Agent Workbench continues

## App Review Notes To Prepare

Before App Store submission, prepare concise review notes that explain:

- the app is a Markdown/text editor
- Apple Local Assist is optional and on-device
- the app checks availability at runtime
- generated text is shown as a candidate and requires explicit user review/apply
- the App Store build does not include External Agent Workbench or arbitrary command execution
- file access is user-selected and workspace-bounded

## References

- [Assist Surface Strategy](assist-surface-strategy.md)
- [Security Boundary](security-boundary.md)
- [Agent Workbench Boundary](agent-workbench-boundary.md)
- [Foundation Models](https://developer.apple.com/documentation/FoundationModels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models)
- [Acceptable use requirements for the Foundation Models framework](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
