# Native macOS Appearance Plan

Status: Proposal
Scope: v0.25 native-feeling Safe Editor chrome polish
Authority: Medium
Last reviewed: 2026-06-19

## Summary

`Hazakura Editor` should gradually look and feel more like a native macOS
app, especially as the supported OS floor moves forward.

The near-term design baseline is **macOS 26**. The forward-looking target is
**macOS 27+**, but macOS 27-specific APIs, naming, and visual rules must be
verified against current Apple documentation before implementation. Do not
guess future platform behavior.

This is not a request to turn the app into a generic IDE or a heavy custom UI.
The goal is to make the existing Markdown-first Safe Editor feel more at home
on modern macOS.

Current roadmap decision: this becomes the v0.25 product slice. AI
Markdown ingest moves to v0.26 so the app shell, top chrome, and mode
controls can be made steadier first.

## Product Fit

This direction fits the product if it stays inside the editor shell:

- Safe Editor remains the primary surface.
- Markdown/text source remains canonical.
- Existing native macOS menus, dialogs, file pickers, spellcheck, and Trash
  behavior remain part of the product identity.
- Visual polish should reduce the sense of a web app inside a window.
- Lower OS compatibility can be retired over time when the product chooses a
  new baseline, but compatibility cuts should be explicit release-lane
  decisions.

This direction does not authorize:

- Git, LSP, terminal, plugins, project-wide indexing, or arbitrary command UI.
- A broad rewrite from Tauri/React to SwiftUI/AppKit.
- Hidden behavior changes to open/save/preview/diff/export.
- Raising `minimumSystemVersion` as a side effect of visual exploration.
- Claiming macOS 27 support before that target is verified.

## Design Baseline

Use macOS 26 guidance as the first reference point.

Relevant Apple guidance to re-check before implementation:

- Liquid Glass overview:
  <https://developer.apple.com/documentation/technologyoverviews/liquid-glass>
- Adopting Liquid Glass:
  <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass>
- Human Interface Guidelines / Materials:
  <https://developer.apple.com/design/human-interface-guidelines/materials>
- AppKit app with the new design:
  <https://developer.apple.com/videos/play/wwdc2025/310/>
- SwiftUI app with the new design:
  <https://developer.apple.com/videos/play/wwdc2025/323/>

The useful reading for Hazakura is not "add more translucent decoration." It
is:

- let structural chrome feel like toolbar / sidebar / inspector surfaces;
- avoid opaque custom fills that fight system materials;
- group toolbar actions by meaning;
- prefer standard icons and native-feeling control sizing;
- let content own the window while navigation and controls sit above it;
- preserve legibility, contrast, and keyboard focus over visual novelty.

## Relationship To Current UI

The v0.20 Sakura workspace ergonomics slice made the editor clearer, but it is
still primarily a React/CSS shell. A native macOS appearance pass should treat
that as a base, not a failure.

Keep:

- the bounded workspace sidebar model;
- the central Markdown editor / preview structure;
- explicit Diff / review flows;
- L Mode as the document-centered writing surface;
- Sakura visual identity where it helps recognition.

Reconsider:

- dense custom top chrome that does not feel like a macOS toolbar;
- status/footer fields that behave like web dashboard metadata;
- sidebars with heavy custom backgrounds;
- floating controls that look decorative rather than system-adjacent;
- theme colors that overpower native materials.

## Proposed Phases

### Phase 0: Native UI Audit

Create an inventory before changing code.

- Capture screenshots of Normal Mode, L Mode, Preferences, Diff / review,
  Help, empty start surface, image preview, and App Store lane surface.
- Mark which elements are structural chrome, content, status, or temporary
  controls.
- Identify hard-coded heights, dense borders, custom filled panels, and
  non-native spacing.
- Decide which surfaces should become more toolbar-like, sidebar-like,
  inspector-like, or sheet-like.
- Check whether current `minimumSystemVersion` and build lanes should stay as
  they are for this visual pass.

