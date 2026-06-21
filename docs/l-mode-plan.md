# L Mode Plan

Status: Active
Scope: Live Source writing surface for L Mode
Authority: Medium
Last reviewed: 2026-06-17

## Summary

**えるモード** is the Live Source writing surface of `Hazakura Editor`: Markdown stays the saved source, while inactive parts of the editor receive a calm document-like display layer. It should not remain a light focus-mode option. The target is a first-class writing surface where day-to-day writing, reading, and small corrections feel close to editing the document itself without replacing the Markdown document model.

The next direction is a deeper **L Mode Live Source Accuracy Ramp**: make Markdown constructs render with higher fidelity when they are not being edited, keep cursor / selection / IME behavior source-like and predictable, and reduce the number of moments where the user has to mentally translate between raw syntax and document appearance.

The ambition is intentionally high: a custom writing-app feel that can go beyond dedicated WYSIWYG editors like Typora in calmness and document focus. The constraint is equally firm: the app must not replace the Markdown document model with HTML, Preview DOM editing, `contenteditable`, or hidden irreversible formatting.

It hides surrounding UI such as the file tree, tabs, status details, and Agent Surface as much as practical, then brings the document body forward. The retired standalone Review Desk should not reappear inside this mode. The goal is to let novels, essays, notes, philosophical fragments, and narrative text be written while they are read.

Short description:

> 本文への好奇心を邪魔しない、静かな読み書きモードです。

Alternative English label: **L Mode**.

## Positioning

`Hazakura Editor` normal mode remains the safe Markdown workspace.

- Normal mode: edit and review Markdown safely.
- Diff / AI review: compare changes explicitly without auto-applying.
- Agent Window: handle external AI at a clear distance.
- えるモード: a Live Source writing surface whose source model is Markdown.

えるモード should become a first-class writing surface, not just an optional visual mode. Normal mode remains the safety foundation, but routine writing should not require leaving えるモード for every small action.

えるモード is not an AI generation mode and not an automatic editing mode. AI and Diff can be used through explicit, lightweight review surfaces when needed.

## Relationship To e-book Mode

v0.21+ の e-book Mode は、L Mode の競合ではなく統合候補として扱う。
L Mode は Live Source writing surface、e-book Mode は book-like reading
and EPUB simulation surface である。

```txt
L Mode: write and lightly edit Markdown as a calm Live Source document.
e-book Mode: read one or more Markdown chapters as a book-like surface.
```

If future work wants WYSIWYG-like value, keep it in this Live Source /
Visual Markdown direction: CodeMirror decorations and widgets may improve
inactive-line readability, but Preview DOM editing and `contenteditable`
remain out of bounds.

v0.21 PoC では、`src/features/editor/lMode/` の CodeMirror
decorations、widgets、parser helpers、CSS の再利用可能性を確認する。
PoC後の判断は次の三択にする。

- **統合**: e-book Mode が L Mode の発展形として実装でき、通常の
  読み書き面を一本化できる。
- **共存**: L Mode は日常執筆、e-book Mode は本として読む / EPUB
  simulation として分けた方がユーザーに分かりやすい。
- **進化系**: 既存L Mode資産を一部使いつつ、book-oriented writing
  surface として新しい構造に進む。

統合を急がない。PoC で次の条件を確認してから決める。

- Markdown source が常に canonical であり続ける。
- active / selected line の編集明瞭性を失わない。
- L Mode の IME、caret、selection、typewriter 安定性を壊さない。
- Preview、Diff、Review、Export HTML、Print to PDF が L Mode /
  e-book Mode の decoration DOM に依存しない。
- 複数ファイル俯瞰が workspace file manager や project analyzer に
  変質しない。

## Core Principle

Markdown source remains the truth. The writing surface is Live Source: document-like when reading, source-like where the writer is editing.

```txt
Markdown source is truth.
Decoration is display only.
Focused active and selected lines show Markdown source.
Inactive lines may render as the document.
```

The saved file is the same Markdown text used by normal mode. The document-like rendering is a display concern only — CodeMirror decoration on top of the existing Markdown parser, never direct Preview DOM editing, never `contenteditable`, never irreversible Markdown→HTML transformation.

