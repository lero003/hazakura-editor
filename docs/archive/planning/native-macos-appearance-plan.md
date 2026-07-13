# Native macOS Appearance Plan

Status: Proposal
Scope: v0.25 native-feeling Safe Editor chrome polish and native vibrancy
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

Decision as of 2026-06-19: the v0.25 chrome alignment pass (Phase 1)
is complete and verified at code/CSS level. The CSS-only glass polish
that was considered as a follow-up is **dropped** (scrap-and-build):
the team judged that a CSS `backdrop-filter` approximation does not
move the feel enough to justify the work. v0.25 now continues into
**native vibrancy via `window-vibrancy` + `NSVisualEffectView`**, with
the macOS deployment target raised to macOS 26. See "Native Vibrancy
Direction" below.

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

Scrap-and-build note as of 2026-06-19: the v0.25 Phase 1 chrome
alignment pass (drag regions, editor focus, mode active state,
segmented controls, e-book / Diff token cleanup) is implemented and
verified at code/CSS level. The originally planned follow-up — a
CSS-only "Phase 2 Lite" glass polish using `backdrop-filter` — is
**dropped** after review: the team judged that a CSS approximation
does not change the feel enough to justify the work, and it would be
thrown away once real native vibrancy lands. v0.25 continues directly
into native vibrancy via the `window-vibrancy` crate. This is the
explicit scrap-and-build call: do not spend time on the CSS glass
layer first.

Implementation note as of 2026-06-19: the first Safe Editor chrome
alignment pass is implemented at the React/CSS level. It covers
traffic-light-safe drag / no-drag rules, normal-editor focus visibility,
truthful mode active state, e-book token cleanup, right-pane segmented
mode controls, and tokenized Diff row backgrounds. The next proof is
manual macOS app smoke, especially titlebar dragging, control
clickability, L Mode floating pill behavior, and dense-tab hit testing.

### Phase 2: Native Vibrancy (brought forward)

The CSS-only glass polish that was loosely Phase 2 is dropped. v0.25
now continues into **real native vibrancy** via the `window-vibrancy`
crate (`apply_vibrancy` + `NSVisualEffectView`), which is a small Rust
change and a much larger perceived-feel change than any CSS
approximation.

Scope (v0.25 vibrancy slice):

- Add `window-vibrancy` as a Rust dependency.
- Call `apply_vibrancy` on the main window (and review the Agent window)
  with an `NSVisualEffectMaterial` that matches the target surfaces
  (`Sidebar` for the workspace sidebar / titlebar band, with the right
  `NSVisualEffectState`).
- Make the window transparent so the native material shows through, and
  replace the current CSS `backdrop-filter: blur(16px)` approximation on
  `.file-tree-pane` / `.tabs-row` with transparent backgrounds that let
  the native material render.
- Keep the five themes legible: tint the sidebar / chrome over the
  native material without overpowering it, and keep dense Markdown text
  on a readable (non-vibrant) background.
- Verify App Store lane compatibility and the OS floor change (see OS
  Floor Decision below).

Non-goals for this slice:

- A full SwiftUI / AppKit rewrite of any surface.
- True Liquid Glass fidelity (refraction, dynamic material). That
  remains a later, verified Apple-doc-anchored decision.
- Placing vibrancy behind dense Markdown prose.
- Changing the document model, save behavior, preview safety pipeline,
  or any `RightPaneMode` value.

### OS Floor Decision (macOS 26)

Decision as of 2026-06-19: raise the macOS deployment target to
**macOS 26** as part of the v0.25 vibrancy slice. Rationale:

- The goal is a genuine macOS-26-era feel, not a halfway material.
- macOS 26 exposes the modern materials the app wants to adopt.
- The supported OS is already macOS 15.0+ and the target user base is on
  recent macOS; cutting macOS 15–25 is an accepted release-lane
  decision, not an incidental side effect.

Required follow-up for the floor change:

- Bump `minimumSystemVersion` in `src-tauri/tauri.conf.json` to `26.0`.
- Update `LSMinimumSystemVersion` / `allowed-os-versions` claims in
  release notes and App Store lane docs.
- Treat this as release-planning work, not an incidental UI commit: a
  new App Store build that declares macOS 26 is a lane decision with
  TestFlight / App Review evidence, not a silent metadata bump.
- Record that existing App Store lane builds (v0.19.0 / v0.20.0 build
  15) declared macOS 15.0 and passed review at that floor; raising the
  floor is the next lane's decision, not a rewrite of history.

### Phase 1: Safe Editor Chrome Alignment (complete)

The first implementation slice was small and reversible. It is now
implemented and verified at code/CSS level.

Implemented scope:

- traffic-light-safe top chrome drag region and action priority;
- subtle CodeMirror focus indication;
- truthful mode active state (including L Mode);
- segmented right-pane mode controls;
- e-book chrome token cleanup;
- tokenized Diff row backgrounds.

Candidate scope not yet touched (deferred to later small slices, not
the vibrancy slice):

- sidebar surface density and selection treatment;
- status bar / metadata hierarchy;
- Preferences and Help panel control density;
- icon treatment and button sizing.

Acceptance (met for the implemented scope):

- the app feels less like a web dashboard;
- the editor remains usable at the existing minimum comfortable width;
- all existing Safe Editor actions remain discoverable;
- no file model, preview, save, diff, export, or Agent Workbench boundary
  changes.

Remaining proof for the implemented scope: manual macOS app smoke for
titlebar dragging, control clickability, L Mode floating pill behavior,
and dense-tab hit testing.

## Non-Goals

- Full SwiftUI rewrite.
- New app architecture just to gain visual polish.
- Complete Liquid Glass fidelity inside WebView.
- Decorative blur / transparency everywhere.
- Dropping OS support without a release note and smoke plan.
- Hiding or removing core editor affordances to look cleaner.
- App Store claim changes without built-artifact evidence.
- CSS-only glass polish as a stepping stone (dropped by scrap-and-build
  decision as of 2026-06-19).

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

Browser-only smoke is not enough for native window or menu claims. The
vibrancy slice additionally requires a built `.app` smoke on macOS 26 to
confirm the native material renders and that window transparency does
not break the editor, preview, diff, or status bar surfaces.

## Open Questions

- Should the first visible target be top chrome, sidebar, status/footer, or
  Preferences?
- Should Sakura remain a branded theme, or should it become a subtler accent
  layered over native materials?
- Should the app keep a custom titlebar feel, or move closer to standard macOS
  toolbar/titlebar behavior?
- Which `NSVisualEffectMaterial` value best matches the Hazakura sidebar /
  titlebar band without overpowering the Sakura / Yakou / Shokou tints?

(The earlier open question "is a CSS approximation enough, or do some
surfaces need AppKit / SwiftUI interop to feel right?" is now answered:
CSS approximation is not enough; native vibrancy is the chosen path.)

## Recommendation

This is now the v0.25 product direction.

The first winning move for v0.25 was **Safe Editor chrome alignment**,
now complete. The next move is **native vibrancy via `window-vibrancy`
on macOS 26**, not a CSS glass layer. Treat macOS 26 as the concrete
baseline and macOS 27 as a future verification target.
