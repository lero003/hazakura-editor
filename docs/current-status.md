# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-06

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current source / local-app tag is `v0.12.0`.
- Current package/app version is `0.12.0` across npm, Tauri, Cargo, and lockfile metadata.
- Current published downloadable preview remains `v0.11.0` at `https://github.com/lero003/hazakura-editor/releases/tag/v0.11.0`.
- v0.11.0 is the **L Mode WYSIWYG-tier Polish** preview: it keeps Markdown source canonical while rendering inline emphasis, strong, strike, links, inline code, task checkboxes, horizontal rules, tables, blockquotes, code blocks, ordered/bullet lists, and images as a document-like writing surface through CodeMirror display decoration.
- v0.11.0 also includes auto-backup restore through an explicit backup-vs-buffer diff/apply flow, hash-based pasted-image deduplication, export CSS parity with Preview, workspace path rekey hardening, common text-extension save filters, and a native View menu L Mode toggle.
- Local v0.10.0 gates and warning-expected DMG preview generation passed on 2026-06-04. DMG SHA-256: `a3dcbb5a2580639ae70060d1fe85d81ed298e33ffcfa7fe0498686faffadec05`.
- GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
- v0.11.0 local release gates and warning-expected DMG preview verification passed on 2026-06-05. DMG SHA-256: `09194d22ed6a61164fbf72b7a1b17301e530bca289f42a104d3bb6c4305767e8`.
- v0.11.0 focused manual smoke for L Mode entry/source preservation, View menu L Mode toggling, long-document keyboard and user-operated trackpad/mouse-wheel scrolling, action-rail workspace/diff escape hatches, typewriter preference visibility, Export HTML, Print to PDF handoff, and auto-backup restore apply/save behavior passed on 2026-06-05.
- v0.11.0 GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
- v0.12.0 is the **Apple Local Assist Alpha** source / local-app tag: it adds a live local Apple Local Assist preview, Assist Surface settings, AI edit transactions, and compact diff/discard review, without publishing a DMG asset or changing the App Store/TestFlight lane.
- v0.12.0 local source / local-app gates passed on 2026-06-06: `npm ci`, `npm run typecheck`, `npm run test` (255 tests), `npm run build:vite`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml` (233 tests), `npm run build:apple-assist-helper:live`, `npm run build`, `git diff --check`, `npm audit`, `cargo audit --file src-tauri/Cargo.lock`, built-app metadata, codesign, expected `spctl` rejection, and built-app launch smoke.
- Older public tags remain immutable.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal, arbitrary command execution, plugin system, project-wide indexing, auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted `codex`, `opencode`, `pi`, or `claude` provider session in the selected workspace after restart-required enablement and responsibility-boundary consent.
- Review Desk remains manual candidate review: compare explicitly, apply explicitly, and never auto-save candidate output.
- Workspace file operations are bounded to the selected workspace. Workspace-internal drag/drop Move remains experimental; New File, New Folder, Rename, and Move to Trash are the dependable file-tree operations.

## Release Readiness

Use these documents for release evidence and future release decisions:

- `docs/releases/0.10.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.11.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.12.0-source-tag.release.md`
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The published v0.10.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

The published v0.11.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings. Local and remote verification passed after publication.

The v0.12.0 tag is a source / local-app checkpoint. It is not a signed, notarized, App Store, TestFlight, or warning-expected DMG publication.

For future releases, re-check local artifact evidence and, after publication, re-download GitHub Release assets into a fresh temp directory and verify checksum, `hdiutil verify`, mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.

## Active Planning Sources

- `README.md`: public entry point and current user-facing feature/limit summary.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/roadmap.md`: current release sequence and future phase boundaries.
- `docs/l-mode-plan.md`: v0.11 L Mode WYSIWYG-tier planning memo.
- `docs/apple-local-assist-distribution-plan.md`: v0.12+ Apple Local Assist and App Store / developer-build release-lane planning memo.
- `docs/apple-local-assist-writing-companion-plan.md`: Apple Local Assist Writing Companion / external Assist Window UX direction.
- `docs/apple-local-assist-v0.12-design-review.md`: v0.12 implementation slice design + Slice 5 feasibility findings.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/assist-surface-strategy.md`: future assist-surface direction.
- `docs/authoring-feature-readiness.md`: incomplete authoring/export claims that should not be overstated.

Historical detailed status logs through 2026-06-04 were archived to `docs/archive/status/current-status-through-2026-06-04.md`.

## v0.12.0 Apple Local Assist source / local-app tag

Apple Local Assist has moved from fixture-only companion mock to a live local preview. `npm run build` builds a release Swift helper without `FIXTURE_MODE`, bundles it through `tauri.conf.json` `bundle.externalBin`, and the production Rust command surface calls the helper supervisor through the main-window / Apple Local Assist-window scoped boundary: availability probe is allowed from `main | apple-assist`, while candidate generation remains `main` only. The helper uses `SystemLanguageModel.default.availability` for probe and `LanguageModelSession.respond` for bounded candidate generation when Apple Foundation Models is available on the current Mac.

The product direction remains an external Apple Local Assist Writing Companion, not a command-palette-first selected-text tool and not the main AI feature. It is an **alpha / experimental** lightweight text-assistance surface for short summaries, rephrasing, heading / tag ideas, light cleanup, and bounded writing help. It works from normal editor and L Mode, accepts rough requests, replaces rather than coexists with the Agent Window slot, edits the unsaved buffer through explicit AI edit transactions, and exposes a compact Diff / Discard escape hatch. The preferences dialog treats the outside companion slot as a restart-applied Assist Surface choice (`Apple Local Assist (Experimental)` / `CLI Agent` / `Off`), and the top chrome companion button switches between Apple Local Assist and Agent according to the active setting for the current app launch.

Current limits: live generation depends on macOS 26+ Apple Foundation Models availability, local Apple Intelligence state, and a Foundation Models-supported current app language / locale (`SystemLanguageModel.default.supportsLocale()`). Output quality may vary, and this alpha feature may change or be removed. Apple Local Assist is not suitable for code review, multi-file understanding, long-document restructuring, autonomous agent work, external AI-agent replacement, local LLM runtime replacement, or advanced reasoning. There is no network fallback, no App Store/TestFlight distribution change, no background rewriting, no auto-save, no tool calling, and no workspace-wide indexing. `minimumSystemVersion` remains at the v0.11 value (`11.0`) so older Macs can still run the editor; Apple Local Assist reports unavailable/unsupported when the helper, model, or current language / locale is not usable.

## Next Apple Local Assist hardening

1. Continue the v0.13 Distribution Probe from `docs/v0.13-distribution-probe.md`: App Store build separation, sandbox entitlement draft, helper sidecar sandbox proof, and App Review notes draft.
2. Treat the current App Store build-lane gate as initial only: frontend preferences hide / normalize External Agent Workbench under the `app-store` lane and Rust rejects Agent Workbench IPC, but bundle-shape omission is still pending.
3. Treat sandbox readiness as promising but not final: draft sandbox entitlement files exist, ad-hoc sandbox signing verifies, and the real sandboxed `hazakura-editor` parent can spawn the inherited-sandbox Apple Local Assist helper and receive an availability envelope. Actual Apple Developer / App Store signing and upload validation still need proof before any App Store claim.
4. Keep Apple Local Assist quality polish secondary until the App Store lane shape is proven.
5. Decide whether `minimumSystemVersion` should remain editor-wide `11.0` or move to a split / release-lane policy for Apple Local Assist builds.
6. Review App Store sandbox, signing, hardened runtime, and notarization behavior for the bundled helper before any distribution-lane change.
7. Keep the release plan to two binary lanes by default: App Store build (`Safe Editor` + `Apple Local Assist`) and Developer / GitHub build (same base plus `Agent Workbench`). Treat an official website as a pointer to those lanes, not a third build.

## Next Safe Actions

1. If continuing quality work, use `docs/development-automation.md` and keep to one small verified slice.
2. If planning assist work after v0.12.0, use `docs/assist-surface-strategy.md`, `docs/apple-local-assist-distribution-plan.md`, and `docs/apple-local-assist-writing-companion-plan.md`; keep Apple Local Assist as an external Writing Companion and require AI edit transactions for direct buffer edits.
3. If preparing a future release, use `docs/source-release-checklist.md`, `docs/dmg-preview-checklist.md`, and the version-specific release note; do not tag or publish without explicit approval.
4. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