The visual target is a custom Live Source writing app: editorial typography, strong heading hierarchy, magazine-feel block elements, inline emphasis / strong / strike / link that read as the document when inactive, layout that does not shift when the cursor moves, and editing rules that do not surprise the writer. The user can read the document calmly, then edit the Markdown source exactly where the caret or selection lives.

### Live Source Rules

- Markdown text is the only canonical document state.
- L Mode display changes must be CodeMirror decorations, not saved-text rewrites.
- While the editor is focused, lines touched by the caret or selection should remain source-like: Markdown markers, spaces, table pipes, and inline break tags must stay directly editable.
- When the editor loses focus, L Mode should return to the inactive document-like display so images and other block widgets can be read.
- Inactive lines may hide markers, replace small syntax with widgets, or add document-like typography when that does not change saved source semantics.
- Copy, save, diff, Preview, Print to PDF, and Export HTML must use the Markdown source or the existing source-rendering pipeline, not L Mode decoration DOM.
- Tables are not a full WYSIWYG surface. L Mode may add readable table presentation and guarded keyboard behavior, but should avoid structural table editing beyond breakage prevention.

## Next Major Direction: Live Source Accuracy Ramp

Treat the next L Mode work as a focused product track, not a handful of visual tweaks. The work should be broad enough to make L Mode trustworthy as the default writing surface, but still bounded to CodeMirror / Markdown-source rendering.

### 1. Rendering Fidelity

Improve how Markdown constructs look and compose in the editor:

- headings, including first-title treatment, repeated H1s, long headings, and Japanese line wrapping
- emphasis, strong, strike, inline code, links, and nested inline marks
- blockquotes, nested quotes, and quote boundaries
- bullet lists, ordered lists, nested lists, task lists, and list continuation rhythm
- horizontal rules and Setext-style underlines that otherwise look like disappearing dividers
- fenced code blocks, language labels, long lines, and copyable source clarity
- tables as readable rows and columns on inactive lines, with delimiter rows hidden only when that does not obscure active editing
- images and captions from Markdown image syntax, including unresolved or workspace-relative images
- mixed Japanese / English / symbols / emoji text without clipping or rhythm collapse

This is still display decoration, not a new document model. If a Markdown construct cannot be rendered accurately without making cursor movement or saved text confusing, prefer a modest readable source-like treatment over a clever illusion.

### 2. Editing Fidelity

Make editing behavior feel stable while the document is visually transformed:

- caret position should remain understandable before, inside, and after hidden markers
- typing next to hidden or replaced syntax must not make nearby visual structure disappear
- active-line and selection-line state should show Markdown source instead of partially hidden markers
- IME composition must not trigger shortcut handling, marker flicker, or layout jumps
- selection should reveal enough source context to explain what will be copied / replaced
- Backspace / Delete around links, emphasis, code spans, tasks, images, tables, and HRs should preserve normal Markdown semantics
- list continuation, task toggling, and line breaks should feel natural without hidden save-time rewriting
- copy should keep Markdown source semantics, not rendered HTML semantics, unless an explicit export path says otherwise

The acceptance bar is not "the parser produced decorations." The acceptance bar is "the writer can edit the visible document without wondering what text will be saved."

### 3. Chrome And Mode Completeness

L Mode should be able to complete common writing loops without sending the user back to normal mode:

- open the temporary file-tree drawer when needed, then return focus to writing
- show unsaved state as a quiet signal
- expose Typewriter mode without making the top-right controls noisy
- expose Apple Local Assist and local change review as lightweight, closable surfaces
- keep normal-mode routes available for Preview / Diff / Outline without making L Mode feel secondary
- avoid visible controls overlapping document text, scroll HUDs, or selection/caret areas

Chrome should be understandable, not cryptic. Compact icon controls may use short labels when icon-only recognition is too weak.

### 4. Regression Fixtures And Smoke

Future L Mode changes should add or reuse fixtures that cover both display and editing:

- a mixed Markdown fixture with headings, nested inline marks, lists, tasks, HRs, tables, images, quotes, code, and Japanese prose
- unit tests for decoration ranges and source preservation
- CSS drift tests for layout invariants that have already regressed, such as list bullets and action-rail geometry
- focused browser / built-app smoke when practical for caret, IME, scroll, typewriter, and visual overlap
- before/after screenshots for meaningful visual shifts when a human review is needed

