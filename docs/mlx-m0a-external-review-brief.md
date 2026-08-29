# MLX M-0a External Review Brief

Status: Ready for external review
Scope: `00f179ab..HEAD`
Authority: Review evidence
Last reviewed: 2026-08-29

## Review Decision Requested

Confirm that M-0a safely prepares the System backend boundary on macOS 26 /
Xcode 26 without implementing or exposing an MLX runtime. Review the complete
range `00f179ab..HEAD`; do not evaluate it as proof that MLX builds or runs.

## Included Commits

- `b7ca1a8e` — `MLX事前設計の着手境界を固定する`
- `2a1f63b6` — `Local AssistのSystemモデルをhelper内で再利用する`
- `965867ca` — `Local Assist backend指定をRust専有でfail closedにする`
- The terminal docs / evidence commit at `HEAD`.

## Intended Change

1. The helper process owns one immutable `static let`
   `SystemLanguageModel.default` shared by availability, streaming, and
   non-streaming generation.
2. Every request constructs a new `LanguageModelSession`; no transcript or
   conversation state is retained by the runtime wrapper.
3. Rust writes `backend: "system_default"` into generate and streaming stdin.
   Renderer and companion requests cannot provide it.
4. Swift treats an absent field as System for old-Rust compatibility. It accepts
   only `system_default`; `coreai`, `mlx`, and unknown strings return
   `unsupported_backend` before Foundation Models invocation.
5. Probe remains System-only. Prompt, sanitizer, `modelId`, candidate JSON,
   Proposal / Diff / explicit Apply, no auto-save, and no tool calling remain
   unchanged.

## Focus Areas

- **Model vs session lifetime:** verify the model is process-local and immutable,
  while every generation gets a new session and transcript.
- **Cancel teardown:** verify the existing supervisor kill path destroys the
  helper process, so its model and in-flight session cannot survive Cancel,
  timeout, protocol failure, store drop, or app termination.
- **Rust ownership:** verify neither TypeScript nor a public Tauri request can
  inject backend, model ID, revision, path, or URL.
- **Early refusal:** verify all non-System values fail in shared generate /
  streaming dispatch before availability/model/session work.
- **Wire compatibility:** verify old Rust → new helper (missing field) and new
  Rust → old helper (ignored unknown field) remain compatible.
- **Build coverage:** verify Xcode 26 arm64, x86_64, universal helper builds;
  do not infer Xcode 27 or `MLXLanguageModel` compatibility.
- **Boundary absence:** confirm there is no MLX package/lockfile, network fetch,
  model file, Application Support manager, workspace model, remote code,
  cloud fallback, Preferences UI, or App Store MLX exposure.

## Verification Evidence

- `npm run typecheck` — pass.
- `npm test` — 217 files / 1,832 tests pass.
- `npm run build:vite` — pass; existing large-chunk warning only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 369 passed / 2
  host-dependent ignored.
- Fixture-selected `cargo test apple_assist_supervisor` — 32 passed. The added
  black-box helper requires exact System backend injection in generate and
  streaming; existing cancel teardown coverage also passes.
- `npm run build:apple-assist-helper:fixture` — pass. Smoke covers missing,
  explicit System, Core AI, MLX, and unknown backend values.
- `npm run build:apple-assist-helper:live` — Xcode 26 arm64 / x86_64 /
  universal builds and availability probe pass.
- `npm run smoke:app-store-surface` — 10 files / 111 tests pass.
- `npm run build` — helper-enabled local App Store preview bundle passes;
  expected large-chunk and local no-notarization warnings only.
- `git diff --check` — pass after this evidence update.

## Explicitly Unproved / Out of Scope

- Xcode 27 / macOS 27 SDK compile behavior
- `MLXLanguageModel`, `mlx-swift-lm`, or any MLX runtime/model execution
- model download/import, revision pin, architecture/data validation, storage,
  memory/RSS preflight, unload, or selection UI
- App Store acceptance of an MLX runtime
- physical-device Local Assist interaction, TestFlight, upload, tag, or release

Route findings requiring those capabilities to M-0b. For this batch, request a
fix only for P0/P1 or an in-scope P2 involving the M-0a lifetime, wire,
compatibility, fail-closed, or non-exposure contracts.
