# Handoff

## Current State

- `hazakura editor` published `v0.11.0` as a warning-expected DMG preview, framed as **L Mode WYSIWYG-tier Polish**.
- Version surfaces are aligned at `0.11.0`.
- Latest published release body: `docs/releases/0.11.0-warning-expected-dmg-preview.release.md`.
- Current status source: `docs/current-status.md`.

## Recent Changes

- Docs were pruned for the v0.10 release lane.
- `docs/current-status.md` was compacted from a long change log into a current-state document.
- Historical detailed status was archived at `docs/archive/status/current-status-through-2026-06-04.md`.
- Old setup notes, initial MVP/planning docs, superseded goal prompts, v0.6 release review brief, and the unpublished v0.1 DMG proposal moved under `docs/archive/`.
- New indexes were added at `docs/README.md`, `docs/archive/README.md`, and `docs/releases/README.md`.
- `v0.10.0` was tagged and published, with DMG assets re-downloaded and verified after publication.
- L Mode direction reframed for v0.11+: the visual target is now a WYSIWYG-tier writing surface that goes beyond dedicated WYSIWYG editors like Typora. `docs/l-mode-plan.md`, `docs/roadmap.md`, `docs/current-status.md`, the smoke checklist, and the L Mode memory entry all reflect the new direction. Implementation discipline (Markdown source = truth, CodeMirror decoration, no Preview DOM editing) is unchanged.
- `v0.11.0` release preparation updated version surfaces, current docs, roadmap, smoke checklist, release notes index, and README to separate the prepared candidate from the published `v0.10.0` release.
- Review found and fixed auto-backup restore safety issues: applying a backup after switching tabs now targets the compared document path, not the currently active unrelated tab; selecting a backup from L Mode exits L Mode so the Compare pane is visible before Apply.
- L Mode escape hatches were moved out of the status bar into a separate action rail. `変更を確認` now exits L Mode and defers the disk-vs-editor diff request to the next tick so the Compare pane is visible instead of leaving only status/top-chrome state behind.
- `v0.11.0` was tagged and published, with DMG assets re-downloaded and verified after publication.
- Apple Local Assist live local preview landed after v0.11.0: Preferences expose the outside companion slot as restart-applied `Apple Assist` / `CLI Agent` / `Off`, the normal top-chrome companion button switches between Apple Assist and Agent according to the active setting for the current app launch, and the built app bundles a Swift helper through `bundle.externalBin`. CLI Agent keeps the existing Agent Workbench restart / consent / allowlisted provider boundary. Apple Assist calls Apple Foundation Models only when locally available, edits the unsaved buffer through AI edit transactions, and keeps Diff / Discard review available before explicit save.

## Decisions

- Current docs in `docs/` are authoritative for implementation and release decisions.
- `docs/archive/` is historical context only. Do not use archived files as current product scope unless a current doc explicitly reactivates them.
- Historical Review Desk review docs now live in `docs/archive/reviews/`; code comments reference those archive paths directly.
- Older `.release.md` files stay in `docs/releases/` as release-note evidence; unpublished proposals belong in `docs/archive/releases/`.

## Verification