It is acceptable for this track to be larger than the usual tiny polish slice, but each implementation PR / commit should still isolate one verifiable behavior cluster.

## v0.14 Review Notes: 60 To 80 Point Ramp

A later implementation review judged the current L Mode direction as strong but not yet dependable enough for daily writing. The most credible "60 -> 80" path is not a broader WYSIWYG model. It is to reduce unnecessary decoration churn, protect IME / caret behavior, and add narrow visual regression checks around the existing CodeMirror-decoration design.

Use these notes as a v0.14 work queue. Each item should stay a small, verifiable slice.

### First Slices

1. **Decoration recompute trigger**
   - Initial v0.14 slice landed: the L Mode `StateField` now derives selection changes by structurally comparing `transaction.startState.selection` with `transaction.newSelection`, so explicit moves and mapped caret movement are covered while same-selection re-dispatches stay cheap.
   - Remaining work: split active-line line classes from content decorations only if measurement proves the current field still recalculates too much.
   - Verification direction: keep tests for selection-only updates, mapped caret movement, same-selection no-ops, image refresh, and document-context effects.
   - Failure conditions reduced: cursor uncertainty, IME instability, implementation cost from broad recomputation.

2. **Typewriter and IME stability**
   - Initial v0.14 slice landed: the typewriter plugin now short-circuits its recenter schedule while `view.composing` is true, so IME candidate windows are not shoved off-screen during long compositions. The commit dispatch on `compositionend` lands with `composing === false` and flows through the existing recenter path on the next update cycle.
   - Verification: focused plugin test pins that a `composing` guard suppresses the recenter, and that the post-composition dispatch re-enables it.
   - Failure conditions reduced: IME instability, layout jumps, visual anxiety.
   - Remaining work: built-app or browser smoke with a real Japanese IME when practical.

3. **Visual-overlap fixture**
   - Initial v0.14 slice landed: `src/features/editor/lMode/visualOverlapFixtures.test.ts` pins the L Mode content `max-width` formula (`min(720px, calc(100% - 64px))`), the horizontal `padding` formula (`clamp(40px, 5vw, 60px)`), the active-line chip `left: -2.4em` and `width: 2em` formulas, and a numerical readout of the chip-to-padding headroom at 375 / 480 / 720 / 1024 px. The current headroom is ~10.5px (narrow) and ~21.7px (wide).
   - Verification: a CSS drift check is in place; any change to chip geometry, content padding, or prose font size will surface here first.
   - Failure conditions reduced: cursor / source context confusion, controls overlapping document text.
   - Remaining work: actual screenshot / DOM geometry smoke for headings, blockquotes, fenced code chips, long Japanese headings, and the L Mode action rail is still pending a built-app run.

4. **Task widget accessibility**
   - Initial v0.14 slice landed: the task widget now carries `tabindex="0"` and a `keydown` handler that toggles `[ ]` ↔ `[x]` on Enter / Space. The stylesheet adds a `:focus-visible` accent ring (inset 1px, accent color) that shows on keyboard tab but stays out of mouse hover (which already has its own `transform: scale(1.12)`). Unrelated keys no-op, and keydown on a non-task target does not misroute into the toggle.
   - Verification: 5 unit tests pin tabindex presence, Enter toggle, Space toggle, unrelated-key no-op, and non-task target no-op. Source preservation is asserted on every dispatch.
   - Failure conditions reduced: editing uncertainty, accessibility mismatch.
   - Failure conditions reduced: editing uncertainty, accessibility mismatch.

