// L Mode (えるモード) — Markdown marker suppression extension.
//
// This is the orchestrator. The actual decoration logic lives
// in `./lineDecorations.ts` and `./contentDecorations.ts`;
// the widget classes are in `./widgets.ts`; the class
// catalog is in `./classes.ts`; the image / task widgets
// are in `./imageWidget.ts` and `./taskWidget.ts`. This file
// holds:
//
//   - The `Compartment` so `EditorPane` can reconfigure the
//     active state without rebuilding the editor.
//   - The `LModeContext` type and `lModeContextFacet` so the
//     rest of the app can hand the L Mode extension
//     workspace-relative image paths.
//   - The `StateField` that joins line-class decorations and
//     content decorations into a single `DecorationSet` and
//     recomputes on the right triggers.
//   - The `lModeExtension()` factory used by `EditorPane`.
//   - The optional typewriter plugin.
//
// CRITICAL INVARIANT — saved file is byte-identical in L Mode
// and normal mode. The extension only adds `Decoration.mark`,
// `Decoration.line`, and `Decoration.replace` ranges; the
// underlying document text is never modified.

import {
  Compartment,
  EditorState,
  type Extension,
  Facet,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
} from "@codemirror/view";
import { refreshImagesEffect, lModeImageResolverPlugin } from "./imageWidget";
import { lModeTaskClickPlugin } from "./taskWidget";
import {
  buildLModeDecorations,
  computeContentDecorations,
} from "./contentDecorations";
import {
  computeLineClasses,
  getActiveLineRanges,
} from "./lineDecorations";

export const lModeCompartment = new Compartment();

/**
 * Context the L Mode extension needs from the surrounding app
 * to resolve workspace-relative image URLs. Provided as a
 * Facet (not a Compartment) because the values change with
 * document switches and we want React to drive the update
 * without rebuilding the editor.
 *
 * `workspaceRoot` and `documentPath` are both nullable: when
 * no workspace is open, image URLs fall back to the alt-text
 * placeholder (no file read is attempted).
 */
export type LModeContext = {
  workspaceRoot: string | null;
  documentPath: string | null;
};

export const lModeContextFacet = Facet.define<LModeContext, LModeContext>({
  combine: (values) =>
    values[values.length - 1] ?? {
      workspaceRoot: null,
      documentPath: null,
    },
});

function readContext(state: EditorState): LModeContext {
  return state.facet(lModeContextFacet);
}

const lModeField = StateField.define<DecorationSet>({
  create(state) {
    const activeLineRanges = getActiveLineRanges(state);
    const activeLineNumbers = new Set(activeLineRanges.map((l) => l.number));
    const lineClasses = computeLineClasses(state, activeLineNumbers);
    const contentDecorations = computeContentDecorations(
      state,
      readContext(state),
    );
    return buildLModeDecorations(state, lineClasses, contentDecorations);
  },
  update(decorations, transaction) {
    // Recompute when the doc changes, when the selection
    // changes (so the active-line reveal follows the cursor),
    // when the L Mode context facet changes (different
    // workspace / document path), or when an async image
    // resolution lands (refreshImagesEffect).
    const contextChanged =
      transaction.startState.facet(lModeContextFacet) !==
      transaction.state.facet(lModeContextFacet);
    const refreshFired = transaction.effects.some((e) =>
      e.is(refreshImagesEffect),
    );
    if (
      transaction.docChanged ||
      transaction.selection !== undefined ||
      contextChanged ||
      refreshFired
    ) {
      const state = transaction.state;
      const activeLineRanges = getActiveLineRanges(state);
      const activeLineNumbers = new Set(activeLineRanges.map((l) => l.number));
      const lineClasses = computeLineClasses(state, activeLineNumbers);
      const contentDecorations = computeContentDecorations(
        state,
        readContext(state),
      );
      return buildLModeDecorations(state, lineClasses, contentDecorations);
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function lModeExtension(
  active: boolean,
  context: LModeContext,
  options: { typewriterMode?: boolean } = {},
): Extension {
  // When `active` is false, the field is removed from the
  // state entirely; no decorations are computed.
  //
  // The image resolver ViewPlugin captures the live
  // EditorView for async image resolution dispatches. It is
  // only constructed when L Mode is on, so toggling L Mode
  // off also drops the plugin.
  return lModeCompartment.of(
    active
      ? [
          lModeField,
          lModeContextFacet.of(context),
          lModeImageResolverPlugin(),
          lModeTaskClickPlugin(),
          options.typewriterMode ? lModeTypewriterPlugin() : [],
        ]
      : [lModeContextFacet.of(context)],
  );
}

// --- Typewriter mode ---
//
// Keeps the active line vertically centered in the viewport
// as the cursor moves. The plugin is constructed only when
// the user has typewriter mode on, and the scroller's
// `scroll-behavior: smooth` (set in CSS) makes the recenter
// feel like a soft focus drift rather than a snap.
//
// We deliberately do NOT recenter on every doc change — only
// on selection changes. A typing burst (each character is a
// doc change) would otherwise produce a stream of micro-
// scrolls; selection moves happen at a human pace.
function lModeTypewriterPlugin() {
  return ViewPlugin.define((view) => ({
    update(update) {
      if (update.selectionSet) {
        const { from, to } = update.state.selection.main;
        const head = from === to ? from : Math.max(from, to);
        view.dispatch({
          effects: EditorView.scrollIntoView(head, { y: "center" }),
        });
      }
    },
  }));
}

/**
 * Build the L Mode decoration set for the given editor state.
 *
 * Exported for unit tests so the cornerstone invariant
 * ("saved file is byte-identical in L Mode and normal mode")
 * can be asserted without spinning up a full EditorView.
 */
export function computeLModeDecorations(
  state: EditorState,
  context: LModeContext = { workspaceRoot: null, documentPath: null },
): DecorationSet {
  const activeLineRanges = getActiveLineRanges(state);
  const activeLineNumbers = new Set(activeLineRanges.map((l) => l.number));
  const lineClasses = computeLineClasses(state, activeLineNumbers);
  const contentDecorations = computeContentDecorations(state, context);
  return buildLModeDecorations(state, lineClasses, contentDecorations);
}
