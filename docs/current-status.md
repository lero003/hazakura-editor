# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-07

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current warning-expected DMG preview tag is `v0.15.0`.
- Current package/app version is `0.15.0` across npm, Tauri, Cargo, and lockfile metadata.
- Current published downloadable preview is `v0.15.0` at `https://github.com/lero003/hazakura-editor/releases/tag/v0.15.0`.
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
- v0.14.0 is the **L Mode Stability Ramp / Apple Local Assist Harness Polish** source / local-app tag: it lands the first five source-preserving L Mode quality slices from the 60-to-80 review path and a small Apple Local Assist harness pass that centers request context around the active target, fixes context-boundary snapping, removes a horizontal-scroll trap in the L Mode review sheet, and localizes common Assist apply-error states.
- v0.14.0 local source / local-app gates passed on 2026-06-07. See `docs/releases/0.14.0-source-tag.release.md` for the verification packet.
- v0.15.0 is the **User-Test Quality Polish** warning-expected DMG preview: it closes the post-user-test polish loop with stale-state hardening, L Mode lightness, Apple Local Assist rough-request / stale-candidate polish, settings/theme clarity, and save/recovery robustness. It publishes an Apple Silicon Developer / GitHub lane DMG for cross-machine testing, but remains ad-hoc signed and not notarized.
- v0.15.0 local release gates and warning-expected DMG preview verification passed on 2026-06-07. DMG SHA-256: `e835a2052c47651134cf37c909501947e4fa407a97767b7d8856eb98ee5e9ec2`.
- v0.15.0 GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
- Post-v0.15 work should move into a v0.16 **Release Prep** lane, followed by a v0.17 **Release Polish** lane for final release-facing touch-ups.
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
- `docs/releases/0.14.0-source-tag.release.md`
- `docs/releases/0.15.0-warning-expected-dmg-preview.release.md`
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The published v0.10.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

The published v0.11.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings. Local and remote verification passed after publication.

The published v0.15.0 release is a warning-expected DMG preview for the Developer / GitHub lane. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings. Local and remote verification passed after publication.

The v0.12.0, v0.13.0, and v0.14.0 tags are source / local-app checkpoints. They are not signed, notarized, App Store, TestFlight, or warning-expected DMG publications.

For future releases, re-check local artifact evidence and, after publication, re-download GitHub Release assets into a fresh temp directory and verify checksum, `hdiutil verify`, mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.

## Active Planning Sources

- `README.md`: public entry point and current user-facing feature/limit summary.
- `docs/product-brief.md`: durable product direction and non-goals.
- `docs/roadmap.md`: current release sequence and future phase boundaries.
- `docs/l-mode-plan.md`: L Mode WYSIWYG Accuracy Ramp and source-preserving writing-surface plan.
- `docs/commercial-quality-baseline.md`: non-App-Store commercial-quality baseline and follow-up request labels.
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

## v0.14.0 L Mode Stability Ramp / Apple Local Assist Harness Polish source / local-app tag

v0.14.0 closes the first small L Mode WYSIWYG accuracy ramp and records a bounded Apple Local Assist harness polish pass. It does not claim a completed WYSIWYG editor or a mature AI writing system. The saved Markdown source remains canonical, L Mode still renders through CodeMirror decorations, and there is no Preview DOM editing, `contenteditable`, HTML as the saved model, hidden save-time conversion, network fallback, tool calling, or auto-apply behavior.

The landed behavior changes are deliberately practical: decoration recomputation now reacts to real selection changes without overreacting to same-selection dispatches; Typewriter mode avoids measured recentering during active IME composition and re-checks composition state inside the deferred rAF callback; task checkboxes in L Mode are keyboard focusable and toggle on Enter / Space; visual-overlap math for margin chips versus page padding is pinned across narrow and wider widths; and the L Mode screen-print fallback hides floating chrome and restores the page surface to plain white when the user prints the editor screen.

The print slice is intentionally scoped. The canonical Print to PDF / Export HTML path is still the standalone pipeline in `useDocumentExport`, which renders Markdown source through `renderMarkdown()` and `getMarkdownPreviewCss()`; the L Mode CSS print block is only a screen-side fallback and cannot CSS-recover source text from `Decoration.replace` widgets.

Apple Local Assist also became more dependable for reviewable writing edits: `useAppleAssistApplyHandler` now builds surrounding document context around the selected target instead of the document head, clamps the returned context itself, and snaps to safe line boundaries without erasing nearby lines. The L Mode floating review sheet no longer inherits the normal diff row's `min-width: 720px` floor, reducing horizontal scroll for long Assist candidates. The Apple Assist window now classifies common raw apply errors into localized user-facing messages.

## v0.12.0 Apple Local Assist source / local-app tag

Apple Local Assist has moved from fixture-only companion mock to a live local preview. `npm run build` builds a release Swift helper without `FIXTURE_MODE`, bundles it through `tauri.conf.json` `bundle.externalBin`, and the production Rust command surface calls the helper supervisor through the main-window / Apple Local Assist-window scoped boundary: availability probe is allowed from `main | apple-assist`, while candidate generation remains `main` only. The helper uses `SystemLanguageModel.default.availability` for probe and `LanguageModelSession.respond` for bounded candidate generation when Apple Foundation Models is available on the current Mac.

