# AI Markdown Ingest Plan

Status: Proposal; standalone Review Desk file-import slice retired
Scope: v0.29+ explicit AI proposal intake and review
Authority: Medium
Last reviewed: 2026-06-21

## Summary

AI Markdown ingest is the planned path for taking AI-written Markdown
from outside Hazakura, comparing it with the user's current draft, and
accepting only the parts the user explicitly chooses.

The goal is not to make Hazakura an agent platform. The goal is to make
AI output safer to read, structure, diff, and apply.

North-star fit:

> AIが書いたMarkdownを、本として読み、差分で直す。

## Product Boundary

This plan inherits the existing Safe Editor and AI Assistance boundary:

- Markdown/text source remains canonical.
- AI output is never silently applied.
- Ingest is user-initiated.
- Review is explicit and Diff-centered.
- Saving remains a normal user decision after review.
- App Store lane stays helper-free. File/paste ingest needs a fresh
  boundary decision before it re-enters the product surface.
- Developer / GitHub lane may interoperate with Apple Local Assist or
  Agent Workbench only through their existing explicit boundaries.

Do not add:

- auto-apply
- auto-save
- auto-commit
- hidden workspace rewriting
- background project indexing
- arbitrary command execution
- generic provider plugins
- general chat or agent orchestration

## v0.28+ Direction

This work follows the completed v0.26 authoring / EPUB export lane and
the completed v0.27 refinement lane. v0.28 should treat AI ingest as a
foundation task, not a broad AI feature launch: begin only when one
focused review primitive is selected, and keep the slice small enough to
prove explicit review without changing the product trust model.
For planning purposes, v0.28 should add at most one review primitive;
v0.29+ can expand ingest sources and review ergonomics after the first
path proves source-preserving review, rejection, and explicit
application.

v0.28 selection as of 2026-06-21: the first primitive is the existing
transaction / candidate review path, not a new import surface. The
internal candidate-review primitive can build a source-preserving
`candidate` CompareCase, and the detached Apple Local Assist Writing
Companion records unsaved AI edit transactions with compact Diff /
Discard review before save. Treat that as the foundation proof; defer
explicit file import, richer paste ingest, multi-file proposal review,
Agent Workbench external-edit intake, and richer provenance display until
a fresh v0.29+ boundary review reopens them.

v0.29 correction as of 2026-06-21: the standalone Review Desk screen,
manual candidate editor, and local Markdown / text file-import UI are
retired before release. The visible near-term path is Apple Local Assist
transaction review plus source-level guards that prevent retired Review
Desk entry points from reappearing accidentally.

Start with the smallest reusable review primitive:

- Review AI-proposed Markdown from an explicit Apple Local Assist
  transaction first.
- Reopen selected-file or pasted-text proposal ingest only after a fresh
  boundary review.
- Compare proposed content against the current active document or a
  selected chapter set.
- Show multi-file Diff / Review when a proposal spans several Markdown
  files.
- Let the user apply accepted hunks or accepted files through explicit
  commands only.
- Record enough source metadata to explain where the proposal came from:
  Apple Local Assist transaction, future file import, future paste, or
  Agent Workbench external edit.

## App Store Lane

The App Store lane should treat AI output as ordinary user-provided text
or files.

Acceptable current shape:

- Apple Local Assist transactions are explicit user actions.
- Unsaved AI edits remain reviewable through compact Diff / Discard
  before save.
- Retired Review Desk and candidate file-import entry points remain
  absent from the App Store-safe surface.

No Apple Local Assist helper, Agent Workbench, external AI/API calls, or
provider process launch belongs in the App Store submission lane unless
a later App Store-specific review reopens that decision.

## Developer / GitHub Lane

The Developer / GitHub lane may connect this review path to existing
experimental surfaces:

- Apple Local Assist: unsaved AI edit transactions remain reviewable
  before save.
- Agent Workbench: provider-made file edits are ordinary on-disk changes
  and must still flow through explicit review before the user keeps them.

This does not permit automatic prompt submission, automatic patch
application, Git operations, or a generic agent workflow inside
Hazakura.

## Relationship To e-book Mode

e-book Mode gives AI-written Markdown a readable book surface before
acceptance. That matters especially when the proposal is long prose or
chapter-structured output.

Useful review flow:

```txt
AI proposal
-> arrive through an explicit reviewed transaction
-> inspect through Diff / Review
-> discard or keep the unsaved edit explicitly
-> save only by user action
```

For multi-file proposals, the book structure should help the user
understand chapter order and scope before accepting changes.

## Open Questions

- How should accepted hunks be represented across multiple Markdown
  files without becoming a merge editor?
- Should chapter order come from frontmatter, `index.md`, a dedicated
  table-of-contents file, or app-local settings?
- How much provenance should be shown to the user without exposing
  prompts, hidden instructions, filesystem details, or provider internals?
- Which structural book-scope choices should wait for v2.0 Book
  Workspace Alpha rather than entering the first AI ingest slice?

## Verification Direction

Future implementation should prove:

- AI-generated text does not auto-save or overwrite files;
- accepted changes are explicit and reviewable;
- rejected changes leave source unchanged;
- App Store lane remains helper-free and does not expose retired Review
  Desk import routes;
- Developer / GitHub lane integrations do not bypass existing Apple
  Local Assist or Agent Workbench boundaries;
- Normal Mode, L Mode, e-book Mode, Preview, Diff, and Export continue
  to use Markdown source rather than rendered decoration DOM.
