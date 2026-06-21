# Apple Local Assist And Distribution Plan

Status: Planning
Scope: v0.12+ Apple Local Assist direction and App Store / developer-build release lanes
Authority: Medium
Last reviewed: 2026-06-21

## Implementation Snapshot (v0.12, in-progress)

Apple Local Assist has moved from fixture-only plumbing to a live local preview on `main`. Code state, not release policy:

- **Types and boundary** — `src/lib/tauri/appleAssist.ts` + `src-tauri/src/commands/apple_assist.rs` define the availability enum, request limits, and window-label gates. Apple Local Assist stays main-window / Apple Local Assist-window scoped and is not a CLI-agent provider.
- **Bundled helper** — `npm run build` builds a release Swift helper, bundles it through `tauri.conf.json` `bundle.externalBin`, and signs it with the local app bundle.
- **Live binding** — the helper uses `SystemLanguageModel.default.availability` for probe and `LanguageModelSession.respond` for bounded candidate generation when Apple Foundation Models is available on the current Mac.
- **Writing Companion UX** — the current product direction is the external Writing Companion / Assist Window in [Apple Local Assist Writing Companion Plan](apple-local-assist-writing-companion-plan.md): useful in normal editor and L Mode, tolerant of rough writing requests, and able to make explicit unsaved AI edit transactions with Diff / history review.
- **Safe Editor fallback** — live generation depends on macOS 26+ Apple Foundation Models availability and local Apple Intelligence state. Safe Editor remains usable when Apple Local Assist is unavailable or unsupported.
- **Alpha positioning** — Apple Local Assist is an experimental lightweight text-assistance feature. It is not the main AI feature and not a replacement for External Agent Workbench, external AI agents, future local LLM runtimes, or advanced review tools.

What is **not** done yet:

- no uploaded helper-enabled App Store / TestFlight package evidence yet
- no Developer ID signing / notarization lane for the bundled helper
- the editor-wide `minimumSystemVersion` later moved to `15.0` for the
  v0.19 App Store package candidate; this is separate from any future
  Apple Local Assist / Foundation Models `26.0` requirement
- no release tag, no GitHub Release, no App Store submission for this live helper state

The current App Store submission lane has reopened Apple Local Assist in the narrow on-device writing-companion shape: `HAZAKURA_DISTRIBUTION_LANE=app-store` / `VITE_HAZAKURA_DISTRIBUTION_LANE=app-store` still hides External Agent Workbench and CLI Agent IPC, but allows Apple Local Assist window / probe / generation / AI edit transaction IPC and uses an App Store Tauri config with the bundled helper sidecar. Earlier helper-free package evidence remains historical evidence for already-submitted builds, not the current source default.

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
- 採用可能性が高いのは、以下 4 条件がすべて揃った v0.12+ の形: **(1) 現在の執筆文脈に対する bounded 入力** (`MAX_SELECTED_CHARS=4000` / `MAX_CONTEXT_CHARS=8000` で caller 側 cap)、**(2) ユーザー所有の Markdown / テキスト文書**、**(3) framework の拒否を尊重** (Refusal が出てきたらそのまま review surface で見せる、無音リトライしない、instructions フィールドを user 編集させない)、**(4) AI edit transaction + no auto-save + in-app disclosure**。このセットが崩れたら gate を閉じる。
- framework 内の安全機能を strip / override / 隠す経路は作らない (system prompt editor / jailbreak template / 無音 retry などは non-goal)。
- **In-app disclosure**: App Store 提出前に、feature が Apple Intelligence / Foundation Models framework を使っており、Apple の acceptable-use rules の対象であり、output の利用責任はユーザーにある旨の短い注記を UI に出す。これは App Review 5.1.1(Privacy) / 5.1.2(i) (third-party AI disclosure) の両方の supporting になる。

### App Review constraints (from `developer.apple.com/app-store/review/guidelines/`)

The Guidelines text does not contain a clause specifically targeting on-device LLMs or the Foundation Models framework. The clauses that touch an Apple-Local-Assist-style feature:

