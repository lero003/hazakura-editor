import type { RefObject } from "react";
import type {
  EditorPaneHandle,
  EditorSelectionInfo,
} from "../components/EditorPane";
import type {
  CompareCase,
  CompareViewState,
  EditorTab,
  ImagePreviewState,
  MenuLanguage,
  RightPaneMode,
} from "../types";
import { useDocumentOutline } from "./useDocumentOutline";
import { useDocumentStatus } from "./useDocumentStatus";
import { usePreviewScrollSync } from "./usePreviewScrollSync";

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
  const { currentMarkdownHeading, documentHeadings, documentOutline } =
    useDocumentOutline({
      activeContents,
      hasActiveDocument,
      selectionLine: selectionInfo.line,
    });
  const compareCase = compareView
    ? getCompareCaseByKey(compareView.caseKey) ?? null
    : null;
  const {
    documentMeta,
    lineCount: activeDocumentLineCount,
    statusDetail: activeStatusDetail,
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
    activeDocumentLineCount,
    activeStatusDetail,
    currentMarkdownHeading,
    documentHeadings,
    documentOutline,
    scrollHudContext,
    scrollHudLine,
    scrollHudVisible,
    syncEditorScroll,
    syncPreviewScroll,
  };
}
