# C-0 External Review Synthesis (2026-08-27)

Status: Advisory  
Scope: Four independent reviews of `docs/core-ai-c0-design.md` at `d28e0e24`  
Authority: Medium — does **not** override `docs/current-work.md` or the C-0 design SoT  
Last reviewed: 2026-08-27

Four read-only agents reviewed the pushed C-0 design from separate lenses
(product/UX, security/App Store, helper architecture, Apple API accuracy).
This note extracts consensus so the next slice can use one place instead of
the four transcripts.

- **Does:** pool strengths, avoid-list, and issues that two or more reviews
  agreed on.
- **Does not:** start U-1 or C-1, change the apply boundary, or pick a model
  identity.
- Queue of record remains `docs/current-work.md`.
- Design SoT remains `docs/core-ai-c0-design.md`.

Owner answers already in C-0: model identity deferred; inline chip is U-5
later; App Store may host allowlisted on-device downloads with disclosure
rewrites; larger-class model is code-reserved and hidden.

---

## Consensus strengths (keep)

| Theme | Why it matters |
|---|---|
| v2.6 Apply freeze | `applyReviewedLocalAssistProposal` remains the only buffer write. No auto-save. |
| Not Notion Agent | No history DB, workspace RAG, tool side effects, docking, ghost rewrite, PCC fallback. |
| SystemLanguageModel default | macOS 26/27 Local Assist keeps working without Core AI. |
| H-1 vs H-1b SDK split | `any LanguageModel` waits for the 27 SDK so the universal live helper still builds. |
| Four-state availability enum | Do not stuff Core AI fields into `AppleAssistAvailability`. Use a separate list command. |
| U-\* without C-1 | Composer/Diff/footer polish can ship on System only. |
| C-1 blocked on identity | Owner deferred the production model. Do not start catalog download yet. |
| Parent downloads, helper does not | Stream-to-temp in Rust. Do not copy `images.rs` `read_to_end`. |
| PCC is cloud | Do not treat Private Cloud Compute as on-device or as a silent fallback. |

---

## Consensus avoid list

- Claim **「Notion AI 級」** as a Goal, review bar, or release sentence. Take large composer, stream, and paper spacing. Keep Hazakura’s Safe Review shape.
- Start **C-1** before identity **and** hosting **and** disclosure (public Privacy Policy URL, Connect nutrition, Reviewer Note, Japanese UI).
- Put catalog **URLs in TypeScript**. Rust (or a blob only Rust reads) is source of truth; IPC is `entryId` only.
- Copy **`images.rs` timeouts / `read_to_end`** for multi-GB archives.
- **SIGKILL + 360s generate watchdog** as the Core AI specialize path.
- **`PrivateCloudComputeLanguageModel`**, Claude, Gemini, or Apple’s documented “PCC failed → retry on-device” sample as Local Assist fallback.
- Spotlight / OCR / Barcode tools; remote catalog index; GitHub Releases as the first host for 2GB+ files.
- Ghost rewrite in the editor; docking conversation into main chrome; mixing U-5 into U-1.
- Import **`CoreAI.framework` as if it were `CoreAILanguageModel`**. Session adapter is OSS `import CoreAILanguageModels`.
- Ship an App Store binary that **downloads a model but cannot generate with it** in the same reviewable build.

---

## Issues to fold into C-0 before U-1 / before C-1

Items below are **advisory**. Promote into `docs/core-ai-c0-design.md` only when
the next slice needs them. Do not bulk-edit the design in this note.

### Before U-1 (System UI polish)

| ID | Consensus | Notes |
|---|---|---|
| P1 | Drop “Notion AI 級” as the success bar | Product review: Goal 5 over-claims. Polish companion hierarchy; do not promise Notion’s in-page accept loop. |
| P2 | Keep the draft visible after generation | Collapsing the companion hero to a 3–4rem handoff can hide the prose if the main overlay is covered. Decide the eye-path (bring main forward vs keep a short “確認中” in companion). |
| P3 | U-3 acceptance is “readable prose”, not hunk chrome | Keep `DiffBody` if needed, but the review card must read as Japanese paragraphs. |
| P4 | Preset chips inject short human language, not the long system prompt, into the composer | Keep the five IDs. Change what the textarea shows. |
| P5 | Align `local-assist-conversational-edit-ux.md` with B2 | That UX SoT still draws Diff inside the companion. C-0/B2 put Diff on the main overlay. |
| P6 | Keep Preview honesty | Empty-state copy must not drop “quality is unstable” / preview. |
| P7 | Specify ⌘↩ vs IME Enter | Japanese composition must not send. |

### Before C-1 (download) — C-1 still waits on identity

