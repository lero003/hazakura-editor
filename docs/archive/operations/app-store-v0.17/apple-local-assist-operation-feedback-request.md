# v0.17 Apple Local Assist Operation Feedback Request

Status: Ready for one small implementation slice
Scope: Apple Local Assist companion UI transparency before v0.17 tag
Authority: Medium
Last reviewed: 2026-06-10

## Purpose

Apple Local Assist is alpha and difficult to smoke because the user can
see the request form and final Diff / Discard affordance, but not the
short lifecycle between them.  This request allows one small v0.17
release-candidate polish slice to make the behaviour understandable
without adding a new product surface.

This is not a raw Foundation Models log.  It is a bounded,
window-local operation-feedback trail for the existing Assist Window.

## Selected Request

`v0.17:apple-local-assist-operation-feedback`

## Evidence Gap

Before this slice, `AppleAssistWindowApp` keeps only one latest status
message.  During real-app smoke, it is hard to tell whether Apple Local
Assist:

- found the intended target,
- sent the request to the main window / helper path,
- started local Foundation Models generation,
- applied an unsaved AI edit transaction, or
- failed because the model, target, stale guard, or availability state
blocked the request.

That opacity makes the alpha feel more mysterious than it needs to be.

## Boundary Decision

Allowed:

- Keep Apple Local Assist as the existing detached Writing Companion.
- Add a compact operation-feedback panel above the rough-request form.
- Reduce the rough-request textarea from `rows={3}` to `rows={2}` if
  long requests remain scrollable.
- Show only app-known lifecycle entries, such as:
  - ready / target acquired,
  - target kind and approximate character count,
  - request sent,
  - local generation started,
  - unsaved AI edit transaction applied and reviewable,
  - unavailable / failed / stale target.
- Keep the entry list short, for example the latest five to seven
  entries.
- Keep the feedback in React window state only.
- Add focused tests for lifecycle rendering, failure rendering, list
  cap, and no raw-response field.

Not allowed:

- Do not add a new product surface, panel, menu item, or persistent
  history.
- Do not show raw Foundation Models prompts, raw responses, hidden
  instructions, provider transcripts, chain-of-thought-like model
  reasoning, token dumps, broad document excerpts, paths, or secrets.
- Do not persist feedback to disk, localStorage, diagnostics, logs, or
  Support Diagnostics.
- Do not change the helper request / response schema unless a tiny
  display-safe field is absolutely necessary.
- Do not add network fallback, generic chat, tool calling, workspace
  indexing, auto-save, auto-apply, Git, LSP, terminal, plugins, or
  arbitrary command execution.
- Do not change dependencies or lockfiles.

## Suggested UI Shape

Keep the Assist Window visually compact:

1. Header / availability / current target summary stays first.
2. Presets stay reachable.
3. Add an operation-feedback panel before the form.
4. The rough-request form becomes slightly smaller.
5. Footer can keep the existing latest status and error, or reuse the
   same copy while the feedback panel shows the short history.

Use labels that communicate app state, not model internals.  Good copy:

- `Target: section, about 420 characters`
- `Request sent to local Apple Assist`
- `Generating locally`
- `Applied as an unsaved AI edit. Review before saving.`
- `Failed: target changed. Refresh the document and retry.`

Avoid copy like:

- `The model understood...`
- `Reasoning...`
- `System prompt...`
- `Raw response...`

## Expected Files

Likely files:

- `src/components/appleAssist/AppleAssistWindowApp.tsx`
- `src/components/appleAssist/AppleAssistWindowApp.test.tsx`
- Apple Assist window CSS, if the panel needs layout polish

Docs to update only if the implementation meaning changes:

- `docs/current-status.md`
- `docs/roadmap.md`
- `docs/releases/0.17.0-warning-expected-dmg-preview.release.md`
- `docs/smoke-checklist.md`

## Verification

Required:

```bash
npx vitest run src/components/appleAssist/AppleAssistWindowApp.test.tsx
npm run typecheck
npm run build:vite
git diff --check
```

Recommended if practical:

```bash
npm run build:apple-assist-helper:live
npm run build
```

Manual smoke:

- Open Apple Local Assist in the built app.
- Issue one rough request against a Markdown document.
- Confirm the feedback trail shows target / sending / generating /
  applied or failed.
- Confirm the buffer becomes dirty only through the existing unsaved AI
  edit transaction.
- Confirm Diff / Discard review remains the detailed inspection route.
- Confirm no raw prompt, raw model response, hidden instruction, or
  broad document excerpt appears in the operation-feedback panel.

If the host cannot run Apple Foundation Models, record the manual smoke
as skipped or unavailable-state-only.  Do not claim live generation
passed without a supported Mac.

## Suggested External-Agent Prompt

You are working in the `hazakura-note` repository root.

Please implement exactly one small v0.17 release-candidate polish slice:

`v0.17:apple-local-assist-operation-feedback`

Before changing files, read:

- `AGENTS.md`
- `README.md`
- `docs/current-status.md`
- `docs/roadmap.md`
- `docs/security-boundary.md`
- `docs/assist-surface-strategy.md`
- `docs/apple-local-assist-writing-companion-plan.md`
- `docs/v0.17-apple-local-assist-operation-feedback-request.md`

Goal:

- Make Apple Local Assist alpha behaviour understandable by adding a
  compact operation-feedback trail to the existing Assist Window.
- Keep the rough-request form smaller if it improves the layout.
- Do not create a raw Foundation Models transcript or persistent log.

Rules:

- Preserve Safe Editor as the primary product surface.
- Keep Markdown/text source canonical.
- Keep Apple Local Assist as the existing detached Writing Companion.
- Keep AI edits explicit, unsaved, and reviewable through the existing
  Diff / Discard path before save.
- Do not show raw prompts, raw responses, hidden instructions,
  provider transcripts, model reasoning, broad document excerpts,
  paths, or secrets.
- Do not persist operation feedback or include it in Support
  Diagnostics.
- Do not add Git, LSP, terminal, plugin, arbitrary command execution,
  project indexing, network fallback, auto-apply, auto-save, or
  auto-commit behaviour.
- Do not change dependencies or lockfiles.
- Keep the slice small and reviewable.
- Report skipped manual smoke honestly.
- Do not claim App Store signed, submitted, reviewed, approved,
  TestFlight-ready, notarized, or production-ready status.

Close with:

## Selected request

`v0.17:apple-local-assist-operation-feedback`

## Evidence gap

What was unproven or opaque before this slice.

## Changed files

List only files changed by this slice.

## Verification

Commands and manual checks actually run.

## Skipped checks

Skipped checks with reasons.

## Known risks

Residual risks or follow-up requests.
