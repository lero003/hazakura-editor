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
  /** Short Diff orientation (header only; longer titles stay on toggles). */
  diffTabTitle: string;
  closeRightPane: string;
  /** Outline-only optional summary line (e.g. structure hints count). */
  outlinePurposeFallback: string;
};

export type RightPaneHeaderContent = {
  mode: RightPaneMode | "reference";
  title: string;
  /**
   * 見出しの右に出す**短い注記**（モックの `PREVIEW / 表示のみ` 相当）。
   * 説明文は入れない（実機フィードバック）。情報（注意件数・読み取り専用）だけを残す。
   */
  purpose: string | null;
  /** Optional fuller text for the purpose hover / title attribute. */
  purposeTitle: string | null;
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
        purpose: null,
        purposeTitle: copy.previewPurposeHint,
        closeLabel,
      };
    case "ebook":
      return {
        mode,
        title: copy.ebookTab,
        purpose: null,
        purposeTitle: copy.ebookPurposeHint,
        closeLabel,
      };
    case "outline":
      // 注意件数は情報なので見出しに残す。無いときの「見出しから移動」は説明なので
      // ホバーへ回す。
      return {
        mode,
        title: copy.outlineTab,
        purpose: options?.outlinePurpose?.trim() || null,
        purposeTitle: copy.outlinePurposeFallback,
        closeLabel,
      };
    case "compare":
      return {
        mode,
        title: copy.diffTab,
        purpose: null,
        purposeTitle: copy.diffTabTitle,
        closeLabel,
      };
  }
}

export function resolveReferencePaneHeader(options: {
  title: string;
  fileName: string;
  filePath: string;
  readOnlyLabel: string;
  closeLabel: string;
}): RightPaneHeaderContent {
  return {
    mode: "reference",
    // 見出しは**ファイル名**（「どのファイルか」は説明ではなく素性）。
    // 読み取り専用は2〜3語の短い注記として残し、絶対パスはホバーへ回す。
    title: options.fileName || options.title,
    purpose: options.readOnlyLabel,
    purposeTitle: options.filePath,
    closeLabel: options.closeLabel,
  };
}
