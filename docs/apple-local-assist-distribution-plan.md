# Apple Local Assist And Distribution Plan

Status: Planning
Scope: v0.12+ Apple Local Assist direction and App Store / developer-build release lanes
Authority: Medium
Last reviewed: 2026-06-05

## Implementation Snapshot (v0.12, in-progress)

The first 5 slices of the Apple Local Assist work-stream are landed. Code, not policy:

- **Types and boundary** — `src/lib/tauri/appleAssist.ts` + `src-tauri/src/commands/apple_assist.rs` define the 4-state availability enum, the 5-operation request shape, `MAX_SELECTED_CHARS=4000`, `MAX_CONTEXT_CHARS=8000` (char-count, not byte-count), and the `*_with_label` shim gated by `ensure_label_is_main` (main window only; the agent window is explicitly rejected, even though `ensure_label_is_main_or_agent` exists). Stub implementations only; no Foundation Models binding.
- **Availability probe** — `useAppleAssistAvailability` defaults to `unsupported`, calls `probe_apple_assist_availability` on mount, maps IPC failure to `unavailable` with a reason. The probe is cached per mount.
- **Review Desk handoff** — `useAppleAssistCandidate.generateAndCompare(operation, selectedText)` calls `generateAppleAssistCandidate` and hands the response to the existing `runCandidateCompare` with `candidateSourceLabel: copy.candidateSourceAppleAssist`. **No auto-apply.** The candidate flows through the same explicit-apply UX as the manual paste flow.
- **UI entry** — Two command palette entries (`Summarize selection`, `Rephrase selection`) gated on availability. Hidden when the probe is not `available`. Sit under a new `Apple Assist` command category that is locale-aware (`あっぷる あしす と` in kana, `Apple Assist` otherwise).
- **Swift helper feasibility (fixture mode)** — `src-helpers/apple-assist/` is a SwiftPM executable. `npm run build:apple-assist-helper:fixture` compiles it and writes `binaries/hazakura-apple-assist-helper-<rust-triple>`. The fixture build (no FoundationModels import) returns canned candidate JSON whose prefix matches the Rust stub (`【要約案】`, `【書き換え案】`). Smoke test in the build script asserts both envelopes.

- **Gate-default-hidden contract** — the Rust probe returns `Unavailable { reason: "Foundation Models binding is not yet implemented in this build." }` on macOS and `Unsupported` elsewhere in v0.12. It must never return `Available` until a future slice lands a real Foundation Models binding; the React side hides the command palette entries whenever the probe is not `Available`, and the stub generate response carries `modelId: "stub:v0.12"` so a future regression is easy to spot.

What is **not** done yet, and is gated on explicit approval:

- `tauri.conf.json` is unchanged — no `bundle.externalBin`, no `minimumSystemVersion` bump
- `bundle_identifier` and code-signing entitlements are untouched
- No live (non-fixture) Foundation Models binding; `live mode` falls back to `unsupported` / `deferred`
- No App Store sandbox or TestFlight changes
- No release tag, no GitHub Release, no App Store submission

## Official Information Confirmed (2026-06-05, slice 7)

The following facts are taken from Apple 公式 information only. Each subsection cites the source URL. These are the conditions that v0.12+ implementation must respect; the verbatim quotes we DO use are short (a sentence or two) and are reproduced because they pin down a contract we have to satisfy. Long verbatim lists of Apple's enumerated rules (e.g. the 19-item acceptable-use list) are deliberately summarized into themes so this memo does not rot when Apple updates the underlying page. Non-official speculation is excluded — anything we could not confirm against the cited pages is marked "TBD (verify with Xcode documentation viewer before implementation)."

### Platform & runtime requirements (from `apple.com/apple-intelligence/`)

