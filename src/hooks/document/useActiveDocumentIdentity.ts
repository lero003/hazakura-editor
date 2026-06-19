import type { EditorTab, ImagePreviewState } from "../../types";

type UseActiveDocumentIdentityOptions = {
  activeTab: EditorTab | null;
  selectedImage: ImagePreviewState | null;
};

export function useActiveDocumentIdentity({
  activeTab,
  selectedImage,
}: UseActiveDocumentIdentityOptions) {
  const activeTabPath = activeTab?.path || null;
  const documentKey = activeTab
    ? activeTab.path || activeTab.id
    : selectedImage?.path ?? "welcome";
  const hasActiveDocument = activeTab !== null;
  const selectedImageOpen = selectedImage !== null;

  return {
    activeTabPath,
    documentKey,
    hasActiveDocument,
    selectedImageOpen,
  };
}
