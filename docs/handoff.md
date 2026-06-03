# Handoff

## Current State

- `useAppShellController` v0.9 split lane is **complete and pushed** (11 commits on `main`, 8 refactor slices + 2 docs commits + 1 handoff commit; `5c1d1a9..2b5bd56`).
- Orchestrator is 1052 lines (down from 1473, 29% reduction); leaf-hook call surface is fronted by 9 single-purpose composers under `src/hooks/`.
- **Return shape verified byte-identical to v0.8.0**: 216 keys in baseline (`5c1d1a9`) vs 216 keys in `HEAD`, 0 removed, 0 added. v0.9 is a pure refactor.
- Vitest 65/10 files; `cargo test` 134; all gates clean at the last slice.
- The 4 user-facing refactor surfaces (find/replace, go-to-line, command palette, global search, Agent Workbench actions, menu integration) were not smoke-tested in the automation environment — the user should confirm parity with v0.8.0 before declaring v0.9 ready.

## Recent Changes

- `src/hooks/app/useAppShellFoundation.ts` (state pool: 18 dep-free leaves bundled)
- `src/hooks/app/useAppShellRefs.ts` (editor + dialog refs bundled)
- `src/hooks/editor/useEditorFindController.ts` (find/replace + go-to-line, 23 fields)
- `src/hooks/document/useDocumentCoreController.ts` (editor tab state + pasted image, 11 fields)
- `src/hooks/document/useDocumentPreviewController.ts` (image preview + document identity, 9 fields; the `selectedImage` cross-section handoff is internal)
- `src/hooks/document/useEditorSurfaceController.ts` (side pane + active document surface, 22 fields; `sidePaneMode` handoff is internal)
- `src/hooks/agent/useAgentWorkbenchController.ts` (preference + session + terminal actions, 12 fields; `refreshAgentSessionState` handoff is internal)
- `src/hooks/commandPalette/useCommandPaletteController.ts` (command palette + global search, 20 fields; the 30-entry command list + `handleOpenSearchMatch` callback moved out of the orchestrator)
- `src/hooks/app/useAppShellSideEffectsController.ts` (`useAppMenuIntegration` + `useAppRuntimeEffects` bundled; orchestrator has a single side-effects section)
- 9 shape-test files (one per composer); `src/hooks/app/useAppShellSideEffectsController.test.ts` asserts `result.current` is `undefined` (side-effect-only)
- `docs/current-status.md` updated with a v0.9 split lane bullet; the "deferred `useAppShellController` 1473-line split" line in the "next run can pick from" bullet was rewritten to point at the landed slice

## Decisions

- **No public-return-shape change.** v0.9 was an internal refactor; the orchestrator's return object is byte-identical to the pre-v0.9 shape, and `App.tsx` is still a 6-line pure composition. The user-facing AppShellProps surface is unchanged.
- **Each composer is a pure bundler** of 2-3 leaf hooks, with no new state of its own. The cross-section handoff that used to live in the orchestrator (e.g. `selectedImage` from image preview to identity, `sidePaneMode` from side pane to surface) is now internal to the composer.
- **`useActiveDocumentIdentity` was deferred from C-2** (which became `useDocumentCoreController`) into C-3 (`useDocumentPreviewController`) because it depends on `selectedImage` produced by `useImagePreview`, which is not available at the document-core call site. The plan file (`/Users/keisetsu/.claude/plans/quirky-floating-tulip.md`) still records the original 3-hook design and is now stale.
- **Single-leaf sections were not wrapped.** `useDocumentIoController`, `useTabBarController`, `useCompareController`, `useEditorCommands`, `useDocumentSafetyActions`, `useWindowDialogActions`, `useWorkspaceFileOpening`, `useLocalizedAppCopy`, `useReviewDeskController`, `useAppMenuIntegration` are all already-named controllers or single-hook leaves; wrapping them in another `<X>Controller` layer would be a rename only and was not done.
- **No Co-Authored-By trailer on any commit.** Local git config is already `kei japan <33001547+lero003@users.noreply.github.com>` so primary author is already `lero003`. Memory rule saved 2026-06-03.

## Tests

All gates ran at the last slice and were clean:
- `npm run typecheck`
- `npm test` — 65 tests / 10 files
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- `cargo test --manifest-path src-tauri/Cargo.toml` — 134 tests, 0 failed, 0 ignored
- `npm run build:vite`
- `git diff --check`

No test of the orchestrator itself was added (would require jsdom + matchMedia + a deep stub tree); the existing `useAppShellFoundation.test.ts` matches the orchestrator surface, and the 9 new shape tests cover each composer.

## Risks / Unknowns

- **Built-app smoke of the refactor surface was not run** in this automation environment (`open -n` / in-app browser policy blockers). The user should confirm find/replace (`⌘F`), go-to-line (`⌘L`), command palette (`⌘⇧P`), global search (`⌘⇧F`), the Agent Workbench action surface (mode toggle, consent, provider change, session start/stop, terminal input/resize, send-to-Agent), and the menu integration (recent files, settings, theme, preview) all behave identically to v0.8.0.
- **Hook order in the orchestrator was preserved per slice**, but the call surface has changed shape — any test that renders the orchestrator would need the full dependency tree stubbed, which is why no orchestrator test was added.
- **The plan file is stale** (`/Users/keisetsu/.claude/plans/quirky-floating-tulip.md`); the final slice shape (8 slices, with the 3-hook `useEditorShellController` split into C-2 + C-3) is not reflected. The plan is internal planning only and does not affect the build.
- **No release notes / version bump / changelog** were drafted for the v0.9 split; the next agent should decide whether to call this a v0.9.0 refactor release or fold it into the next v0.9 candidate-work release.

## Next Actions

- **Built-app smoke** the 4 user-facing surfaces against the v0.8.0 baseline before declaring v0.9 done.
- **Decide on release labeling** — v0.9.0 refactor-only, or fold into a v0.9 candidate-work release.
- **Mark the v0.9 split lane done in `docs/roadmap.md`** if the roadmap tracks it (it does not currently mention the split lane; it lists "v0.9 candidate work" features instead).
- **Update the plan file** at `/Users/keisetsu/.claude/plans/quirky-floating-tulip.md` to reflect the final slice shape (C-2 = `useDocumentCoreController` not `useEditorShellController`; C-3 = `useDocumentPreviewController` not the 3-hook fold; D = `useAgentWorkbenchController`; E-1 = `useCommandPaletteController`; E-2 = `useAppShellSideEffectsController`).
- **Consider additional TS hook unit-test bring-up** — `useTabReorder` is the remaining low-risk hook (needs `document.elementFromPoint` / `setPointerCapture` / `getBoundingClientRect` stubs).

## Avoid

- **Do not push without explicit user confirmation** — the durable no-push rule applies to all 10 commits.
- **Do not amend prior commits** to add a `Co-Authored-By` trailer — the no-trailer memory rule is in effect.
- **Do not wrap single-leaf hook sections** (`useDocumentIoController`, `useTabBarController`, etc.) in a `<X>Controller` rename layer; the wrap adds no value and would just be churn.
- **Do not reorder hook calls in the orchestrator** — the new composer signatures depend on the existing call order; the React hook order must stay stable across the 9 refactor slices.
- **Do not add a "useAppShellController summary test"** that renders the orchestrator; the dependency tree is too deep and would need a stub per leaf hook, which is not the shape the current shape tests cover.
- **Do not claim a v0.9 release** until the built-app smoke is confirmed by the user.
