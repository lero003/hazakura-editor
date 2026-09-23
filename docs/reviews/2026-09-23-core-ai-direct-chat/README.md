# Core AI direct conversation probe

Status: Local model observation, not product or distribution acceptance
Scope: E4B v2 and 12B without Hazakura's editing prompt or candidate formatter
Last reviewed: 2026-09-23

## Method

`CoreAIConversationProbeTests` loads each staged model into a separate process and
passes the same four Japanese turns to macOS `LanguageModelSession`. The test uses
greedy decoding and a 160-token response limit. It does not call `AssistPrompt`,
`CandidateFormatting`, `ProofreadCandidateProtection`, or the app UI.

- E4B v2: pinned, locally patched CoreAIKit `KitGemmaModel` with per-token PLE provider.
- 12B: pinned CoreAIKit `KitLanguageModel` with the pipelined engine.
- The Apple `coreai-models` `llm-runner` also answered one 12B question directly.
  Its default 256-token warmup failed on this S=1 bundle; explicit pipelined
  engine and warmup off succeeded. This was a runner configuration failure,
  not a model response.

Both four-turn probes passed: each response was nonempty and turn 3 recalled
`青い栞` from turn 2. E4B v2 answered `青い栞`; 12B did too. Both produced coherent
two-sentence Japanese for a rain-cleared library scene. The E4B test took 26.4 s
and the 12B test 20.3 s including local load; these are not latency benchmarks.

Run the env-gated tests separately with `HAZAKURA_COREAI_DISTRIBUTION_BUILD=1`:

- `HAZAKURA_DIRECT_CHAT_E4B_ROOT`: E4B v2 resource root containing `decoder/` and `tables/`.
- `HAZAKURA_DIRECT_CHAT_12B_BUNDLE`: 12B directory containing `metadata.json`, a `.aimodel`, and `tokenizer/`.
- Filter `CoreAIConversationProbeTests/testE4BDirectConversation` or
  `CoreAIConversationProbeTests/test12BDirectConversation` so the models do not
  coexist in one process. Without the relevant env variable, the test skips.

## Boundary

This confirms only simple local conversation and short multi-turn recall on this
Mac. E4B uses the community CoreAIKit adapter plus Hazakura's provider patch, not
an Apple-only Gemma runner. The four answers do not establish Japanese editing
quality, long-context behavior, low-memory performance, app integration,
Apple-hosted acquisition, or TestFlight acceptance. The separate 12B editing
fixture still exposed outer prompt-envelope repetition and a no-request summary
that grew longer; those are not resolved by this probe.
