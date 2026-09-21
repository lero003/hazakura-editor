# Core AI production model preparation — 2026-09-20

Status: Both stages verified; Apple archives blocked by the installed Xcode tool
Scope: Gemma 4 production-candidate lock, runtime adapter, and Apple-hosted asset creation
Release meaning: Not a signed candidate, CDN upload, TestFlight acceptance, or catalog activation

## Decision

- Standard candidate: Gemma 4 E4B QAT int4, first acceptance target 16 GB Mac.
- Quality comparison: Gemma 4 12B QAT int8, first acceptance target 32 GB or larger Mac.
- Tiny Qwen remains a Developer-only wiring fixture and is not promoted.
- Community converted artifacts and runtime are pinned by commit and per-file SHA-256 because
  Apple `coreai-models` does not currently provide the selected Gemma 4 adapter.
- Product catalog remains empty until AOT, Background Assets transport, G1/G2, license review,
  Japanese-writing bake-off, and signed TestFlight device acceptance are complete.

Canonical model details and commands:
[`docs/core-ai-production-models.md`](../../core-ai-production-models.md).

## Source changes

- `scripts/core-ai-production-models.json`: immutable model/revision/file/asset-pack lock.
- `scripts/prepare-core-ai-model-assets.mjs`: resumable download, size/SHA verification,
  model metadata, expanded resource manifest, `ba-package evaluate`, and `.aar` creation.
- `src-helpers/apple-assist/CoreAIProduction.Package.resolved`: separate production runtime lock.
- Distribution helper uses CoreAIKit `KitGemmaModel` for E4B PLE resources and
  `KitLanguageModel` for the 12B bundle. Developer test builds retain Apple's CoreAILM path.
- Helper-side structural validation requires the pinned model identity, runtime layout,
  model bundle files, E4B per-layer tables, and model notice files before load.

## Local artifacts

Artifacts are ignored under `.hazakura/coreai-production/` and must not be committed.

| Model | Asset pack | Verified expanded bytes | Resource manifest SHA-256 | Local result |
| --- | --- | ---: | --- | --- |
| Gemma 4 E4B | `hazakura-coreai-gemma4-e4b-v1` | 6,807,926,119 | `d46c81f18147a2faf0d066b4ef2d31f72416b75ee544397580815fa2e4fb4af3` | source/stage verified; helper load + Japanese diagnostic passed; `.aar` toolchain-blocked |
| Gemma 4 12B | `hazakura-coreai-gemma4-12b-v1` | 14,698,432,594 | `ef68148765fd970a1f2c3022751caa1758fb58d196a1a6aeffe761e473ba3f8d` | source/stage verified; helper load + Japanese diagnostic passed; `.aar` toolchain-blocked |

## Verification

Completed in this slice:

- `npm test` — frontend 2,643 passed, then the integrated model-lock suite 9 passed.
- `npm run coreai:models:plan` — two candidates and exact locked bytes printed.
- `npm run typecheck` — passed.
- `npm run build:vite` — passed; existing chunk-size warning only.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 414 passed, 2 ignored.
- `swift test --package-path src-helpers/apple-assist` — 24 passed.
- `npm run smoke:app-store-surface` — 128 passed.
- `npm run build` — passed after the production CoreAIKit runtime update; existing deprecation,
  chunk-size, and one Rust dead-code warning only.
- Production E4B helper probe on the M4 Max / 128 GB host — `available`.
- One local E4B `proofread` diagnostic — generated the expected Japanese correction through
  `LanguageModelSession` in 7,376 ms. This is a path smoke, not a quality bake-off.
- Production 12B helper probe on the same M4 Max / 128 GB host — `available`.
- One local 12B `proofread` diagnostic — corrected `文章わ` to `文章は` through
  `LanguageModelSession` in 8,872 ms. This is also only a path smoke.

Still open after local asset completion:

- `.aar` creation for both candidates. **Correction (2026-09-21):** the blocker recorded below was
  a restricted-execution-environment effect, not a `ba-package` defect. Both archives now exist;
  see [the 2026-09-21 Apple-hosted E4B record](../2026-09-21-core-ai-apple-hosted-e4b/README.md).

Final source hygiene:

- `git diff --check` — passed after recording both staged artifacts and runtime diagnostics.

## Evidence boundary and residual risk

- The installed Xcode exposes `ba-package` but not `coreai-build`; architecture-specific
  `.aimodelc` AOT output is not available from this host and remains a release blocker.
- Xcode 27.0 (27A266a) `ba-package 2.0` rejects even Apple's documented `Manifest.json` shape at
  the extension check **while it runs inside the Codex seatbelt sandbox**; the same commands
  succeed from Terminal.app. This entry originally recorded the failure as a toolchain defect and
  is corrected here. No replacement archive was synthesized from a different tool.
- Artifact creation exercises file integrity and the archive tool, not runtime generation quality.
- The pinned community conversion recipes were inspected and recorded, but Hazakura did not
  re-export either model from the source checkpoint in this slice.
- Community conversion/runtime compatibility passed a local load and short generation diagnostic
  for both candidates on the 128 GB host, but neither is accepted on a physical 16 GB / 32 GB Mac.
- App Group, Downloader extension provisioning, `BA*` Info.plist keys, App Store Connect records,
  CDN processing, and `AssetPackManager` materialization are not present yet.
- G1 cross-window state sync and G2 verified-Ready remain mandatory before adding either model to
  `CoreAiModelStore::production_catalog()`.
- The pinned 12B conversion repository has conflicting license signals: Apache-2.0 in its model
  card and Gemma Terms in its standalone `LICENSE`. Both are preserved in the staged payload and
  human resolution remains mandatory before external TestFlight.
