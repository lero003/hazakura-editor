# Core AI generation profile surface

Status: Source + unit-test record. Live E4B measurement not run here.
Scope: The Settings surface that shows the last Local Assist run's requested and effective generation settings
Authority: Verification record
Last reviewed: 2026-09-21

## Why

The E4B wiring slice recorded requested vs effective sampling in the helper's `usage`,
but nothing displayed it. A settings screen that restates Hazakura's own constants would
keep looking correct after the wiring drifted, so the panel reads the helper's report
instead. This slice closes "Next gate 3" of
[the E4B wiring slice](../2026-09-21-core-ai-e4b-wiring/README.md).

## Changes

| Area | Change | File |
| --- | --- | --- |
| Helper wire | `HelperCandidate` keeps the helper's `usage` (it was parsed and dropped). Camel-case names match the Swift `AppleAssistUsage`. | `apple_assist_supervisor.rs` |
| Record | `AssistGenerationProfile` is derived from a run that reported settings; the store keeps the last one and ignores a run that reported none. Token-only usage (the System evaluation path) does not become a profile. | `apple_assist_supervisor.rs` |
| Commands | Both generation paths publish the record and emit `local-assist-generation-profile-changed`; `local_assist_generation_profile` reads it. Main window only, never persisted. | `apple_assist.rs`, `lib.rs` |
| Settings | Read-only "生成設定（直近の実行）" block under the on-device model manager. It renders only what Rust hands it, and shows an empty state until a Core AI run reports settings. | `CoreAiGenerationProfile.tsx`, `SettingsPreferencesPane.tsx`, `coreAiModels.ts` |

No change to what Hazakura sends to the model: same prompt contract, same options, same
single-writer Apply path. The panel adds no new capability and no new data flow outward.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml` — 422 tests pass, 2 ignored
  (417 before; +5 for usage parsing, the profile derivation, and the store).
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `npm test` — 296 files / 2,649 tests pass; `test:scripts` 24 tests pass
  (2,646 before; +3 for the panel).
- `npm run typecheck` — pass.
- `npm run build:vite` — pass.
- `npm run smoke:app-store-surface` — 129 tests pass.
- `npm run build` (App Store preview lane) — success; the new command compiles and links in
  the release bundle. Ad-hoc signed, Background Download extension embedded, signature
  validated. Notarization skipped (no credentials in this shell), so this is not a
  distribution signature.
- `git diff --check` — clean.

## Not verified here

- **A real observation.** The Codex sandbox hands the production helper no GPU device
  (`CoreAIKit.KitGemmaError.noMetalDevice`), so no Core AI run has populated the panel in
  this environment. The recorded shape is verified from the wire JSON and unit tests.
- **The rendered panel.** The block has component tests under jsdom only; the built app's
  Settings pane, the three display languages, and maximum Dynamic Type remain a manual pass.
- Signed candidate, TestFlight, Apple CDN download, AOT, and the 16 GB bake-off stay
  separate gates.

## Next gate

1. In a normal shell, run one Core AI generation and confirm the panel shows the same
   requested/effective pair the evaluation harness reports.
2. Re-measure E4B on the owner's shell (load time, time to first token, generation time)
   as `docs/core-ai-harness-quality.md` asks.
3. The remaining output breakage (`follow-up` / `quote`) is model-side or prompt-side; the
   candidate list in `docs/core-ai-harness-quality.md` is unchanged by this slice.