- **Apple Intelligence-capable hardware**: iPhone 15 Pro / Pro Max and newer; iPad Pro / Air (M1+), iPad mini (A17 Pro); MacBook Air / Pro / iMac / Mac mini (M1+), Mac Studio (M1 Max+); Apple Vision Pro (M2+).
- **OS**: macOS 26 (Tahoe), iOS 26, iPadOS 26, visionOS 26. Apple Intelligence ページ上の visionOS 例: "Apple Intelligence requires Apple Vision Pro running visionOS 26."
- **Siri / device language** must be set to one of the supported languages: "Chinese (Simplified), Chinese (Traditional), English (Australia, Canada, India, Singapore, UK, U.S.), French (Canada, France), German, Italian, Japanese, Korean, and Spanish (Mexico, Spain)." Plus the page's caveat: "Some features may not be available in all languages or regions."
- **On-device only**: "Apple Intelligence is designed to protect your privacy at every step. It's integrated into the core of your iPhone, iPad, and Mac through on-device processing." For more complex requests Apple uses **Private Cloud Compute** ("Your data is never stored", "Used only for your requests", "Verifiable privacy promise"). The marketing page does not say "no network fallback" — only that the on-device path is the default.
- **Foundation Models framework access**: "any app can tap into the on-device models that power Apple Intelligence. Apps built with it work offline and it's all at no cost per request."

### Acceptable use (from `developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/`)

The Foundation Models framework acceptable-use page is a single short "Prohibited uses" section. It is a developer-facing list of categories the framework must not be used to produce. The full and current list lives on Apple's page (link below); we do not reproduce the enumerated items verbatim here so this memo does not rot when Apple updates them. The page's structure is a framing sentence ("You may not use, prompt, or expose the Foundation Models framework … in a manner that:") followed by roughly twenty enumerated categories, which group into a few big themes:

