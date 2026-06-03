# L Mode Plan

Status: Planning
Scope: Experimental one-pane reading-writing mode for v0.9
Authority: Medium
Last reviewed: 2026-06-03

## Summary

**えるモード** is an experimental one-pane reading-writing mode for `hazakura editor`.

It hides surrounding UI such as the file tree, tabs, status details, Agent Surface, and Review Desk as much as practical, then brings the document body forward. The goal is not to make Markdown look decorative. The goal is to let novels, essays, notes, philosophical fragments, and narrative text be written while they are read.

Short description:

> 本文への好奇心を邪魔しない、静かな読み書きモードです。

Alternative English label: **L Mode**.

## Positioning

`hazakura editor` normal mode remains the safe Markdown workspace.

- Normal mode: edit and review Markdown safely.
- Review Desk: compare candidate text and diffs explicitly.
- Agent Window: handle external AI at a clear distance.
- えるモード: move closer to the document body and write as if reading.

えるモード is not an AI generation mode and not an automatic editing mode. AI, Diff, and Review Desk can be used by returning to the normal surfaces when needed.

## Core Principle

Markdown source remains the truth.

```txt
Markdown source is truth.
えるモード is presentation layer.
```

The saved file is the same Markdown text used by normal mode. Hiding Markdown markers is a display concern only. えるモード must not perform automatic conversion, automatic formatting, automatic application, or irreversible Markdown-to-HTML transformation.

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

Do not include these in the initial experiment:

- full WYSIWYG editing
- direct editing of Preview DOM
- irreversible Markdown-to-HTML conversion
- visual table editing
- full Mermaid or math editing
- image layout editing
- AI autocomplete
- automatic AI candidate application
- save-time auto-formatting

えるモード is a display and focus experiment, not a full writing-app replacement.

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

Prefer CodeMirror-side display decoration over editing the Preview DOM.

- Keep Markdown text as the only source of truth.
- Use display decoration to hide Markdown markers.
- Restore markers in the active editing context.
- Do not affect normal mode, Preview, Diff, Review Desk, or export semantics.
- Gate the experiment behind a setting or feature flag so it can be disabled.

## Summary Statement

えるモード is not a Typora clone.

It is a quiet place inside `hazakura editor` for moving closer to the text while keeping the safe Markdown foundation underneath.