- Release gates passed before publication: `npm ci`, `npm run typecheck`, `npm test`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml`, `npm run build:vite`, `npm run build`, `npm audit`, `cargo audit --file src-tauri/Cargo.lock`, and `npm run build:dmg-preview`.
- Local artifact verification passed: checksum, `hdiutil verify`, built and mounted app metadata, and `codesign --verify --deep --strict --verbose=2`.
- `spctl -a -vv -t open` rejected the ad-hoc signed app with `source=Insufficient Context`, as expected for this warning-expected preview.
- Remote GitHub Release assets were re-downloaded into a fresh temp directory and passed checksum, `hdiutil verify`, mounted-app metadata, and codesign verification.
- Docs checks passed: `git diff --check`, current-doc old-reference scan, and current-doc local Markdown link check.
- v0.11.0 local verification passed: `npm run typecheck`, `npm test` (188 tests), `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml` (178 tests), `npm run build:vite`, `npm run build`, `git diff --check`, `npm audit` (0 vulnerabilities), `cargo audit --file src-tauri/Cargo.lock` (exit 0 with existing allowed warnings), `npm run build:dmg-preview`, checksum/DMG verification, built + mounted app metadata, built + mounted app codesign, expected `spctl` rejection, and built-app launch smoke.
- Focused v0.11.0 built-app manual smoke passed on 2026-06-05: `Cmd+Shift+L` and View menu `えるモード` entered L Mode on mixed Markdown documents without changing the saved source; long-document keyboard and user-operated trackpad/mouse-wheel scrolling worked in L Mode; the L Mode action rail exposed separate workspace and diff buttons; `変更を確認` opened the right-pane disk-vs-editor diff for a dirty buffer; Preferences exposed and toggled Typewriter mode; Export HTML wrote a standalone UTF-8 file with Preview CSS parity and inlined workspace images; Print to PDF generated the print HTML and opened Safari's print dialog; auto-backup restore listed a scoped backup, opened backup-vs-buffer Compare from L Mode, applied the backup to the compared `smoke.md` after switching to `other.md`, marked `smoke.md` dirty without auto-saving, and saved only `smoke.md` when explicitly requested.
- Post-screenshot focused fix on 2026-06-05: README-style `docs/images/...` local images now resolve in Markdown preview/export/print through `open_workspace_image` instead of being limited to `assets/...`; L Mode already used the same workspace-relative boundary and now has explicit README-image regression coverage. Focused verification passed: `npm test -- src/features/editor/markdown.test.ts src/features/editor/lMode/imageWidget.test.ts`, `npm run typecheck`, `cargo test --manifest-path src-tauri/Cargo.toml open_workspace_image`, `npm run build:vite`, `npm run build`, plus built-app README Preview and L Mode smoke showing both README screenshots as images rather than blocked placeholders.
- Typewriter follow-up on 2026-06-05: the previous implementation could fail to visibly center because it dispatched `EditorView.scrollIntoView` during the same update cycle as CodeMirror's own selection visibility scroll. L Mode typewriter now schedules the recenter one animation frame later, measures the settled caret coordinates, writes directly to `view.scrollDOM.scrollTo`, recenters on document changes or selection changes only when the selection is a collapsed caret, and skips range selections. The empty L Mode placeholder is now localized through `LModeCopy`. Verification passed: `npm test -- src/features/editor/lMode/extension.test.ts`, `npm test` (188 tests), `npm run typecheck`, `npm run build:vite`, `git diff --check`, a real browser CodeMirror fixture loaded from Vite (`line 90` centered within `0.31px`), `npm run build:dmg-preview`, `shasum -c hazakura-editor_0.11.0_aarch64-warning-expected.dmg.sha256`, and `hdiutil verify hazakura-editor_0.11.0_aarch64-warning-expected.dmg`. Latest local DMG SHA-256: `09194d22ed6a61164fbf72b7a1b17301e530bca289f42a104d3bb6c4305767e8`.
- Apple Local Assist planning follow-up on 2026-06-05: `docs/apple-local-assist-distribution-plan.md` now records the v0.12+ direction. Apple Local Assist is framed as an Assist Surface provider class for document help, not as a CLI-agent provider or Safe Editor widening. The plan separates App Store build (Safe Editor + L Mode + Review Desk / Diff + Apple Local Assist, no External Agent Workbench) from developer builds that may keep External Agent Workbench.
- Apple Local Assist v0.12 supervisor follow-up on 2026-06-05: Rust supervisor (helper spawn / lifecycle / JSON line 通信 / 15s watchdog / cooldown / protocol-violation detection) was implemented as the foundation for a later live helper gate. That old gate-default-hidden state is now superseded by the 2026-06-06 live helper slice below; do not use it as current implementation state.
- Apple Local Assist UX direction follow-up on 2026-06-05: `docs/apple-local-assist-writing-companion-plan.md` now records the product pivot. Future Apple Local Assist work should prioritize an external Writing Companion / Assist Window that replaces the Agent Window slot, works with L Mode, accepts rough writing requests, and can update the unsaved editor buffer only through explicit AI edit transactions with Diff / change-history review and no auto-save. Existing selected-text command-palette slices are foundation plumbing, not the final UX.
- Apple Local Assist companion-slot settings verification on 2026-06-06 passed: `npm run typecheck`, `npm run test` (45 files / 251 tests), `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml` (228 tests), `npm run build:vite`, `npm run build`, and `git diff --check`. `npm run build` produced `/Users/keisetsu/Projects/hazakura-note/src-tauri/target/release/bundle/macos/hazakura editor.app`; Vite chunk-size warning and notarization skip remain expected for the local build.
- Apple Local Assist live helper verification on 2026-06-06 passed: `npm run build:apple-assist-helper:live` returned availability `available`; `HAZAKURA_APPLE_ASSIST_LIVE_SMOKE_GENERATE=1 npm run build:apple-assist-helper:live` returned a live `candidate` from `apple:foundation-models:system-default`; `npm run build` bundled and signed `Contents/MacOS/hazakura-apple-assist-helper`; direct bundle-helper smoke returned availability and candidate envelopes. The helper strips outer Markdown code fences from model responses before returning candidates.

## Risks / Unknowns

- The `v0.10.0` and `v0.11.0` tags point at release-prep commits; `main` may have later post-publication docs-sync commits.
- Direct mouse-wheel automation remains unreliable for WebView smoke because macOS accessibility does not expose a dependable scroll action here; treat real trackpad/mouse-wheel coverage as user-operated manual smoke.
- GitHub reported one moderate vulnerability notice during push; `npm audit` still reported 0 vulnerabilities locally.
- `docs/releases/` still contains historical release-note evidence; this is intentional because release verification can depend on it.

## Next Actions

- Before any future publication decision, re-check the latest local gates if code changes again; otherwise use the current release note as the evidence packet.
- For post-v0.11 assist work, start from `docs/apple-local-assist-writing-companion-plan.md`. Keep Apple Local Assist detachable, prioritize L Mode / rough writing requests, and use AI edit transactions rather than hidden or irreversible applies.
- For Apple Local Assist or App Store distribution planning, start from `docs/apple-local-assist-distribution-plan.md` and keep App Store build decisions separate from the existing developer / warning-expected DMG preview lane.
- Distribution planning now defaults to two binary lanes only: App Store build (`Safe Editor` + `Apple Assist`, no Agent Workbench) and Developer / GitHub build (same base plus Agent Workbench). Treat an official website as routing/explanation, not a third official free build, unless the user explicitly reopens that cost.
- For the next Apple Local Assist slices, focus on built-app smoke, rough-request prompt quality, unavailable/disabled state handling, and distribution hardening. Do not re-run the old gate-default-hidden sequence; `bundle.externalBin`, live Swift probe/generate, and Rust command-surface helper routing are already on `main`.
- If doing more docs cleanup, prefer tightening release-note structure, not resurrecting archived planning docs.
- After the live helper slice, the next useful implementation is UX hardening from real writing examples plus App Store/distribution review; do not broaden Apple Assist into network fallback, generic chat, tool calling, or workspace indexing.

## Avoid

- Do not treat archived early MVP or post-v0.5 planning notes as current roadmap.
- Do not move published release evidence out of `docs/releases/` without checking links and release workflow expectations.
