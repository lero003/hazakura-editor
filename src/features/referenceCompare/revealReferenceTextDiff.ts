import { buildLineDiff } from "../diff/diff";
import { compareColumnLabel } from "../../lib/locale/review";
import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  MenuLanguage,
} from "../../types";
import type { ReferenceDocument } from "./types";

export type RevealedReferenceTextDiff = {
  compareCase: CompareCase;
  compareView: CompareViewState;
};

/**
 * Build the Diff snapshot for a loaded text Reference vs the editor buffer.
 * Does not discard the Reference session — the exclusive side-pane opener
 * hides the column so Diff can show, and 参照 restores the same load.
 */
export function revealReferenceTextDiff(options: {
  activeTab: Pick<EditorTab, "contents" | "name" | "path" | "sessionId">;
  menuLanguage: MenuLanguage;
  reference: ReferenceDocument;
}): RevealedReferenceTextDiff | null {
  const { activeTab, menuLanguage, reference } = options;
  if (reference.kind !== "text") {
    return null;
  }

  const diff = buildLineDiff(reference.contents, activeTab.contents);
  const caseKey = crypto.randomUUID();
  const sourceLabel = compareColumnLabel(menuLanguage, "source");
  const editorLabel = compareColumnLabel(menuLanguage, "editor");

  return {
    compareCase: {
      kind: "file",
      key: caseKey,
      leftPath: reference.path,
      rightPath: activeTab.path || `session:${activeTab.sessionId}`,
      anchor: {
        path: reference.path,
        name: reference.name,
        label: sourceLabel,
      },
      target: {
        path: activeTab.path || "",
        name: activeTab.name,
        label: editorLabel,
      },
    },
    compareView: {
      caseKey,
      ...diff,
    },
  };
}
