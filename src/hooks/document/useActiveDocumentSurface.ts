import type { RefObject } from "react";
import type {
  EditorPaneHandle,
  EditorSelectionInfo,
} from "../../components/editor/EditorPane";
import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  MenuLanguage,
  RightPaneMode,
} from "../../types";
import { useDocumentOutline } from "./useDocumentOutline";
import { useDocumentStatus } from "./useDocumentStatus";
import { usePreviewScrollSync } from "../editor/usePreviewScrollSync";

type UseActiveDocumentSurfaceOptions = {
  activeContents: string;
  activeDirty: boolean;
  activeTab: EditorTab | null;
  compareView: CompareViewState | null;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  getCompareCaseByKey: (caseKey: string) => CompareCase | undefined;
  hasActiveDocument: boolean;
  menuLanguage: MenuLanguage;
  noFileOpenText: string;
  previewPaneRef: RefObject<HTMLDivElement | null>;
  selectedImage: ImagePreviewState | null;
  selectionInfo: EditorSelectionInfo;
  sidePaneMode: RightPaneMode | null;
};

export function useActiveDocumentSurface({
  activeContents,
  activeDirty,
  activeTab,
  compareView,
  editorPaneRef,
  getCompareCaseByKey,
  hasActiveDocument,
  menuLanguage,
  noFileOpenText,
  previewPaneRef,
  selectedImage,
  selectionInfo,
  sidePaneMode,
}: UseActiveDocumentSurfaceOptions) {
  const {
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
    documentStructureItems,
    documentStructureTruncated,
  } = useDocumentOutline({
      activeContents,
      hasActiveDocument,
      selectionLine: selectionInfo.line,
    });
  const compareCase = compareView
    ? getCompareCaseByKey(compareView.caseKey) ?? null
    : null;
  const {
    dirtyLabel: activeDirtyLabel,
    lineCount: activeDocumentLineCount,
    statusDetail: activeStatusDetail,
    statusSecondaryDetail: activeStatusSecondaryDetail,
  } = useDocumentStatus({
    activeContents,
    activeDirty,
    activeTab,
    compareCase,
    compareView,
    currentMarkdownHeading,
    menuLanguage,
    noFileOpenText,
    selectedImage,
    selectionInfo,
    sidePaneMode,
  });
  const {
    scrollHudContext,
    scrollHudLine,
    scrollHudVisible,
    syncEditorScroll,
    syncPreviewScroll,
  } = usePreviewScrollSync({
    activeDocumentLineCount,
    activeTab,
    documentHeadings,
    editorPaneRef,
    previewPaneRef,
  });

  return {
    activeDirtyLabel,
    activeDocumentLineCount,
    activeStatusDetail,
    activeStatusSecondaryDetail,
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
    documentStructureItems,
    documentStructureTruncated,
    scrollHudContext,
    scrollHudLine,
    scrollHudVisible,
    syncEditorScroll,
    syncPreviewScroll,
  };
}
