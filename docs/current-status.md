# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-06

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current source / local-app tag is `v0.13.0`.
- Current package/app version is `0.13.0` across npm, Tauri, Cargo, and lockfile metadata.
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
- v0.13.0 is the **Distribution Probe / L Mode Bridge** source / local-app tag: it separates the App Store preview lane from the Developer / GitHub lane, adds draft sandbox entitlement proof, keeps Apple Local Assist as an availability-gated local helper, improves L Mode mode-completeness, and moves the deeper L Mode WYSIWYG Accuracy Ramp to v0.14 planning.
- v0.13.0 local source / local-app gates passed on 2026-06-06. See `docs/releases/0.13.0-source-tag.release.md` for the verification packet.
- Post-v0.13 product polish should treat L Mode WYSIWYG accuracy as the primary writing-surface track. The goal is to make L Mode credible for routine writing and correction while preserving Markdown as the saved source, with particular attention to cursor movement, IME, lists, links, tasks, dividers, tables, images, hidden markers, and source-preserving copy/edit behavior.
- Older public tags remain immutable.

## Current Product Boundary

- Safe Editor remains the primary product surface.
- Markdown/text source remains the saved document model.
- Default Safe Editor Mode has no Git client, LSP, general terminal, arbitrary command execution, plugin system, project-wide indexing, auto-apply, or auto-commit behavior.
- Agent Workbench is optional and explicit. It may host one allowlisted `codex`, `opencode`, `pi`, or `claude` provider session in the selected workspace after restart-required enablement and responsibility-boundary consent.
- Manual Review Desk entry points are hidden for the current App Store-oriented surface. Diff, recovery review, and Apple Local Assist edit review remain explicit, unsaved, and inspectable.
- Workspace file operations are bounded to the selected workspace. Workspace-internal drag/drop Move remains experimental; New File, New Folder, Rename, and Move to Trash are the dependable file-tree operations.

## Release Readiness

Use these documents for release evidence and future release decisions:

- `docs/releases/0.10.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.11.0-warning-expected-dmg-preview.release.md`
- `docs/releases/0.12.0-source-tag.release.md`
- `docs/releases/0.13.0-source-tag.release.md`
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The published v0.10.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

The published v0.11.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings. Local and remote verification passed after publication.

The v0.12.0 and v0.13.0 tags are source / local-app checkpoints. They are not signed, notarized, App Store, TestFlight, or warning-expected DMG publications.

For future releases, re-check local artifact evidence and, after publication, re-download GitHub Release assets into a fresh temp directory and verify checksum, `hdiutil verify`, mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.

## Active Planning Sources

