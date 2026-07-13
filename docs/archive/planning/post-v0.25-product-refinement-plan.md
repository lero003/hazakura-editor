# Post-v0.25 Product Refinement Plan

Status: Proposal
Scope: Post-App-Store product refinement lens
Authority: Medium
Last reviewed: 2026-06-20

## Summary

`Hazakura Editor` is past the point where adding more surfaces is the
obvious way to raise product quality. After the v0.25 App Store release,
the most useful product work is to make the existing editor feel more
coherent, calmer, and harder to break.

The next product-grade improvement should be judged by this question:

> Does this make reading, writing, comparing, and saving Markdown feel
> more like one continuous safe editing space?

This memo does not replace `docs/current-work.md` or `docs/roadmap.md`.
It is a refinement lens for choosing future slices after the immediate
v0.25 distribution and native-chrome work is closed.

## Durable Direction

Adopt these ideas where they fit the existing Safe Editor boundary:

- **Editing is source-preserving transformation.** Normal Mode, L Mode,
  e-book Mode, Preview, Diff, and future AI review should feel like
  different visual / review layers over Markdown source, not separate
  document models.
- **Workspace can become book-shaped.** A selected workspace may be
  presented as a book context where files are chapters and a table of
  contents is explicit, but this must not become background project
  indexing, Git awareness, or a general file manager.
- **UI should recede.** Chrome, sidebars, tabs, and controls should feel
  layered and callable, not card-heavy or dashboard-like. Dense Markdown
  text stays legible on a stable non-vibrant surface.
- **Stability is a product feature.** Large documents, preview surfaces,
  tab switching, restore, and memory behavior deserve priority before
  broad new mode expansion.

## High-Value Refinement Candidates

### One Editing Space

Mode switching should strengthen the illusion that the document remains
in one place and only the interpretation changes.

Useful future slices:

- reduce moments where entering L Mode, e-book Mode, Preview, or Diff
  feels like leaving the document;
- preserve scroll / selection / heading context when moving between
  reading and editing layers;
- treat L Mode and e-book Mode as a long-term convergence question:
  Live Source writing and book-like reading may stay separate, but their
  transition should feel deliberate.

Do not use this as permission for Preview DOM editing, `contenteditable`,
or a hidden HTML / rich-text saved model.

### No-Workspace Authoring

The editor should not require a selected workspace before the user can
start writing.

Useful future slices:

- allow New File with no workspace by creating an untitled standalone
  Markdown tab;
- route Save for an untitled/pathless tab to Save As before writing;
- keep dirty close protection, preview, and safe source handling active
  for that tab;
- after Save As, treat the result as an ordinary standalone file tab.

Avoid hidden temporary project folders, background autosave as a
replacement for Save As, arbitrary path text fields, or implicit
workspace creation.

### Workspace As Book

The book-structure direction should move from "future export idea" toward
an information-architecture lens.

Useful future slices:

- show a selected workspace as a book context only when the user asks for
  that view;
- treat Markdown files as chapter candidates;
- make table-of-contents generation or editing explicit and reversible;
- consider a provisional / temporary workspace only as a recovery UX for
  no-workspace writing, with clear later binding to a real folder.

Avoid automatic folder semantics, background indexing, and hidden
workspace-wide structure detection.

### Flow-Preserving Editing

The next editor improvements should protect the writer's train of
thought rather than add IDE-like power.

Useful future slices:

- preserve scroll context across mode switches and tab changes;
- make heading jump / current-section movement immediate and predictable;
- explore a focus-paragraph view where surrounding prose recedes without
  hiding source truth;
- record a lightweight edit-location history for returning to recent
  thinking positions;
- deepen chapter-boundary feel in e-book Mode without committing to true
  pagination or a second document model.
- keep mode controls stable: an e-book affordance may be disabled or show
  an empty state when no document is open, but it should not disappear
  in a way that makes the product feel inconsistent.

### Performance And Reliability

Treat performance work as trust work.

Useful future slices:

- stage rendering for very large Markdown documents before the user sees
  jank or a blank surface;
- verify tab-state retention and memory behavior when switching among
  editor, Preview, e-book Mode, Diff, and image previews;
- add focused memory / leak watch around preview and e-book surfaces
  before adding more persistent visual layers.

### Native, Layered UI

The v0.25 native-chrome direction should continue with restraint.

Useful future slices:

- make tabs feel like layers, not cards;
- prefer callable sidebars and temporary drawers when constant side
  chrome competes with writing;
- reduce button density only where existing commands remain reachable
  through menus, shortcuts, or contextual controls;
- keep native vibrancy behind chrome / navigation, not dense prose.

### AI As A Review Layer

Future AI work should be framed as another transformation / review layer,
not as a new feature island.

Use this vocabulary:

- rewrite = proposed source transformation;
- summary = alternate reading layer;
- structure = chapter / outline proposal;
- apply = explicit Diff / Review action.

This aligns with `docs/archive/planning/ai-markdown-ingest-plan.md`: AI output is
imported, read, compared, and explicitly accepted or rejected. It is not
auto-applied, auto-saved, auto-committed, or used to orchestrate a
general agent workflow.

## Dangerous Doors

Do not open these without a fresh product-boundary review:

- full WYSIWYG replacement of the Markdown source model;
- plugin system or provider marketplace;
- always-on CLI / terminal / IDE integration;
- background workspace analysis;
- AI auto-apply or hidden long-document rewriting;
- file-manager expansion beyond bounded workspace operations.

These may be useful someday, but they are not the next move for a
product that wins by being quiet, explicit, and trustworthy.

## How To Use This Memo

When choosing a future slice:

1. Start from `docs/current-work.md`.
2. Prefer a small item that improves one of the refinement candidates
   above.
3. Identify the proof path before editing: focused regression test,
   source inspection, built app smoke, or manual App Store / TestFlight
   evidence.
4. Update the specific plan doc only if the slice changes its durable
   direction.

This memo is successful if it prevents the product from getting heavier
while still making it feel one grade more complete.