5. **Print and export boundary (screen print only)**
   - Scope: the user-facing Print to PDF and Export HTML flows go through `useDocumentExport`, which renders a standalone HTML document from the saved Markdown source via `renderMarkdown()` + `getMarkdownPreviewCss()`. That pipeline does not carry L Mode's `.cm-*` classes, so the standalone preview / export path is the canonical print path. The `@media print` block in `src/styles/lMode.css` is the screen-side fallback for "the user hit Cmd+P while the editor is open" — it is an insurance shape, not a full source round-trip.
   - Initial v0.14 slice landed: `src/styles/lMode.css` ends with a single `@media print` block that hides L Mode floating chrome (exit pill, action rail, workspace toggle / overlay / drawer, change review sheet, tabs-row, status bar, scroll HUD, empty placeholder), reveals the `cm-lmode-hidden` source-marker spans, removes the dim, drops the margin chip, unwinds the centered 720px column, and swaps the warm cream paper-feel surface for plain white. The override is gated on `:root[data-l-mode="on"]` so normal-mode print behavior is untouched.
   - What the block cannot do: `Image`, `HorizontalRule`, `TaskMarker`, and `TableDelimiter` are `Decoration.replace`d into display-only widgets. The widget DOM does not contain the original `![alt](url)`, `---`, `[ ]`, or `| --- | --- |` source text, so CSS cannot put the source back. A user who wants the canonical print / export of L Mode content must use the standalone Print to PDF / Export HTML flow, not the editor-screen print.
   - Verification: `src/styles/lModeCss.test.ts` now ships a `v0.14 L Mode print boundary (screen print only)` describe block with 5 tests pinning: a single top-level `@media print` block, hidden floating chrome selectors carrying `display: none !important`, revealed `cm-lmode-hidden` markers (`color: inherit !important`, `display: inline !important`), removed dim and chip (`opacity: 1 !important`, `content: none !important`), and the unwound 720px column with a white background. The describe block and the test comments explicitly call out the screen-print scope and the widget-render limitation.
   - Failure conditions reduced: Preview / export consistency breaks, visual beauty creating user anxiety.
   - Remaining work: a real-browser smoke that prints the L Mode editor and confirms the chrome / dim / chip suppression is invisible to the user. The canonical Print to PDF / Export HTML flow is already covered by the existing standalone-export pipeline.

### Measure Before Refactoring

Do not start v0.14 by splitting the whole CSS file or building a complex line-diff decoration cache. First collect a small performance baseline:

- L Mode off vs on.
- Selection movement vs typing.
- A mixed Markdown fixture and one large prose fixture.
- p95 update-to-paint timing where practical.

If the recompute-trigger fix removes the visible problem, keep the implementation simple. If long documents still lag, then consider a line-range cache for content decorations using CodeMirror change ranges.

### Defer Unless Evidence Demands It

- Full `lMode.css` decomposition into token / chrome / editor-decoration files.
- Sakura / Shokou-specific L Mode palettes beyond the intentional day / night writing surface.
- Broad `userEvent` annotation cleanup across all editor dispatch paths.
- Replacing hidden marker spans with widgets everywhere.
- Structural table editing beyond breakage prevention, alternate document models, or save-time formatting.

These are not bad ideas. They are simply larger than the next safe move.

## Experience Target

When entering えるモード, the screen should become document-centered:

- hide the file tree and surrounding side surfaces
- hide Agent Surface and retired review side surfaces
- reduce tab and status prominence
- center the document body
- constrain line width for reading
- use calmer line height and paragraph spacing
- make headings, quotes, lists, and code blocks feel closer to prose
- suppress Markdown markers where safe
- reveal the Markdown source around the active cursor, selection, or hover
- keep a quiet exit route back to normal mode

The core interaction should stay loose and low-pressure:

- show unsaved state only as a subtle signal, not as a dominant save button or warning
- keep file switching available through the existing mode / tab behavior
- keep save behavior available without making save the main visible control
- show AI edit differences as a compact, closable review sheet
- keep the file tree hidden by default, with a translucent top-left icon that opens a temporary drawer or overlay when needed

The intended feel is not "editing code that happens to be prose." It is "looking at a work or note, then continuing it."

## Implemented / Initial Scope

### 1. One-Pane Mode

- Hide the file tree.
- Hide Agent Surface.
- Keep the retired standalone Review Desk absent.
- Reduce tab bar and status detail prominence.
- Center the active document body.

### 2. Page-Like Writing Style

- Set a readable max width.
- Increase line height.
- Tune paragraph spacing.
- Give headings clearer rhythm.
- Render blockquotes as quiet blocks.
- Keep code blocks readable without making them dominant.

### 3. Markdown Marker Suppression

Experiment with suppressing these markers:

- heading `#`
- emphasis `**`
- italic `*`
- blockquote `>`
- list `-`
- inline-code backticks
- fenced code-block markers
- selected parts of link syntax