- `README.md`: public entry point and current user-facing feature/limit summary.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/roadmap.md`: current release sequence and future phase boundaries.
- `docs/l-mode-plan.md`: L Mode WYSIWYG Accuracy Ramp and source-preserving writing-surface plan.
- `docs/apple-local-assist-distribution-plan.md`: v0.12+ Apple Local Assist and App Store / developer-build release-lane planning memo.
- `docs/apple-local-assist-writing-companion-plan.md`: Apple Local Assist Writing Companion / external Assist Window UX direction.
- `docs/apple-local-assist-v0.12-design-review.md`: v0.12 implementation slice design + Slice 5 feasibility findings.
- `docs/agent-workbench-boundary.md`: implemented Agent Workbench trust boundary.
- `docs/assist-surface-strategy.md`: future assist-surface direction.
- `docs/authoring-feature-readiness.md`: incomplete authoring/export claims that should not be overstated.

Historical detailed status logs through 2026-06-04 were archived to `docs/archive/status/current-status-through-2026-06-04.md`.

## v0.13.0 Distribution Probe / L Mode Bridge source / local-app tag

v0.13.0 closes the first distribution-probe pass. The normal `npm run build` path now builds the App Store preview / normal lane, while `npm run build:macos-lanes` also produces a separate Developer / GitHub lane bundle named `hazakura editor Dev.app` with bundle identifier `lab.hazakura.note.dev`. The warning-expected DMG preview path packages the Dev lane bundle, keeping the App Store preview lane and Developer / GitHub lane distinct.

The App Store preview lane now hides or omits Agent Workbench entry points in the frontend and native menu, omits `agent.html` from the Vite App Store build input, and rejects Agent Workbench IPC on the Rust command surface. This is a structural preview only: it is not App Store signed, submitted, notarized, or approved.

The sandbox proof is promising but still incomplete. Draft App Store entitlement files exist, ad-hoc sandbox signing verifies, and the real sandboxed `hazakura-editor` parent can spawn the inherited-sandbox Apple Local Assist helper and receive an availability envelope. Apple Developer / App Store signing, provisioning, upload validation, and review behavior remain unproven.

L Mode also moved closer to being a peer writing mode: the hidden-by-default file tree can open as a temporary drawer, dirty-buffer review opens as a local floating diff sheet, the top-right switch uses `編集モード`, normal edit mode has an explicit `えるモード` route, and known visual/input regressions around list markers, Setext dividers, action-rail geometry, and dark diff contrast were tightened. The broader WYSIWYG accuracy work is intentionally deferred to v0.14.

## v0.12.0 Apple Local Assist source / local-app tag

Apple Local Assist has moved from fixture-only companion mock to a live local preview. `npm run build` builds a release Swift helper without `FIXTURE_MODE`, bundles it through `tauri.conf.json` `bundle.externalBin`, and the production Rust command surface calls the helper supervisor through the main-window / Apple Local Assist-window scoped boundary: availability probe is allowed from `main | apple-assist`, while candidate generation remains `main` only. The helper uses `SystemLanguageModel.default.availability` for probe and `LanguageModelSession.respond` for bounded candidate generation when Apple Foundation Models is available on the current Mac.

The product direction remains an external Apple Local Assist Writing Companion, not a command-palette-first selected-text tool and not the main AI feature. It is an **alpha / experimental** lightweight text-assistance surface for short summaries, rephrasing, heading / tag ideas, light cleanup, and bounded writing help. It works from normal editor and L Mode, accepts rough requests, replaces rather than coexists with the Agent Window slot, edits the unsaved buffer through explicit AI edit transactions, and exposes a compact Diff / Discard escape hatch. The preferences dialog treats the outside companion slot as a restart-applied Assist Surface choice (`Apple Local Assist (Experimental)` / `CLI Agent` / `Off`), and the top chrome companion button switches between Apple Local Assist and Agent according to the active setting for the current app launch.

Current limits: live generation depends on macOS 26+ Apple Foundation Models availability, local Apple Intelligence state, and a Foundation Models-supported current app language / locale (`SystemLanguageModel.default.supportsLocale()`). Output quality may vary, and this alpha feature may change or be removed. Apple Local Assist is not suitable for code review, multi-file understanding, long-document restructuring, autonomous agent work, external AI-agent replacement, local LLM runtime replacement, or advanced reasoning. There is no network fallback, no App Store/TestFlight distribution change, no background rewriting, no auto-save, no tool calling, and no workspace-wide indexing. `minimumSystemVersion` remains at the v0.11 value (`11.0`) so older Macs can still run the editor; Apple Local Assist reports unavailable/unsupported when the helper, model, or current language / locale is not usable.

## Next L Mode WYSIWYG Accuracy Ramp

1. Use `docs/l-mode-plan.md` as the v0.14 planning source.
2. Prioritize rendering fidelity for headings, inline marks, links, lists, tasks, dividers, Setext underlines, blockquotes, code blocks, tables, images, Japanese prose, and mixed symbols.
3. Prioritize editing fidelity for caret movement, IME composition, active-line decorations, hidden markers, Backspace / Delete, list continuation, selection, and Markdown-source copy behavior.
4. Add regression fixtures for mixed Markdown and CSS drift before widening the visual illusion.
5. Keep Markdown source canonical; do not introduce Preview DOM editing, `contenteditable`, HTML as the saved model, or hidden save-time rewriting.
6. Keep App Store / Developer lane proof on the roadmap, but do not let it displace the next L Mode writing-surface pass unless release packaging forces the issue.

## Next Safe Actions

1. If continuing quality work, use `docs/development-automation.md` and keep to one small verified slice.
2. If improving L Mode, use `docs/l-mode-plan.md` and prioritize source-preserving WYSIWYG accuracy: rendering fidelity, editing stability, IME/caret/list/link/table behavior, and visual-overlap regression checks.
3. If planning assist work after v0.13.0, use `docs/assist-surface-strategy.md`, `docs/apple-local-assist-distribution-plan.md`, and `docs/apple-local-assist-writing-companion-plan.md`; keep Apple Local Assist as an external Writing Companion and require AI edit transactions for direct buffer edits.
4. If preparing a future release, use `docs/source-release-checklist.md`, `docs/dmg-preview-checklist.md`, and the version-specific release note; do not tag or publish without explicit approval.
5. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