- **5.1.2(i)** (Data Use and Sharing): "You must clearly disclose where personal data will be shared with third parties, **including with third-party AI**, and obtain explicit permission before doing so." This is the only clause in the actual guideline text that names "AI." It is a privacy/disclosure requirement. *Reading for us:* on-device Foundation Models does not transmit user data to Apple or a third party by default, so this clause is satisfied without a per-prompt consent dialog as long as our privacy policy says so.
- **2.5.2** (no downloaded/executed code): "Apps should be self-contained in their bundles, and may not read or write data outside the designated container area, nor may they download, install, or execute code which introduces or changes features or functionality of the app." *Reading for us:* an Apple-Local-Assist feature that uses the on-device model in-process does not download or execute new code. Fine.
- **2.4.2** (no unrelated background processes): the precedent is "cryptocurrency mining" is not allowed. *Reading for us:* the helper sidecar would only spawn on a user-initiated command-palette invocation, not in the background. This matches the spec. A live binding must not background-poll the model.
- **2.4.5(i)** (Mac App Store sandbox): "They must be appropriately sandboxed, and follow [macOS File System Documentation]." *Reading for us:* the macOS App Store build of `Hazakura Editor` is already sandboxed. The helper sidecar runs inside the sandbox; spawning a bundled `binaries/...` helper from the Tauri host process is allowed under the existing sandbox as long as it stays inside the bundle container. **TBD (verify):** whether the App Store sandbox requires any specific entitlement for the sidecar spawn path.
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
- **Errors to handle**: "guardrail violation, unsupported language, or context window exceeded." Our Rust stub should map these to candidate errors that surface as "Apple Local Assist returned an error" in the companion / review surface — never to hidden application, auto-save, or silent retry.
- **Security guidance**: "Instructions should come from you, the developer, while prompts can come from the user. This is because the model is trained to obey instructions over prompts. This helps protect against prompt injection attacks, but is by no means bullet proof. As a general rule, instructions are mostly static, and it's best not to interpolate untrusted user input into the instructions." *Reading for us:* the Swift helper's `instructions` parameter is the only place untrusted user content enters the model; the per-call `prompt` is bounded by `MAX_SELECTED_CHARS = 4000` and `MAX_CONTEXT_CHARS = 8000` (already in the Rust contract). The helper must not let the user *edit* `instructions`. The AI edit transaction / review surface remains the trust boundary.

### Items still TBD (cannot confirm against the cited pages alone)

- **Exact `@available(macOS, introduced: 26.0, *)` annotation on `SystemLanguageModel`** — the reference page did not render via WebFetch. Must be re-verified against the Xcode documentation viewer before any live binding is written.
- **App Store sandbox behavior of spawning a bundled `binaries/...` sidecar** — not directly addressed by the App Review Guidelines. Apple's developer forums / a TSFI / a pre-submission inquiry is the right path; we should not rely on inference.
- **`minimumSystemVersion` policy** — the marketing page does not state
  a per-platform minimum. The editor-wide value is now `15.0` for the
  v0.19 App Store package candidate. A separate follow-up still decides
  whether any Apple Local Assist / Foundation Models build flavor raises
  the minimum to `26.0`.
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

The goal is not to turn `Hazakura Editor` into a general AI agent platform. The goal is to make the existing Markdown-first editor feel more helpful by adding on-device document assistance where Apple Intelligence is available, while keeping every generated change explicit, reviewable, and reversible.

User-facing wording should set expectations accordingly: Apple Local Assist is an **alpha / experimental** local writing helper for short summaries, rephrasing, heading / tag ideas, light cleanup, and short explanations. It should not be marketed as "Apple's AI inside hazakura" or as a serious alternative to Codex, Claude Code, OpenCode, pi, or future local LLM runtimes.

## Product Decision

Apple Local Assist should be treated as an **Assist Surface provider class**, not as a widening of Safe Editor and not as a CLI-agent provider.

The user-facing shape can still feel unified:

```txt
Assist Surface
=
none
or Apple Local Writing Companion
or External Agent Workbench
```

But the trust boundaries stay different:

- **Safe Editor** remains the default text editor.
- **Apple Local Assist** is experimental lightweight document-writing help only: current writing context in, candidate text or an AI edit transaction out.
- **External Agent Workbench** remains the separate CLI-agent trust boundary.

Implementation may reuse Agent Workbench patterns such as active-vs-preference state, restart-required changes, availability probes, and explicit consent. It must not describe Apple Local Assist as a CLI agent, tool-calling automation layer, shell, provider plugin, or automatic edit system.

## User-Facing Labeling

Preferred labels:

- primary display name: **Apple Local Assist**
- settings option: **Apple Local Assist (Experimental)**
- status / badge: **Alpha** or **Experimental**

Short settings explanation:

```txt
Apple Local Assist is an experimental on-device writing helper for Apple Intelligence-capable environments. Use it for lightweight text assistance such as short summaries, rephrasing, heading ideas, tag suggestions, and light cleanup. Output quality may vary, and this feature may change or be removed.
```

