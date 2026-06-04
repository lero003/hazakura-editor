# L Mode Plan

Status: Active
Scope: Writing surface for v0.11+ L Mode polish (originated in v0.9 alpha)
Authority: Medium
Last reviewed: 2026-06-04

## Summary

**えるモード** is the WYSIWYG-tier writing surface of `hazakura editor`. It aims for a custom writing-app feel that goes beyond dedicated WYSIWYG editors like Typora — a magazine-feel, document-centered space where the visual is the document and editing happens without conscious effort.

It hides surrounding UI such as the file tree, tabs, status details, Agent Surface, and Review Desk as much as practical, then brings the document body forward. The goal is to let novels, essays, notes, philosophical fragments, and narrative text be written while they are read.

Short description:

> 本文への好奇心を邪魔しない、静かな読み書きモードです。

Alternative English label: **L Mode**.

## Positioning

`hazakura editor` normal mode remains the safe Markdown workspace.

- Normal mode: edit and review Markdown safely.
- Review Desk: compare candidate text and diffs explicitly.
- Agent Window: handle external AI at a clear distance.
- えるモード: a WYSIWYG-tier writing surface whose source model is Markdown.

えるモード is not an AI generation mode and not an automatic editing mode. AI, Diff, and Review Desk can be used by returning to the normal surfaces when needed.

## Core Principle

Markdown source remains the truth. The writing surface is WYSIWYG-tier.

```txt
Markdown source is truth.
えるモード renders as the document.
```

The saved file is the same Markdown text used by normal mode. The WYSIWYG-feel rendering is a display concern only — CodeMirror decoration on top of the existing Markdown parser, never direct Preview DOM editing, never `contenteditable`, never irreversible Markdown→HTML transformation.

The visual target is a custom WYSIWYG writing app: editorial typography, strong heading hierarchy, magazine-feel block elements, inline emphasis / strong / strike / link that read as the document, layout that does not shift when the cursor moves. The user writes without consciously editing.

## Experience Target

When entering えるモード, the screen should become document-centered:

- hide the file tree and surrounding side surfaces
- hide Agent Surface and Review Desk
- reduce tab and status prominence
- center the document body
- constrain line width for reading
- use calmer line height and paragraph spacing
- make headings, quotes, lists, and code blocks feel closer to prose
- suppress Markdown markers where safe
- reveal the Markdown source around the active cursor, selection, or hover
- keep a quiet exit route back to normal mode

The intended feel is not "editing code that happens to be prose." It is "looking at a work or note, then continuing it."

## Initial Scope

### 1. One-Pane Mode

- Hide the file tree.
- Hide Agent Surface.
- Hide Review Desk.
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

## Non-Scope

The visual writing surface can grow ambitious, but the source model stays Markdown and editing stays inside CodeMirror. Do not include:

- direct editing of Preview DOM or `contenteditable` substitution
- irreversible Markdown-to-HTML conversion
- structural visual table editing (row/column add/remove, alignment)
- full Mermaid or math editing
- image layout editing
- AI autocomplete
- automatic AI candidate application
- save-time auto-formatting

The WYSIWYG-tier aspiration is purely about rendering quality — the user keeps editing through the cursor in the Markdown source, and the saved file is exactly the same Markdown text used by normal mode.

## Success Conditions

- The user wants to reread the document.
- The user wants to continue writing.
- Markdown markers feel less intrusive.
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
- Preview, Diff, or Review Desk consistency breaks
- visual beauty creates more anxiety than confidence
- implementation cost is high compared with the experience gain

## Implementation Notes

Implementation is CodeMirror display decoration on top of the existing Markdown parser. The WYSIWYG-tier look comes from how the decoration is styled, not from any structural change to the editor.

- Keep Markdown text as the only source of truth.
- Use display decoration (`mark`, `line`, `replace`, `widget`) to render emphasis, strong, strike, link, tables, task checkboxes, HRs, and other block / inline elements as the document.
- Style headings with strong jump rates and editorial treatments (centered H1, distinctive H2/H3, etc.).
- Keep layout stable: do not reveal Markdown markers on the active line if it would shift the line horizontally; let the visual stay as the document.
- Restore markers only where editing context demands them (e.g. selection inspection in command palette, Review Desk diff).
- Do not affect normal mode, Preview, Diff, Review Desk, or export semantics.
- Theme handling can stay simple (light / dark base) — magazine style is the primary differentiator, not per-theme variation.

## Summary Statement

えるモード is the WYSIWYG-tier writing surface of `hazakura editor` — a custom writing-app feel that goes beyond Typora, while the source model stays Markdown and the editing surface stays CodeMirror.
