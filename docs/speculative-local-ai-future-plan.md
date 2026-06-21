# Speculative Local AI Future Plan

Status: Speculative
Scope: v1.x+ / v2.x+ / v3.x+ long-range AI direction
Authority: Low
Last reviewed: 2026-06-15

## Summary

This memo preserves a long-range product direction for `Hazakura Editor`.

It is **not** an implementation plan, release commitment, or approval to widen
the Safe Editor trust boundary. The ideas here may change or be removed as
Apple frameworks, local model distribution, App Store review policy, hardware,
and the product identity evolve.

The durable direction is:

- keep Hazakura as a Markdown-first Safe Editor;
- use local / on-device assistance where it fits document editing;
- keep AI output explicit, reviewable, and unsaved until the user applies it;
- avoid becoming a generic AI runtime, model playground, image-generation app,
  or autonomous agent platform.

## Boundary

Any future AI layer must continue to obey the current project boundaries:

- no arbitrary command execution;
- no background workspace indexing;
- no general chat or agent automation as the default editor surface;
- no automatic file application or auto-save;
- no arbitrary provider / model add UI without a fresh boundary review;
- no hidden network fallback;
- no external app or OS-wide automation.

Allowed direction remains narrow:

1. the user chooses a document, range, or bounded writing context;
2. the assistant generates a candidate;
3. the app shows a diff, review, or AI edit transaction;
4. the user explicitly applies or rejects the result.

## Local AI Editing Layer

The first long-range AI direction is a local editing layer for Markdown and
text documents.

Candidate uses:

- selected-range rewrite suggestions;
- Markdown structure cleanup;
- heading ideas, short summaries, and body-draft assistance;
- proofreading and expression review;
- README, article, and App Store copy drafting;
- limited image / screenshot understanding only when it supports the open
  document;
- diff-first application rather than direct file mutation.

The product posture should stay modest. AI is an editing aide, not the owner of
the file.

## Model Adoption Strategy

Model adoption should be staged.

### OS-Provided Models First

Start with models provided by the operating system, such as Apple Foundation
Models, when available.

Purpose:

- validate whether local AI is useful for Markdown / text editing;
- avoid model packaging and model-management complexity at the start;
- keep the first experience close to the existing Hazakura Local Assist boundary.

### Whitelisted External `.aimodel` Later

After OS-provided assistance proves useful, consider external `.aimodel`
support.

This must not begin as arbitrary model import. The safer early shape is a
Hazakura-curated allowlist of models, possibly from a known distribution source
such as Hugging Face, with each model tied to a narrow use.

Candidate model classes:

- Japanese proofreading, summarization, and rephrasing;
- English proofreading and README drafting;
- Markdown structure cleanup;
- small language models for prose review rather than code generation;
- limited OCR / screenshot understanding models.

Required safety questions before any implementation:

- distribution source and update policy;
- model size and storage location;
- license and allowed use;
- checksum / signature verification;
- App Store review impact;
- deletion and cache cleanup;
- whether the model is data, executable code, or treated as feature-changing
  downloaded content by platform policy.

## Possible Long-Range Phases

The labels below are illustrative. They are not release promises.

### v1.x: AI-ready Editing Harness

Strengthen editing primitives that are useful even without AI:

- selection-range editing actions;
- diff display;
- Apply / Reject;
- review comments or review notes;
- internal boundaries for receiving a candidate edit safely;
- writing-assist entry points that can work manually or with AI later.

### v2.0: OS-Provided AI Integration

Explore OS-provided local AI in the narrow document-assist shape:

- Apple Foundation Models or equivalent OS model availability;
- selected-range rewrite suggestions;
- proofreading, summarization, heading ideas;
- structured output for safer candidate generation;
- integration with existing Apply / Reject and diff review.

### v2.x: Whitelisted External `.aimodel` Support

Explore a trusted model catalog:

- curated external `.aimodel` entries;
- explicit user enablement;
- visible model source, purpose, size, and license;
- checksum or signature verification;
- storage, update, and deletion UI;
- purpose-limited models for prose, Markdown cleanup, and limited visual
  understanding.

### Future: User-Managed Models

User-managed model import may be considered only after the curated model path
is understood.

This remains high-risk. It needs a fresh product, security, distribution, and
App Store review decision before implementation.

## Future / v3.x+: Local Image Generation

Long-term, Hazakura may consider local image generation, but only after text
assistance and model management are mature.

Possible narrow uses:

- small article / README image drafts;
- Markdown document eye-catch ideas;
- conceptual diagrams or illustration drafts;
- local notes / creative-writing supporting images;
- image prompt management and reuse.

This must not become a generic image-generation platform.

Initial constraints:

- off by default;
- explicit user enablement;
- trusted models only;
- generated asset location is clear;
- generated assets support the current document;
- model size, runtime load, licensing, copyright, likeness, safety, storage,
  and App Store review are considered before implementation.

## Non-Goals

- Generic AI runtime.
- Arbitrary model marketplace.
- Plugin or provider-add system.
- External app control.
- OS-wide automation.
- General coding agent inside Safe Editor.
- Hidden network AI fallback.
- Background long-document rewriting.
- Auto-save of model output.
- Image-generation product independent of Markdown editing.

## Recommendation

Keep this as a changeable future direction.

For now, the practical product work remains closer to:

- Safe Editor quality;
- L Mode writing stability;
- native-feeling macOS UI;
- e-book / EPUB authoring exploration;
- Hazakura Local Assist as a bounded, experimental document-assist surface.

The long-range model and image-generation ideas should stay documented, but
should not become near-term implementation work until the existing editor and
distribution lanes are stable.
