import type {
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  RightPaneMode,
} from "../../types";

type UseSidePaneStateOptions = {
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  compareView: CompareViewState | null;
  previewVisible: boolean;
  rightPaneMode: RightPaneMode;
  selectedImage: ImagePreviewState | null;
  sidePaneOpen: boolean;
};

export function useSidePaneState({
  activeTab,
  agentWorkbenchActive,
  agentWorkbenchConsent,
  compareView,
  previewVisible,
  rightPaneMode,
  selectedImage,
  sidePaneOpen,
}: UseSidePaneStateOptions) {
  const agentWorkbenchAvailable =
    agentWorkbenchActive && agentWorkbenchConsent;
  const effectiveRightPaneMode: RightPaneMode =
    agentWorkbenchAvailable && !activeTab && rightPaneMode === "preview"
      ? "agent"
      : rightPaneMode;
  const sidePaneMode: RightPaneMode | null = sidePaneOpen
    ? effectiveRightPaneMode === "compare"
      ? "compare"
      : effectiveRightPaneMode === "agent"
        ? "agent"
        : effectiveRightPaneMode === "outline"
          ? "outline"
          : effectiveRightPaneMode === "preview" && previewVisible
            ? "preview"
            : null
    : null;
  const agentPaneVisible = sidePaneMode === "agent";
  const outlinePaneVisible = sidePaneMode === "outline" && activeTab !== null;
  const previewPaneVisible = sidePaneMode === "preview" && activeTab !== null;
  const sidePaneVisible = sidePaneMode !== null;
  const hasWorkspaceSelection = Boolean(
    activeTab || selectedImage || compareView || agentPaneVisible,
  );

  return {
    agentPaneVisible,
    agentWorkbenchAvailable,
    effectiveRightPaneMode,
    hasWorkspaceSelection,
    outlinePaneVisible,
    previewPaneVisible,
    sidePaneMode,
    sidePaneVisible,
  };
}
