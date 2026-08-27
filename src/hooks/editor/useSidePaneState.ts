import type {
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  RightPaneMode,
} from "../../types";

type UseSidePaneStateOptions = {
  activeTab: EditorTab | null;
  compareView: CompareViewState | null;
  previewVisible: boolean;
  /** Reference owns the right column; the side pane is not the visible surface. */
  referencePaneVisible?: boolean;
  rightPaneMode: RightPaneMode;
  selectedImage: ImagePreviewState | null;
  sidePaneOpen: boolean;
};

export function useSidePaneState({
  activeTab,
  compareView,
  previewVisible,
  referencePaneVisible = false,
  rightPaneMode,
  selectedImage,
  sidePaneOpen,
}: UseSidePaneStateOptions) {
  const sidePaneMode: RightPaneMode | null =
    sidePaneOpen && !referencePaneVisible
      ? rightPaneMode === "compare"
        ? "compare"
        : rightPaneMode === "outline"
          ? "outline"
          : rightPaneMode === "ebook" && previewVisible
            ? "ebook"
            : rightPaneMode === "preview" && previewVisible
              ? "preview"
              : null
      : null;
  const outlinePaneVisible = sidePaneMode === "outline" && activeTab !== null;
  const previewPaneVisible = sidePaneMode === "preview" && activeTab !== null;
  const ebookPaneVisible = sidePaneMode === "ebook" && activeTab !== null;
  const sidePaneVisible = sidePaneMode !== null;
  const hasWorkspaceSelection = Boolean(
    activeTab || selectedImage || compareView,
  );

  return {
    ebookPaneVisible,
    hasWorkspaceSelection,
    outlinePaneVisible,
    previewPaneVisible,
    sidePaneMode,
    sidePaneVisible,
  };
}
