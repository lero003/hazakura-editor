# Core AI E4B wiring slice

Status: Source + unit-test record. Live E4B re-measurement not run here.
Scope: What Hazakura sends to and receives from the pinned Gemma 4 E4B / 12B adapters
Authority: Verification record
Last reviewed: 2026-09-21

## Why

The 16 GB 実機 report and the external review both pointed at the harness, not the model:
the additional-request branch discarded the operation's base instruction, `samplingMode`
never reached the pinned engine, and the tokenizer's `eos_token` resolution let `<eos>`
reach the body. This slice fixes the wiring before any settings surface or model change.

## Changes

| Area | Change | File |
| --- | --- | --- |
| Prompt contract | Base instruction, change/preserve scope, and the user's additional request are separate slots. Scope rules differ per action. The System path shares it. | `AssistPrompt.swift` |
| Generation settings | Requested vs effective sampling recorded in `usage`. top-k / top-p are not requested (the pinned engine reads only `temperature`) and are reported as dropped if ever set. | `CoreAIGenerationProfile.swift`, `Response.swift` |
| Output restore | Whole control tokens are stripped from the outer edges only, so a body that mentions a token keeps it. | `CandidateFormatting.swift` |
| Latency | One loaded production model is cached per helper process, keyed by model id + resource paths + size/mtime. Sessions stay per request. Released on helper exit, model/resource change, or idle (default 300 s; `HAZAKURA_CORE_AI_IDLE_RELEASE_SECONDS`). | `CoreAITestRuntime.swift`, `CoreAITestResourceContract.swift` |
| Evaluation | `noControlTokens` check; 3 fixtures with no additional request so the action-template branch is exercised; `fixtureCoverage` in the report; warm definition corrected. | `scripts/local-assist-evaluation-checks.mjs`, `scripts/fixtures/local-assist-evaluation.json`, `scripts/evaluate-local-assist.mjs` |

Generator behavior is unchanged: same operations, same sentinels, same single-writer Apply path,
same no-auto-apply boundary.

## Verification

- `swift test --disable-sandbox` (helper, fixture mode) — 37 tests pass
  (24 before; +13 for the prompt contract, the generation profile, and the control-token strip).
- `swift build -c release --disable-sandbox` (helper, live flavor) — pass.
- `bash scripts/build-apple-assist-helper-distribution.sh` (Core AI distribution flavor,
  arm64 release) — build complete; only the pre-existing `GenerationError` deprecation warnings.
- `npm run typecheck` — pass.
- `npm test` — 295 files / 2,646 tests pass; `test:scripts` 23 tests pass.
- `git diff --check` — clean.

## Not verified here

- **Live E4B / 12B inference.** The Codex execution sandbox does not hand the process a GPU
  device, so the production helper fails to load with
  `CoreAIKit.KitGemmaError.noMetalDevice`. The failure reproduces only inside the sandbox;
  `swift build` and `swift test` are unaffected. Quality and latency before/after must be measured
  in a normal shell with the command in `docs/core-ai-harness-quality.md`.
- The idle-release timer has no automated test: the Core AI target is compiled out of the
  fixture-mode test build, and the logic is short enough for direct review.
- Signed app / TestFlight, Apple CDN download, AOT, and the 16 GB bake-off remain separate gates.

## Next gate

1. Re-measure E4B (and optionally 12B) on the owner's shell, recording load time,
   time to first token, and generation time separately.
2. Bundle-side fix for `tokenizer_config.json` (`eos_token = "<eos>"` or `eos_token_id: 1`) plus a
   lock/reproduction update, then repeat the same fixtures.
3. Settings surface for the effective generation profile, sourced from this slice's `usage`
   record rather than duplicated in the webview.