Output: one short audit note and screenshots. No visual rewrite yet.

Status as of 2026-06-19: the first code/CSS audit is sufficient to start
a small v0.25 chrome polish slice. The strongest initial findings are:
missing explicit drag / no-drag regions for the transparent titlebar,
traffic-light inset risk, weak editor focus visibility, inaccurate mode
active state, segmented-control styling debt, and stale fallback color
literals in e-book chrome.

### Phase 1: Safe Editor Chrome Alignment

First implementation slice should be small and reversible.

Candidate scope:

- traffic-light-safe top chrome drag region and action priority;
- sidebar surface density and selection treatment;
- status bar / metadata hierarchy;
- Preferences and Help panel control density;
- icon treatment and button sizing;
- focus rings and keyboard-visible states.

Acceptance:

- the app feels less like a web dashboard;
- the editor remains usable at the existing minimum comfortable width;
- all existing Safe Editor actions remain discoverable;
- no file model, preview, save, diff, export, or Agent Workbench boundary
  changes.

### Phase 2: Material And Glass Exploration

Only after the chrome audit should the app explore material or glass-like
treatment.

For Tauri/React, this may mean a carefully constrained CSS approximation.
For native shell surfaces, this may mean AppKit/Tauri window or titlebar
configuration. If true system Liquid Glass requires SwiftUI/AppKit surfaces,
that should become a separate architecture decision, not a hidden visual
cleanup.

Rules:

- prefer fewer, meaningful material surfaces over many translucent cards;
- do not place glass behind dense Markdown text if it hurts reading;
- do not tint every icon or control;
- keep content legibility and contrast measurable;
- make App Store and Developer / GitHub lanes visually consistent unless a
  lane-specific surface is intentionally omitted.

### Phase 3: OS Floor Decision

As the project moves beyond v0.21, revisit the supported OS floor.

Possible outcomes:

- keep the editor-wide minimum lower, while native-looking polish is mostly
  CSS / layout;
- raise the editor-wide minimum only when distribution and user impact justify
  it;
- split features by runtime availability when a modern macOS API is optional;
- later require macOS 26+ or newer if the product chooses native system
  behavior over broad compatibility.

This decision belongs with release planning, not an incidental UI commit.

## Non-Goals

- Full SwiftUI rewrite.
- New app architecture just to gain visual polish.
- Complete Liquid Glass fidelity inside WebView.
- Decorative blur / transparency everywhere.
- Dropping OS support without a release note and smoke plan.
- Hiding or removing core editor affordances to look cleaner.
- App Store claim changes without built-artifact evidence.

## Verification Direction

When implementation begins, verify with:

- focused component / CSS tests for layout invariants;
- `npm run build:vite`;
- relevant app tests for changed controls;
- `git diff --check`;
- browser screenshot checks for frontend-only visual slices;
- built `.app` smoke for native window, menu, titlebar, toolbar, sheet, or
  Tauri-shell behavior;
- contrast and keyboard-focus checks on every changed surface.

Browser-only smoke is not enough for native window or menu claims.

## Open Questions

- Should the first visible target be top chrome, sidebar, status/footer, or
  Preferences?
- Should Sakura remain a branded theme, or should it become a subtler accent
  layered over native materials?
- Should the app keep a custom titlebar feel, or move closer to standard macOS
  toolbar/titlebar behavior?
- Which OS floor change is acceptable for v0.21+, and which belongs later?
- Is a CSS approximation enough, or do some surfaces need AppKit / SwiftUI
  interop to feel right?

## Recommendation

This is now the v0.25 product direction.

The first winning move for v0.25 is **Safe Editor chrome alignment**, not a
full restyle. Start with traffic-light-safe drag behavior, focus visibility,
truthful active states, and token cleanup. After that, improve one shell
surface at a time: segmented controls, sidebar, status metadata,
Preferences, or L Mode controls. Treat macOS 26 as the concrete baseline
and macOS 27 as a future verification target.