Japanese UI explanation:

```txt
Apple Local Assist は、Apple Intelligence 対応環境で利用できる実験的なオンデバイス文章補助です。短い要約、言い換え、見出し案、タグ候補、軽い整形に利用できます。出力品質は安定しない場合があり、この機能は今後変更または削除される可能性があります。
```

Short distinction for users:

- **Apple Local Assist**: lightweight local text assistance for the current writing context; edits remain unsaved and diff-reviewable.
- **External Agent Workbench**: explicit external CLI-agent boundary for selected workspaces; not part of the default Safe Editor experience.

Do not use UI wording that implies Apple Local Assist is a general "AI Assistant", a coding agent, an autonomous reviewer, or a replacement for external agents.

## Experimental Feature Contract

Treat `apple-local` as an experimental Assist Surface provider:

- It remains off unless selected in Assist Surface settings and restart-applied.
- The settings UI must show `Alpha` / `Experimental` labeling and availability state.
- Availability must be probed at runtime; unavailable / unsupported / language-limited states must be shown in the settings and companion surfaces.
- It must not fall back to network LLMs, hidden fixtures, external CLI agents, or future custom providers.
- Candidate generation must stay user-initiated, bounded to the current writing context, and recorded as an unsaved AI edit transaction when it changes the buffer.
- The feature may change or be removed while it remains alpha.

## Initial Apple Local Assist Scope

v0.12 should start with the smallest useful Writing Companion mock:

- external Assist Window that replaces, rather than coexists with, the Agent Window slot
- rough writing requests such as "整えて", "続きを書いて", "自然にして", "校正して", and "この章を直して"
- bounded target inference from selection, current paragraph / block, or current section
- fixture-backed direct unsaved buffer edit through an AI edit transaction
- visible route to Diff / change history before saving

Every AI-written buffer change must be explicit, unsaved, recorded, reviewable, and reversible. The older command-palette selected-text summarize / rephrase entries remain useful as plumbing and tests, but they are not the final product experience.

The first implementation must not include:

- generic chat
- background workspace indexing
- broad workspace context by default
- tool calling with side effects
- command execution
- local HTTP fallback
- external LLM fallback
- provider-add UI
- hidden or irreversible file application
- automatic save

## Availability And Runtime Rules

Foundation Models is an on-device Apple Intelligence framework. It must be treated as optional at runtime, not as a hard requirement for the whole app.

Apple Local Assist must:

- check model availability before showing or enabling actions
- explain unavailable states without blocking Safe Editor
- send only the selected text, current writing block / section, or bounded document excerpt needed for the requested task
- cap input size before invoking the helper
- serialize requests or reject concurrent requests if the model/session cannot safely handle them
- expose no network-backed fallback in the App Store build

## Candidate Architecture

The current candidate shape is a narrow macOS helper boundary:

```txt
Hazakura Editor
  -> structured Apple Local Assist request for current writing context
bundled Swift helper
  -> Foundation Models framework
Hazakura Editor
  <- structured candidate response / edit proposal
AI edit transaction
  -> unsaved buffer change, Diff / history remains available
```

This keeps macOS-only model code away from the cross-platform editor core and makes the data boundary inspectable.

Open implementation questions before locking the design:

- whether the helper should be a bundled sidecar process or a Swift/AppKit integration layer
- whether the helper is acceptable under Mac App Store sandboxing in the final build
- whether Apple Local Assist should require restart-required preference changes or can be enabled dynamically
- whether the App Store build should raise the minimum macOS version, or whether only the Apple Local feature should be availability-gated

Do not raise the minimum OS to `26.0` for every distribution lane merely
to support Apple Local Assist. Decide per build variant after the
Foundation Models SDK and App Store sandbox proof is complete.

## Distribution Lanes

Long-term public distribution should converge on **two binary lanes only**:

1. **App Store Build** for ordinary users.
2. **Developer / GitHub Build** for users who intentionally want the External Agent Workbench boundary.

An official website, if created, should act as a download / explanation hub that links to the App Store and GitHub Release assets. It should not introduce a third "official free build" unless there is a fresh reason to own the extra signing, notarization, checksum, update, support, and messaging burden.

### App Store Build

Goal: a clean, sandboxed, reviewable build for ordinary users.

Include:

- Safe Editor
- L Mode
- Diff / explicit change review
- bounded workspace file access through user-selected files/folders
- Apple Local Assist when available, limited to on-device writing help
  and explicit unsaved AI edit transactions