Markers must become available around the active line, active block, selection, or hover so the Markdown source is still understandable while editing.

### 4. Immediate Return

- Provide a keyboard shortcut for toggling.
- Keep a quiet visible exit affordance.
- Ensure display problems cannot mutate the Markdown file.

### 5. Lightweight L Mode Chrome

- Use a faint unsaved indicator to imply "not saved yet" without interrupting writing.
- Avoid a prominent Save button unless a failure, conflict, or close request requires explicit action.
- Use a translucent file-tree icon near the top-left edge as the default workspace affordance.
- Open the file tree as a temporary drawer or overlay that feels native to えるモード and can be dismissed quickly.
- When a file is chosen from the temporary tree, return focus to the document.
- Keep the tree bounded to the selected workspace and avoid turning it into a full file manager.

### 6. Compact AI Change Review

- When Apple Local Assist changes the buffer from えるモード, show a compact diff / discard review surface inside or adjacent to えるモード.
- The review surface should be closable so the user can return to writing immediately.
- The surface should make the AI-originated change explicit, unsaved, reviewable, and discardable.
- Do not promote this into a persistent manual Review Desk entry point.

## Non-Scope

The visual writing surface can grow ambitious, but the source model stays Markdown and editing stays inside CodeMirror. Do not include:

- direct editing of Preview DOM or `contenteditable` substitution
- irreversible Markdown-to-HTML conversion
- HTML or rich-text as the saved canonical document model
- database / block-editor / collaboration features
- workspace knowledge-base behavior
- structural visual table editing as a hidden alternate model; table polish is allowed only when it preserves ordinary Markdown text
- full Mermaid or math editing as first-class visual editors
- image layout editing
- AI autocomplete
- automatic AI candidate application
- save-time auto-formatting

The WYSIWYG-tier aspiration is purely about inactive-line rendering quality — the user keeps editing through the cursor in the Markdown source, and the saved file is exactly the same Markdown text used by normal mode.

## Success Conditions

- The user wants to reread the document.
- The user wants to continue writing.
- Markdown markers feel less intrusive.
- The user can correct text, lists, links, and dividers without switching modes.
- Moving the cursor does not make document structure disappear.
- IME composition and Japanese writing stay calm.
- Returning to normal mode makes the source clear.
- Editing does not feel unsafe.
- Saved content remains predictable.
- The Safe Editor philosophy remains intact.

## Failure Conditions

If these problems dominate, close the experiment or reduce it to a conventional Zen / Focus mode:

- cursor position becomes unclear
- IME input becomes unstable
- Markdown source becomes hard to infer
- saved content feels uncertain
- Preview, Diff, or AI review consistency breaks
- visual beauty creates more anxiety than confidence
- implementation cost is high compared with the experience gain
- WYSIWYG polish starts requiring a second hidden document model

## Implementation Notes

Implementation is CodeMirror display decoration on top of the existing Markdown parser. The document-like look comes from how inactive-line decorations are styled, not from any structural change to the editor.

- Keep Markdown text as the only source of truth.
- Use display decoration (`mark`, `line`, `replace`, `widget`) to render emphasis, strong, strike, link, tables, task checkboxes, HRs, and other block / inline elements as the document on inactive lines.
- Style headings with strong jump rates and editorial treatments (centered H1, distinctive H2/H3, etc.).
- Keep active and selected lines source-like. Do not rely on CSS to recreate source visibility from hidden zero-width marker spans.
- Let inactive lines carry the document-like treatment; let active / selected lines carry editing clarity.
- Do not affect normal mode, Preview, Diff, AI review, or export semantics.
- Theme handling can stay simple (light / dark base) — magazine style is the primary differentiator, not per-theme variation.
- When a Markdown grammar ambiguity affects the visual surface, prefer a source-preserving visual explanation over rewriting the source. For example, Setext-style `---` / `===` underline markers may render as dividers in L Mode if that keeps writing behavior understandable.
- Prefer explicit tests for every "hidden marker" or `Decoration.replace` behavior that could affect typing near the range.

## Summary Statement

えるモード is the Live Source writing surface of `Hazakura Editor` — a custom writing-app feel that goes beyond Typora in calmness and document focus, while the source model stays Markdown and the editing surface stays CodeMirror.
