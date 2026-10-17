import { Facet } from "@codemirror/state";

/**
 * L Mode context handed to the extension from `EditorPane`.
 *
 * Lives in its own module so `contentDecorations.ts` can depend on the type
 * without importing the orchestrator (`extension.ts`), which imports the
 * decoration builders back. `extension.ts` re-exports both members so existing
 * import paths keep working.
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
