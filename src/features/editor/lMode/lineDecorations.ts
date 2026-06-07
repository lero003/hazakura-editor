// L Mode (えるモード) — line-level decoration computation.
//
// This file holds the pure function that maps an
// `EditorState` to a `Map<lineNumber, string[]>` — the
// classes to attach to each line of the document. The
// output is then converted to `Decoration.line` ranges in
// the orchestrator (`extension.ts`).
//
// Two kinds of classes are computed here:
//
//   1. **Active / dimmed.** The lines that the user's
//      selection currently touches get `LModeClasses.activeLine`
//      (the "soft focus" active class). Every other line gets
//      `LModeClasses.dimmedLine` (the "everything else
//      recedes" class).
//
//   2. **Structural.** Headings, blockquotes, lists, fenced
//      code, and tables each tag the lines they span with the
//      class from `LModeBlockRules` / `LModeExtraLineClasses`.
//      Adding a new structural element means adding one
//      `LModeBlockRule` entry — no edit to this file is
//      required.
//
// The "first H1 in the document" rule is the only special
// case kept inline here, because it depends on runtime state
// (which H1 we have seen so far during the tree walk), not
// just on the Lezer node name.

import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
  LModeBlockRules,
  LModeClasses,
  LModeExtraLineClasses,
  type LModeBlockRule,
} from "./classes";

/**
 * Compute the active-line ranges from the current selection.
 * A multi-line selection expands to one entry per line in
 * the selection; a collapsed selection gives a single entry
 * (the line the caret is on).
 */
export function getActiveLineRanges(
  state: EditorState,
): Array<{ number: number; from: number; to: number }> {
  const ranges: Array<{ number: number; from: number; to: number }> = [];
  for (const selection of state.selection.ranges) {
    const from = Math.min(selection.from, selection.to);
    const to = Math.max(selection.from, selection.to);
    const fromLine = state.doc.lineAt(from);
    const inclusiveTo = to > from ? to - 1 : to;
    const toLine = state.doc.lineAt(inclusiveTo);
    for (
      let lineNumber = fromLine.number;
      lineNumber <= toLine.number;
      lineNumber += 1
    ) {
      const line = state.doc.line(lineNumber);
      ranges.push({ number: line.number, from: line.from, to: line.to });
    }
  }
  return ranges;
}

/**
 * Pure function: state + active-line numbers → line-classes
 * map. The map is keyed by 1-based line number; the value
 * is the list of class names to attach to that line, in
 * insertion order.
 *
 * The function walks the syntax tree once. Block rules are
 * applied via the `LModeBlockRules` table; the
 * "active/dimmed" line policy is applied from the
 * `activeLineNumbers` set. The first H1 in the document
 * additionally receives `LModeClasses.heading1First` so CSS
 * can center the document title.
 */
export function computeLineClasses(
  state: EditorState,
  activeLineNumbers: ReadonlySet<number>,
): Map<number, string[]> {
  const lineClasses = new Map<number, string[]>();
  const tree = syntaxTree(state);
  let firstHeading1Seen = false;

  // Pre-build a fast lookup from Lezer node name to its
  // matching block rules / extra line classes. The table is
  // small enough that a fresh object per call is cheaper
  // than maintaining module-level state.
  const blockRulesByNode = new Map<string, readonly LModeBlockRule[]>();
  for (const rule of LModeBlockRules) {
    for (const nodeName of rule.nodes) {
      const existing = blockRulesByNode.get(nodeName) ?? [];
      blockRulesByNode.set(nodeName, [...existing, rule]);
    }
  }
  const extraClassesByNode = new Map<string, readonly string[]>();
  for (const extra of LModeExtraLineClasses) {
    for (const nodeName of extra.nodes) {
      const existing = extraClassesByNode.get(nodeName) ?? [];
      extraClassesByNode.set(nodeName, [...existing, extra.cls]);
    }
  }

  // Walk the tree once. For each block node, apply the
  // matching `all` / `first` / `last` classes. For node
  // names that have an "extra" class (BulletList →
  // listBullet, OrderedList → listOrdered), apply those on
  // every line as well.
  tree.iterate({
    enter(node) {
      const rules = blockRulesByNode.get(node.name);
      const extras = extraClassesByNode.get(node.name);
      if (!rules && !extras) {
        return true;
      }

      const fromLine = state.doc.lineAt(node.from).number;
      const toLine = state.doc.lineAt(node.to).number;
      const firstLine = fromLine;
      const lastLine = toLine;

      // We must always descend into ATXHeading so the
      // HeaderMark child node is visited — that's where the
      // marker-hiding pass picks up the `#` to hide.
      const descend = true;

      if (rules) {
        for (const rule of rules) {
          if (rule.all) {
            for (let line = firstLine; line <= lastLine; line += 1) {
              pushLineClass(lineClasses, line, rule.all);
            }
          }
          if (rule.first) {
            pushLineClass(lineClasses, firstLine, rule.first);
          }
          if (rule.last) {
            pushLineClass(lineClasses, lastLine, rule.last);
          }
        }
        // The "first H1" rule is a runtime-state special
        // case (the FIRST heading-1 in the document, not
        // every heading-1) so it lives here rather than in
        // the catalog. CSS uses `cm-lmode-heading-1-first`
        // to center the document title; subsequent H1s
        // render in the section-heading voice.
        if (
          !firstHeading1Seen &&
          rules.some((r) => r.first === LModeClasses.heading1First)
        ) {
          firstHeading1Seen = true;
          pushLineClass(
            lineClasses,
            firstLine,
            LModeClasses.heading1First,
          );
        }
      }

      if (extras) {
        for (let line = firstLine; line <= lastLine; line += 1) {
          for (const cls of extras) {
            pushLineClass(lineClasses, line, cls);
          }
        }
      }

      return descend;
    },
  });

  // Soft focus: every line that is NOT part of the active
  // selection gets `LModeClasses.dimmedLine`. The CSS rule
  // lowers its opacity so the cursor's line(s) stand out
  // without us having to track the cursor in a special way.
  // The active-line reveal is still expressed by
  // `LModeClasses.activeLine` on top of the dim (CSS sets
  // opacity: 1 for active lines), so the two signals
  // compose cleanly.
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    if (activeLineNumbers.has(lineNumber)) {
      pushLineClass(lineClasses, lineNumber, LModeClasses.activeLine);
    } else {
      pushLineClass(lineClasses, lineNumber, LModeClasses.dimmedLine);
    }
  }

  return lineClasses;
}

function pushLineClass(
  map: Map<number, string[]>,
  line: number,
  className: string,
): void {
  const existing = map.get(line);
  if (existing) {
    if (!existing.includes(className)) {
      existing.push(className);
    }
    return;
  }
  map.set(line, [className]);
}
