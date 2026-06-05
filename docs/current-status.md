# Current Status

Status: Operational
Scope: Current implementation state and next safe actions
Authority: High
Last reviewed: 2026-06-06

## Current State

- `hazakura editor` is a touchable Tauri desktop app for Markdown-first safe text editing.
- Current published preview is `v0.11.0` at `https://github.com/lero003/hazakura-editor/releases/tag/v0.11.0`.
- Current package/app version is `0.11.0` across npm, Tauri, Cargo, and Cargo.lock metadata.
- v0.11.0 is the **L Mode WYSIWYG-tier Polish** preview: it keeps Markdown source canonical while rendering inline emphasis, strong, strike, links, inline code, task checkboxes, horizontal rules, tables, blockquotes, code blocks, ordered/bullet lists, and images as a document-like writing surface through CodeMirror display decoration.
- v0.11.0 also includes auto-backup restore through an explicit backup-vs-buffer diff/apply flow, hash-based pasted-image deduplication, export CSS parity with Preview, workspace path rekey hardening, common text-extension save filters, and a native View menu L Mode toggle.
- Local v0.10.0 gates and warning-expected DMG preview generation passed on 2026-06-04. DMG SHA-256: `a3dcbb5a2580639ae70060d1fe85d81ed298e33ffcfa7fe0498686faffadec05`.
- GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
- v0.11.0 local release gates and warning-expected DMG preview verification passed on 2026-06-05. DMG SHA-256: `09194d22ed6a61164fbf72b7a1b17301e530bca289f42a104d3bb6c4305767e8`.
- v0.11.0 focused manual smoke for L Mode entry/source preservation, View menu L Mode toggling, long-document keyboard and user-operated trackpad/mouse-wheel scrolling, action-rail workspace/diff escape hatches, typewriter preference visibility, Export HTML, Print to PDF handoff, and auto-backup restore apply/save behavior passed on 2026-06-05.
- v0.11.0 GitHub Release assets were re-downloaded into a fresh temp directory after publication and passed checksum, `hdiutil verify`, mounted-app metadata, and `codesign --verify --deep --strict --verbose=2`.
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
- `docs/source-release-checklist.md`
- `docs/dmg-preview-checklist.md`
- `docs/smoke-checklist.md`
- `docs/development-automation.md`

The published v0.10.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings.

The published v0.11.0 release is a warning-expected DMG preview. It is ad-hoc signed, not Developer ID signed, not notarized, and expected to produce Gatekeeper warnings. Local and remote verification passed after publication.

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

## v0.12 Apple Local Assist work-in-progress

Type, hook, locale, helper fixture, and supervisor plumbing for Apple Local Assist is landed behind an availability gate that defaults to `unsupported` / `unavailable` — the command palette does NOT expose the old Apple Assist entries unless `probe_apple_assist_availability` returns `available`. The Rust commands are stubs (no Foundation Models binding) and the Swift helper builds in `FIXTURE_MODE` only. The Rust supervisor (helper spawn / lifecycle / watchdog / cooldown / protocol-violation detection) is implemented (slice 8-18) but the Tauri command surface does NOT call it — `AppleAssistHelperStore` is registered via `tauri::Builder::manage` but production `helper_path()` still returns `Err("Apple Assist helper is not configured for this build.")`. A production helper-path resolver skeleton (`rust_target_triple` / `bundled_helper_filename` / `resolve_bundled_helper_path`) and 27 integration tests are in place; the resolver still returns the not-configured error and never reads the environment, preserving gate-default-hidden. `tauri.conf.json`, `bundle.externalBin`, `minimumSystemVersion`, code-signing entitlements, and distribution lanes are unchanged. Nothing is released.

The product direction has shifted from "selected-text command-palette helper" to an external Apple Local Assist Writing Companion. The first companion-window mock is landed on `main`: it works from normal editor and L Mode, accepts rough requests, replaces rather than coexists with the Agent Window slot, edits the unsaved buffer through explicit AI edit transactions, and exposes a compact Diff / Discard escape hatch. This is fixture-only: it produces deterministic placeholder edits such as `【AI編集メモ】` and does **not** call Apple Foundation Models.

## Next gate-flip prerequisites (in order)

The next Apple Local Assist slices require **explicit user approval at each step** — the "gate-default-hidden" contract is not relaxed by code alone. The order is:

1. **bundled helper path / externalBin 承認** — `tauri.conf.json` の `bundle.externalBin` に `binaries/hazakura-apple-assist-helper-<triple>` を追加し、`minimumSystemVersion` の bump を決める。`docs/apple-local-assist-helper-path-design.md` の pre-flight checklist (signing / notarization / App Store sandbox / hardened runtime) を満たす。production `helper_path()` の body を `current_exe().parent() / bundled_helper_filename()` の探索に差し替える。
2. **Swift live probe** — `src-helpers/apple-assist/Sources/.../AvailabilityProbe.swift` の `LanguageModelSession` 接続を実装。release build が `apple:foundation:*` 形の `modelId` で `Available` を返すようになる。
3. **Rust command surface gate-flip** — `probe_apple_assist_availability_with_platform` の body を `probe_availability_via_helper` 経由に切替。`generate_apple_assist_candidate_with_stub` を残すかどうかは別スライスで判断。
4. **UI 4 状態 disclosure** — `useAppleAssistAvailability` / `useAppleAssistCandidate` の error envelope 種別 (guardrail / validation / deferred / throttled) を `src/lib/locale/appleAssist.ts` の 4 状態 mapping に反映。command palette の可視条件 (現状 hidden) を見直す。

## Next Safe Actions

1. If continuing quality work, use `docs/development-automation.md` and keep to one small verified slice.
2. If planning assist work after v0.11.0, use `docs/assist-surface-strategy.md`, `docs/apple-local-assist-distribution-plan.md`, and `docs/apple-local-assist-writing-companion-plan.md`; keep Apple Local Assist as an external Writing Companion and require AI edit transactions for direct buffer edits.
3. If preparing a future release, use `docs/source-release-checklist.md`, `docs/dmg-preview-checklist.md`, and the version-specific release note; do not tag or publish without explicit approval.
4. If changing product behavior, use `docs/product-brief.md`, `docs/security-boundary.md`, and the touched boundary doc before implementation.
