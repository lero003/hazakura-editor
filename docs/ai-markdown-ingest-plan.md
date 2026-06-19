# AI Markdown Ingest Plan

Status: Proposal
Scope: v0.26+ explicit AI proposal intake and review
Authority: Medium
Last reviewed: 2026-06-19

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
- App Store lane stays helper-free and file-based.
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

## v0.26 Direction

This work is intentionally after v0.25 native-feeling Safe Editor chrome
polish. The ingest / review workflow should sit on a clearer app shell and
mode-control foundation rather than driving that chrome redesign itself.

Start with the smallest reusable review primitive:

- Import AI-proposed Markdown from selected files, pasted text, or an
  explicit reviewed transaction.
- Compare proposed content against the current active document or a
  selected chapter set.
- Show multi-file Diff / Review when a proposal spans several Markdown
  files.
- Let the user apply accepted hunks or accepted files through explicit
  commands only.
- Record enough source metadata to explain where the proposal came from:
  file import, paste, Apple Local Assist transaction, or Agent Workbench
  external edit.

## App Store Lane

The App Store lane should treat AI output as ordinary user-provided text
or files.

Acceptable first shape:

- Open or import a local Markdown proposal file.
- Paste AI-written Markdown into a review surface.
- Compare against the selected document or book structure.

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
-> import as Markdown source
-> read as chapter / book surface
-> compare through Diff / Review
-> explicitly apply selected changes
-> save only by user action
```

For multi-file proposals, the book structure should help the user
understand chapter order and scope before accepting changes.

## Open Questions

- Should the first import path be selected local files, paste, or an
  existing AI edit transaction?
- How should accepted hunks be represented across multiple Markdown
  files without becoming a merge editor?
- Should chapter order come from frontmatter, `index.md`, a dedicated
  table-of-contents file, or app-local settings?
- How much provenance should be shown to the user without exposing
  prompts, hidden instructions, filesystem details, or provider internals?

## Verification Direction

Future implementation should prove:

- imported AI text does not auto-save or overwrite files;
- accepted changes are explicit and reviewable;
- rejected changes leave source unchanged;
- App Store lane remains file-based and helper-free;
- Developer / GitHub lane integrations do not bypass existing Apple
  Local Assist or Agent Workbench boundaries;
- Normal Mode, L Mode, e-book Mode, Preview, Diff, and Export continue
  to use Markdown source rather than rendered decoration DOM.