- **Illicit / harmful content** — violence, self-harm, child safety, fraud, defamation, pornography, weapons.
- **Regulated domains** — healthcare, legal, financial, employment, law-enforcement, social scoring, biometrics-inferring attributes.
- **Security / rights / misrepresentation** — unauthorized network/system access, IP / publicity / privacy infringement (including Apple's), false or derogatory portrayal of Apple or its products.
- **Framework integrity** — circumventing the framework's safety policies, guardrails, or restrictions; reproducing or citing the framework's training data; generating scholarly / academic / courseware / trade-book products.
- **General** — illegal activity.

**Hazakura の実装判断 (v0.12):**

- 5 operation (`summarize` / `rephrase` / `extract` / `proofread` / `explain_diff`) はすべて選択範囲ベース・ユーザー所有文書に対する編集補助であり、Apple の "framework が研究製品 / 教科書 / 商用出版物を生成する" カテゴリに直接かかる経路は設計上ない。操作 UI に「教科書 chapter を一括で生成する」「学術論文ドラフトを 0 から起こさせる」ボタンを置く予定はない。
- ただし `proofread` / `rephrase` は入力次第で規制領域 (medical / legal / financial) や academic / courseware 寄りの使われ方に流れうる。これは operation 単体の判定で線引きするのではなく、feature 全体としての防御線 (下記) で押さえる方針。
- 採用可能性が高いのは、以下 4 条件がすべて揃った v0.12 の形: **(1) 選択範囲ベース・bounded 入力** (`MAX_SELECTED_CHARS=4000` / `MAX_CONTEXT_CHARS=8000` で caller 側 cap)、**(2) ユーザー所有の Markdown / テキスト文書**、**(3) framework の拒否を尊重** (Refusal が出てきたらそのまま Review Desk で見せる、無音リトライしない、instructions フィールドを user 編集させない)、**(4) auto-apply なし** + **in-app disclosure あり**。このセットが崩れたら gate を閉じる。
- framework 内の安全機能を strip / override / 隠す経路は作らない (system prompt editor / jailbreak template / 無音 retry などは non-goal)。
- **In-app disclosure**: App Store 提出前に、feature が Apple Intelligence / Foundation Models framework を使っており、Apple の acceptable-use rules の対象であり、output の利用責任はユーザーにある旨の短い注記を UI に出す。これは App Review 5.1.1(Privacy) / 5.1.2(i) (third-party AI disclosure) の両方の supporting になる。

### App Review constraints (from `developer.apple.com/app-store/review/guidelines/`)

The Guidelines text does not contain a clause specifically targeting on-device LLMs or the Foundation Models framework. The clauses that touch an Apple-Local-Assist-style feature:

- **5.1.2(i)** (Data Use and Sharing): "You must clearly disclose where personal data will be shared with third parties, **including with third-party AI**, and obtain explicit permission before doing so." This is the only clause in the actual guideline text that names "AI." It is a privacy/disclosure requirement. *Reading for us:* on-device Foundation Models does not transmit user data to Apple or a third party by default, so this clause is satisfied without a per-prompt consent dialog as long as our privacy policy says so.
- **2.5.2** (no downloaded/executed code): "Apps should be self-contained in their bundles, and may not read or write data outside the designated container area, nor may they download, install, or execute code which introduces or changes features or functionality of the app." *Reading for us:* an Apple-Local-Assist feature that uses the on-device model in-process does not download or execute new code. Fine.
- **2.4.2** (no unrelated background processes): the precedent is "cryptocurrency mining" is not allowed. *Reading for us:* the helper sidecar would only spawn on a user-initiated command-palette invocation, not in the background. This matches the spec. A live binding must not background-poll the model.
- **2.4.5(i)** (Mac App Store sandbox): "They must be appropriately sandboxed, and follow [macOS File System Documentation]." *Reading for us:* the macOS App Store build of `hazakura editor` is already sandboxed. The helper sidecar runs inside the sandbox; spawning a bundled `binaries/...` helper from the Tauri host process is allowed under the existing sandbox as long as it stays inside the bundle container. **TBD (verify):** whether the App Store sandbox requires any specific entitlement for the sidecar spawn path.
- **5.1.1 (Privacy)**: full privacy framework (privacy policy URL, consent, data minimization, no covert profiling). *Reading for us:* the in-app disclosure recommended above also satisfies the privacy-policy component. We do not log the prompt or the candidate, do not sync them to a server, do not share them with a third party.
- **4.7 (Mini apps / chatbots)**: 4.7.2 says "Your app may not extend or expose native platform APIs or technologies to the software without prior permission from Apple." *Reading for us:* we are not embedding a third-party chatbot or mini-app runtime; the editor itself calls the Foundation Models framework. Fine.
- **No new entitlement is enumerated** for Foundation Models in the current Guidelines text. If Apple's posture changes between now and the App Store submission, we may need to file an entitlement request.

### Framework API surface (from `developer.apple.com/videos/play/wwdc2025/286/`)

- The on-device model is "a large language model with 3 billion parameters, each quantized to 2 bits" — "several orders of magnitude bigger than any other models that are part of the operating system."
- "The model can only run on Apple Intelligence-enabled devices in supported regions." (This matches the Apple Intelligence page's device list above.)
- "All of this runs on-device, so all data going into and out of the model stays private. That also means it can run offline! And it's built into the operating system, so it won't increase your app size."
- "Optimized for use cases like summarization, extraction, classification, and many more. It's not designed for world knowledge or advanced reasoning, which are tasks you might typically use server-scale LLMs for." (Reading for us: our 5-operation scope — `summarize` / `rephrase` / `extract` / `proofread` / `explain_diff` — is exactly the on-device sweet spot.)
- **Key types**:
  - `SystemLanguageModel.useCase` (e.g. `.contentTagging`) for specialized adapters.
  - `LanguageModelSession` — stateful, retains context, `isResponding` for concurrent-prompt gating, `transcript` to inspect prior turns.
  - `@Generable` and `@Guide` macros — guided generation with constrained decoding; "the model will never produce invalid tool names or arguments" because "tool calling is built on guided generation."
  - `Tool` protocol — model-driven tool calling; **we will not use this in v0.12** (out of scope per `assist-surface-strategy.md`).
  - `streamResponse` / `PartiallyGenerated` types — for token-by-token streaming of structured output.
- **Availability**: "a two case enum that's either available or unavailable. If it's unavailable, you also receive a reason so you can adjust your UI accordingly." Our Rust-side 4-state model (`available` / `unavailable { reason }` / `disabled` / `unsupported`) maps to this naturally: Apple gives us `(available | unavailable(reason))` at the framework level, and `disabled` / `unsupported` are the user/OS states we layer on top.
- **Errors to handle**: "guardrail violation, unsupported language, or context window exceeded." Our Rust stub should map these to candidate errors that surface as "Apple Assist returned an error" in Review Desk — never to an auto-apply / silent retry.
- **Security guidance**: "Instructions should come from you, the developer, while prompts can come from the user. This is because the model is trained to obey instructions over prompts. This helps protect against prompt injection attacks, but is by no means bullet proof. As a general rule, instructions are mostly static, and it's best not to interpolate untrusted user input into the instructions." *Reading for us:* the Swift helper's `instructions` parameter is the only place untrusted user content enters the model; the per-call `prompt` is bounded by `MAX_SELECTED_CHARS = 4000` and `MAX_CONTEXT_CHARS = 8000` (already in the Rust contract). The helper must not let the user *edit* `instructions`. The Review Desk handoff remains the trust boundary.

### Items still TBD (cannot confirm against the cited pages alone)

- **Exact `@available(macOS, introduced: 26.0, *)` annotation on `SystemLanguageModel`** — the reference page did not render via WebFetch. Must be re-verified against the Xcode documentation viewer before any live binding is written.
- **App Store sandbox behavior of spawning a bundled `binaries/...` sidecar** — not directly addressed by the App Review Guidelines. Apple's developer forums / a TSFI / a pre-submission inquiry is the right path; we should not rely on inference.
- **`minimumSystemVersion` policy** — the marketing page does not state a per-platform minimum. The reference page (when renderable) will give the `@available` annotation. Until then, `tauri.conf.json` stays at `11.0` (the v0.11.0 value) and a follow-up slice decides whether the App Store build or only a "developer with Apple Local Assist" build flavor raises it to `26.0`.
- **Code signing / notarization of the helper** — the App Review Guidelines do not address `externalBin` directly. macOS Developer ID signing + notarization rules (separate from App Review) cover this, and the existing v0.10/v0.11 warning-expected DMG lane gives us a working precedent.
- **Foundation Models acceptable-use on non-Apple-Intelligence devices** — the acceptable-use page applies whenever the framework is invoked. If we ever call the framework on a device that does *not* satisfy the device list above, the framework should refuse. We will not paper over that refusal.

### Sources cited in this section

- <https://www.apple.com/apple-intelligence/>
- <https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/>
- <https://developer.apple.com/app-store/review/guidelines/>
- <https://developer.apple.com/videos/play/wwdc2025/286/>

Anything beyond what these four pages say is **not** in the record above.

## Purpose

This memo turns the rough v0.12 Apple Local Assist idea into a release and architecture direction.

The goal is not to turn `hazakura editor` into a general AI agent platform. The goal is to make the existing Markdown-first editor feel more helpful by adding on-device document assistance where Apple Intelligence is available, while keeping every generated change explicit, reviewable, and reversible.

## Product Decision

Apple Local Assist should be treated as an **Assist Surface provider class**, not as a widening of Safe Editor and not as a CLI-agent provider.

The user-facing shape can still feel unified:

```txt
Assist Surface
=
none
or Apple Local document assist
or External Agent Workbench
```

But the trust boundaries stay different:

- **Safe Editor** remains the default text editor.
- **Apple Local Assist** is document help only: selected text or a document excerpt in, candidate text out.
- **External Agent Workbench** remains the separate CLI-agent trust boundary.

Implementation may reuse Agent Workbench patterns such as active-vs-preference state, restart-required changes, availability probes, and explicit consent. It must not describe Apple Local Assist as a CLI agent, tool-calling automation layer, shell, provider plugin, or automatic edit system.

## Initial Apple Local Assist Scope

v0.12 should start with the smallest useful document-assist surface:

- summarize selected text or the current section
- rephrase selected text
- optionally extract TODOs / headings / review points after the first two flows are stable

Every output must flow through Review Desk, Diff, or an equivalent explicit review/apply step before the document changes.

The first implementation must not include:

- generic chat
- background workspace indexing
- broad workspace context by default
- tool calling with side effects
- command execution
- local HTTP fallback
- external LLM fallback
- provider-add UI
- automatic file application
- automatic save

## Availability And Runtime Rules

Foundation Models is an on-device Apple Intelligence framework. It must be treated as optional at runtime, not as a hard requirement for the whole app.

Apple Local Assist must:

- check model availability before showing or enabling actions
- explain unavailable states without blocking Safe Editor
- send only the selected text or bounded document excerpt needed for the requested task
- cap input size before invoking the helper
- serialize requests or reject concurrent requests if the model/session cannot safely handle them
- expose no network-backed fallback in the App Store build

## Candidate Architecture

The current candidate shape is a narrow macOS helper boundary:

```txt
hazakura editor
  -> structured Apple Local Assist request
bundled Swift helper
  -> Foundation Models framework
hazakura editor
  <- structured candidate response
Review Desk / Diff
  -> explicit apply or discard
```

This keeps macOS-only model code away from the cross-platform editor core and makes the data boundary inspectable.

Open implementation questions before locking the design:

- whether the helper should be a bundled sidecar process or a Swift/AppKit integration layer
- whether the helper is acceptable under Mac App Store sandboxing in the final build
- whether Apple Local Assist should require restart-required preference changes or can be enabled dynamically
- whether the App Store build should raise the minimum macOS version, or whether only the Apple Local feature should be availability-gated

Do not raise the minimum OS for every distribution lane merely to support Apple Local Assist. Decide per build variant after the Foundation Models SDK and App Store sandbox proof is complete.

## Distribution Lanes

### App Store Build

Goal: a clean, sandboxed, reviewable build for ordinary users.

Include:

- Safe Editor
- L Mode
- Review Desk / Diff
- Apple Local Assist when available
- bounded workspace file access through user-selected files/folders

Exclude:

- External Agent Workbench
- CLI provider launch
- arbitrary process execution
- generic terminal behavior
- provider-add UI
- custom updater
- warning-expected unsigned/not-notarized messaging

This build should be prepared through TestFlight before App Store submission.

### Developer Build

Goal: preserve the current developer-oriented preview lane.

May include:

- External Agent Workbench
- allowlisted local CLI providers
- warning-expected DMG previews until the Developer ID lane is complete

Future Developer ID signing and notarization can make this build easier to share outside the App Store, but it should remain distinct from the App Store build if it includes CLI-agent behavior.

### Warning-Expected DMG Preview

Goal: continue short preview releases while distribution quality is still moving.

Rules:

- keep ad-hoc signing / no notarization explicit
- keep remote asset verification after publication
- do not describe this lane as App Store-ready or distribution-grade

## Release Sequence

### v0.12: Apple Local Assist Planning And Prototype

Target:

- availability probe
- selected-text summarize
- selected-text rephrase
- Review Desk / Diff handoff
- unavailable-state UI
- clear App Store build separation decision

Exit criteria:

- no Safe Editor behavior depends on Apple Local availability
- generated text never applies without explicit review
- App Store build exclusions are documented and testable
- Foundation Models acceptable-use and availability notes are reflected in release docs

### v0.13: Assist Preview

Target:

- add extract / proofread / explain-diff only if v0.12 is stable
- polish prompts and candidate labels
- verify App Store build can omit External Agent Workbench cleanly

### v0.14: Distribution Hardening

Target:

- App Store sandbox / entitlement review
- build variant automation
- TestFlight packaging
- App Review notes draft
- separate Developer ID / notarization plan for non-App-Store builds

### v1.0: App Store Candidate

Target:

- TestFlight feedback incorporated
- App Store build submitted with Safe Editor + Apple Local Assist only
- Developer build remains separate if Agent Workbench continues

## App Review Notes To Prepare

Before App Store submission, prepare concise review notes that explain:

- the app is a Markdown/text editor
- Apple Local Assist is optional and on-device
- the app checks availability at runtime
- generated text is shown as a candidate and requires explicit user review/apply
- the App Store build does not include External Agent Workbench or arbitrary command execution
- file access is user-selected and workspace-bounded

## References

- [Assist Surface Strategy](assist-surface-strategy.md)
- [Security Boundary](security-boundary.md)
- [Agent Workbench Boundary](agent-workbench-boundary.md)
- [Foundation Models](https://developer.apple.com/documentation/FoundationModels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models)
- [Acceptable use requirements for the Foundation Models framework](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