| ID | Consensus | Notes |
|---|---|---|
| S1 | Guideline **Mac 2.4.5(iv)** is missing from C-0 | Downloaded `.aimodel` resources vs “adding functionality after review”. Reviewer Note must tell the story. Download UI in a submitted build needs a generate path in the same binary, or stay hidden. |
| S2 | D12 file list is incomplete | Must include the **public** Privacy Policy URL Connect uses, App Privacy nutrition, listing copy, Japanese UI disclosure, `security-boundary.md`, and assist-strategy “no network-required features” wording. |
| S3 | Catalog SoT is Rust | Conceptual TS type with `archiveUrl` contradicts “JS never holds URLs”. |
| S4 | Downloader acceptance is underspecified | HTTP 200 only (3xx is not success), hash the bytes on disk, `Accept-Encoding: identity`, Content-Length + running-byte cap, unpack allowlist (no Mach-O, drop exec bit), zip-bomb / disk peak, quit kills DL, URL match on host **and** path-component prefix. |
| S5 | Helper inherit still has network | Parent must download. Helper must not grow URLSession. Re-check `coreAiResourcesPath` inside the container. No PCC entitlement. |
| S6 | No remote catalog index | Updating models by fetching a new catalog.json is an updater (2.4.5(vii)). |

### Before H-1b / C-2

| ID | Consensus | Notes |
|---|---|---|
| A1 | Availability matrix | If Core AI is the machine default, do not disable the composer solely because `SystemLanguageModel` is off — unless the product decision is “Local Assist requires Apple Intelligence, Core AI is only a quality plugin”. Pick one. |
| A2 | Specialize is not generate | Need `prepare_backend` (or equivalent) + a known `WireEnvelope` kind + a timeout that is **not** the 360s generate watchdog. Unknown envelope kinds currently reset the child. |
| A3 | H-1b is two compile slices, one stdin protocol | arm64 may link `CoreAILanguageModels`; x86_64 stays System-only. Same helper protocol. Put `Package.swift` and `build-apple-assist-helper-live.sh` on the H-1b file list. |
| A4 | `maximumResponseTokens` | Stock Core AI executor defaults to **512** (2048 if reasoning). Long Markdown rewrite will truncate unless C-2 sets this. |
| A5 | Guided generation after engine load | `capabilities.contains(.guidedGeneration)` is a real API (WWDC sample). Probe again after `load()`. Stock Qwen3 vanilla may leak think-tags into guided output. |
| A6 | Context size is Apple-documented but inconsistent | Comparison tables say System 4K; WWDC samples print 8192 on 27. Measure `contextSize` / `tokenCount` on device. Do not hard-code either. |

---

## Unique useful items (single-source)

Treat as hints, not consensus.

- Product: overlay vs right-pane placement of Diff on L Mode; drop leftover `appliedStatus` that still says “confirm in Diff after apply”.
- Security: ATS no-arbitrary-loads pin; do not strip quarantine xattr without a review story; reserved 8B must not ship dead URLs/digests.
- Architecture: H-1 need not cache System model instances; G-1 must thread `menuLanguage` through `useAppleAssistProposalHandler`; `changeSummary` is `Option<String>` so fixture helpers still decode.
- Apple API: AFM 3 sizes are Apple ML Research, still not an app contract. `estimatedSizeOnDiskBytes` / `LoadMode` are the real D22/D23 knobs. OCR/Barcode live in Vision, Spotlight tool is `SpotlightSearchTool`.

---

## Apple facts: keep the labels

- **Documented:** `SystemLanguageModel`, four-state availability, `@Generable` on macOS 26, `LanguageModel` protocol on **27 SDK**, `CoreAILanguageModel(resourcesAt:)` in OSS package `CoreAILanguageModels`, PCC is server-side with entitlement and quota.
- **Measure on device:** `contextSize` (4K vs 8K samples), specialize time after helper kill, max tokens default, guided support after load.
- **Not an API contract:** AFM 3 parameter counts, Qwen3-4B byte size, Japanese 1 token ≈ 1 character as a product cap.

---

## What this review does *not* change

- Do not start C-1 until the owner picks a production identity.
- Do not reopen v2.6 apply.
- Physical Assist gate remains a separate human gate.
- Tag / App Store upload / App Review of `2.6.1` are unchanged by this note.

## Suggested next slice (advisory)

If the owner wants implementation next, **U-1** (composer-first + draft hero on SystemLanguageModel) is still the smallest slice. Fold P1–P7 into that PR’s acceptance, and do not wait for Core AI.

---

## Final pre-dev review (folded into C-0, 2026-08-27)

A follow-up review judged C-0 **APPROVE WITH CHANGES**. Those changes are now
in the design SoT as D10/D19/D20/D24–D29:

| Pri | Item | Decision id |
|---|---|---|
| P1 | Composer disable must follow **selected backend**, not SystemLanguageModel alone | D24 |
| P1 | TS generate must not send `backend` / catalog id. Rust `selectedId` is the only selector | D20 |
| P1 | Catalog needs `archiveSha256` **and** expanded `resourceManifest`; verify before load | D25 |
| P2 | Helper folds SDK errors into a Hazakura taxonomy | D26 |
| P2 | `changeSummary` is auxiliary; Diff after sanitizer is canonical | D10 |
| P2 | Compare Background Assets + AOT, then lock delivery | D19 + D28 |
| P3 | Overall mermaid: partials go companion-only; finals go main store → Diff | D27 |

**Gate now:** U-\* / H-1 / G-1 = GO. C-1 after identity + D25 + D19. C-2 after D24 + D20. Apply: do not touch.