Exclude:

- External Agent Workbench
- CLI provider launch
- external AI/API calls
- arbitrary process execution
- generic terminal behavior
- provider-add UI
- custom updater
- warning-expected unsigned/not-notarized messaging

This build should be prepared through TestFlight before App Store submission,
with Apple Local Assist unavailable states and no-network-fallback behavior
included in the smoke notes.

### Developer Build

Goal: preserve the developer-oriented GitHub lane.

May include:

- Safe Editor
- L Mode
- Diff / explicit change review
- Apple Local Assist when available
- External Agent Workbench
- allowlisted local CLI providers

This lane should move toward Developer ID signing and notarization before being described as broadly shareable outside the App Store. It must remain distinct from the App Store build while it includes CLI-agent behavior.

### Warning-Expected DMG Preview

Goal: continue short GitHub preview releases while distribution quality is still moving.

This is a temporary packaging state inside the Developer / GitHub lane, not a third public product lane.

Rules:

- keep ad-hoc signing / no notarization explicit
- keep remote asset verification after publication
- do not describe this lane as App Store-ready or distribution-grade

## Release Sequence

### v0.12: Apple Local Assist Writing Companion Prototype

Target:

- availability probe
- external Writing Companion mock that replaces the Agent Window slot
- rough writing requests against current editor context
- AI edit transaction for explicit unsaved buffer changes
- Diff / change-history escape hatch
- unavailable-state UI
- clear App Store build separation decision

Exit criteria:

- no Safe Editor behavior depends on Apple Local availability
- generated text never saves automatically and never applies as a hidden or irreversible change
- AI edits are attributable to Apple Local Assist and inspectable before save
- App Store build exclusions are documented and testable
- Foundation Models acceptable-use and availability notes are reflected in release docs

### v0.13: Distribution Probe

Target:

- verify App Store build can omit External Agent Workbench cleanly
- draft sandbox entitlements and identify any temporary-exception risk
- prove whether the bundled Apple Local Assist helper can run under sandbox assumptions
- prepare App Review notes before App Store/TestFlight packaging
- keep Apple Local Assist quality polish secondary until the distribution lane shape is proven

Reference: [v0.13 Distribution Probe](archive/planning/v0.13-distribution-probe.md).

### v0.14: L Mode Stability / Assist Harness Polish

Target:

- land the first L Mode stability ramp without changing the Markdown-first document model
- improve Apple Local Assist request context around the active target
- make Assist apply errors clearer and localized
- keep App Store / Developer build separation intact without claiming App Store readiness

### v0.15-v0.17: App Brush-up / Warning-expected DMG Previews

Target:

- app-quality smoke and small polish for the App Store lane
- build variant automation after v0.13 lane decisions
- TestFlight packaging when signing access makes it practical
- App Review notes draft
- Developer / GitHub build signing and notarization plan
- official website/download-page wording, if needed, as links to the two binary lanes

These release notes and review packets are historical evidence now. Use
`docs/current-work.md` for the current v0.19 App Store
submission-candidate queue.

### v0.18: UX Polish / Submission Prep

Target:

- finish small editor UX fixes that affect daily writing confidence
- define App Store entitlement and signing lane before claiming submission
  readiness
- finalize App Review Notes, privacy/support metadata, and third-party
  license packet
- keep Agent Workbench, CLI launch, arbitrary command execution, network
  fallback, and external AI/API calls out of the App Store lane

### v1.0: App Store Candidate

Target:

- TestFlight feedback incorporated
- App Store build submitted as Safe Editor + L Mode + local review/export only
- Developer build remains separate if Apple Local Assist or Agent Workbench continues

## App Review Notes To Prepare

Before App Store submission, prepare concise review notes that explain:

- the app is a Markdown/text editor
- Apple Local Assist is included only as an on-device, availability-gated writing companion with explicit review before save
- the App Store build does not include External Agent Workbench, CLI launch, arbitrary command execution, external AI/API calls, network fallback, or network-required features
- file access is user-selected and workspace-bounded

## References

- [Assist Surface Strategy](assist-surface-strategy.md)
- [Apple Local Assist Writing Companion Plan](apple-local-assist-writing-companion-plan.md)
- [Security Boundary](security-boundary.md)
- [Agent Workbench Boundary](agent-workbench-boundary.md)
- [Foundation Models](https://developer.apple.com/documentation/FoundationModels/)
- [Generating content and performing tasks with Foundation Models](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models)
- [Acceptable use requirements for the Foundation Models framework](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