The product direction remains an external Apple Local Assist Writing Companion, not a command-palette-first selected-text tool and not the main AI feature. It is an **alpha / experimental** lightweight text-assistance surface for short summaries, rephrasing, heading / tag ideas, light cleanup, and bounded writing help. It works from normal editor and L Mode, accepts rough requests, replaces rather than coexists with the Agent Window slot, edits the unsaved buffer through explicit AI edit transactions, and exposes a compact Diff / Discard escape hatch. The preferences dialog treats the outside companion slot as a restart-applied Assist Surface choice (`Apple Local Assist (Experimental)` / `CLI Agent` / `Off`), and the top chrome companion button switches between Apple Local Assist and Agent according to the active setting for the current app launch.

Current limits: live generation depends on macOS 26+ Apple Foundation Models availability, local Apple Intelligence state, and a Foundation Models-supported current app language / locale (`SystemLanguageModel.default.supportsLocale()`). Output quality may vary, and this alpha feature may change or be removed. Apple Local Assist is not suitable for code review, multi-file understanding, long-document restructuring, autonomous agent work, external AI-agent replacement, local LLM runtime replacement, or advanced reasoning. There is no network fallback, no App Store/TestFlight distribution change, no background rewriting, no auto-save, no tool calling, and no workspace-wide indexing. `minimumSystemVersion` remains at the v0.11 value (`11.0`) so older Macs can still run the editor; Apple Local Assist reports unavailable/unsupported when the helper, model, or current language / locale is not usable.

## v0.15.0 User-Test Quality Polish warning-expected DMG preview

v0.15.0 closes the post-user-test polish pass and provides a warning-expected DMG preview for other Macs. It is not an Apple Local Assist-only milestone: the tag gathers many small, concrete app-use fixes across save/recovery, L Mode, image preview, Apple Local Assist, settings/theme, status feedback, workspace operations, compare/review, and release-prep continuity.

The important behavior changes are stale-state oriented. Late async completions no longer win over newer user intent in compare, disk-change review, image preview, Apple Local Assist review candidates, Save As, HTML export, and recovery reopen flows. Save completion after further typing no longer makes the buffer look clean or deletes the still-needed recovery draft. Workspace folder trash now clears descendant tabs/drafts/recents/compare state instead of leaving stale references.

The user-facing polish is intentionally small: L Mode action-rail and task-widget behavior is steadier around IME/focus/stale ranges, image previews can be closed from the tab row, L Mode image preview loses the normal divider, settings gained visible theme/language hints and more natural Japanese / かなふみ copy, and IPC failures that matter to the user now surface through status instead of console-only warnings.

The DMG uses the Developer / GitHub lane (`hazakura editor Dev.app`, `lab.hazakura.note.dev`) so Agent Workbench remains available for preview users. It is ad-hoc signed, not Developer ID signed, not notarized, and should be treated as a hands-on preview artifact rather than a trusted distribution.

## v0.16 L Mode Live Source Quality Follow-up

v0.16 should treat the larger-than-expected post-v0.15 L Mode work as a focused quality follow-up, not as leftover v0.15 polish and not as certificate / distribution prep.

The scope is the Live Source writing surface: readable Markdown presentation when the editor is not focused on that structure, source-like behavior at the active caret / selection, and guardrails that keep tables, checkboxes, code fences, quotes, images, IME composition, and draft recovery from looking broken or silently rewriting Markdown.

This lane must stay source-preserving. It may improve CodeMirror decorations, keyboard behavior, tests, and built-app smoke coverage around L Mode, but it should not add Preview DOM editing, `contenteditable`, hidden save-time formatting, table cell merging, or broad WYSIWYG structural editing.

Distribution work now moves after this L Mode follow-up:

1. Developer / GitHub distribution readiness: app identity, DMG instructions, expected macOS warnings, checksum flow, support boundaries, and cross-machine smoke guidance.
2. App Store lane readiness: App Store preview build separation, Agent Workbench omission, Apple Local Assist helper bundling/signing assumptions, sandbox/review constraints, and certificate/provisioning work.
3. Accessibility, keyboard-flow, performance, bundle-size, and release automation cleanup where they reduce real release risk.

## v0.17 Distribution Prep / Release Polish Lane

v0.17 should start from distribution prep after v0.16 L Mode evidence is stable, then shrink toward final release polish: certificate / signing lane decisions, wording, install instructions, screenshots, release notes, last user-test bugs, and final smoke evidence. Avoid new major product surfaces here unless a release blocker demands it.

## Next Safe Actions

1. If continuing into v0.16, use `docs/l-mode-plan.md` and `docs/commercial-quality-baseline.md`; prioritize reproduced L Mode regressions, built-app smoke, and source-preserving fixes around IME/caret/Backspace/list/link/table/image/quote/code-fence behavior.
2. If improving Apple Local Assist after v0.15.0, use `docs/assist-surface-strategy.md`, `docs/apple-local-assist-distribution-plan.md`, and `docs/apple-local-assist-writing-companion-plan.md`; keep Apple Local Assist as an external Writing Companion and require AI edit transactions for direct buffer edits.
3. If improving theme / settings, verify persistence, native menu sync, readability, and restart-required copy before debating purely cosmetic variants.
4. If preparing v0.17+ distribution work, use `docs/source-release-checklist.md`, `docs/dmg-preview-checklist.md`, and `docs/commercial-quality-baseline.md`; keep App Store / Developer / warning-expected DMG lanes separate.
5. If preparing a future release, use the version-specific release note; do not tag or publish without explicit approval.
6. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
