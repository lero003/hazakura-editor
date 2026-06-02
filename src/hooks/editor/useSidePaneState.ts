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
  rightPaneMode: RightPaneMode;
  selectedImage: ImagePreviewState | null;
  sidePaneOpen: boolean;
};

export function useSidePaneState({
  activeTab,
  compareView,
  previewVisible,
  rightPaneMode,
  selectedImage,
  sidePaneOpen,
}: UseSidePaneStateOptions) {
  const sidePaneMode: RightPaneMode | null = sidePaneOpen
    ? rightPaneMode === "compare"
      ? "compare"
      : rightPaneMode === "outline"
        ? "outline"
        : rightPaneMode === "preview" && previewVisible
          ? "preview"
          : null
    : null;
  const outlinePaneVisible = sidePaneMode === "outline" && activeTab !== null;
  const previewPaneVisible = sidePaneMode === "preview" && activeTab !== null;
  const sidePaneVisible = sidePaneMode !== null;
  const hasWorkspaceSelection = Boolean(
    activeTab || selectedImage || compareView,
  );

  return {
    hasWorkspaceSelection,
    outlinePaneVisible,
    previewPaneVisible,
    sidePaneMode,
    sidePaneVisible,
  };
}
