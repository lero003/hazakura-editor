/**
 * Right-pane shared header — presentation model only.
 *
 * Intentional rails:
 * - One chrome row for orientation (title + optional purpose + close).
 * - No document model, no background work, no second buffer.
 * - Easy to restyle or drop: SidePane / Reference only compose this.
 */

import type { RightPaneMode } from "../../types";

export type RightPaneHeaderCopy = {
  previewTab: string;
  ebookTab: string;
  outlineTab: string;
  diffTab: string;
  referenceTab: string;
  previewPurposeHint: string;
  ebookPurposeHint: string;
  closeRightPane: string;
  /** Outline-only optional summary line (e.g. structure hints count). */
  outlinePurposeFallback: string;
};

export type RightPaneHeaderContent = {
  mode: RightPaneMode | "reference";
  title: string;
  purpose: string | null;
  closeLabel: string;
};

export function resolveSidePaneHeader(
  mode: RightPaneMode,
  copy: RightPaneHeaderCopy,
  options?: {
    outlinePurpose?: string | null;
  },
): RightPaneHeaderContent {
  const closeLabel = copy.closeRightPane;
  switch (mode) {
    case "preview":
      return {
        mode,
        title: copy.previewTab,
        purpose: copy.previewPurposeHint,
        closeLabel,
      };
    case "ebook":
      return {
        mode,
        title: copy.ebookTab,
        purpose: copy.ebookPurposeHint,
        closeLabel,
      };
    case "outline":
      return {
        mode,
        title: copy.outlineTab,
        purpose: options?.outlinePurpose?.trim() || copy.outlinePurposeFallback,
        closeLabel,
      };
    case "compare":
      return {
        mode,
        title: copy.diffTab,
        purpose: null,
        closeLabel,
      };
  }
}

export function resolveReferencePaneHeader(options: {
  title: string;
  fileName: string;
  readOnlyLabel: string;
  closeLabel: string;
}): RightPaneHeaderContent {
  return {
    mode: "reference",
    title: options.title,
    purpose: `${options.readOnlyLabel} · ${options.fileName}`,
    closeLabel: options.closeLabel,
  };
}
