import type { RefObject } from "react";
import type { SidePaneCopy } from "../../lib/locale";
import type {
  CompareAnchor,
  CompareCase,
  CompareViewState,
  EditorTab,
  MarkdownHeading,
  MenuLanguage,
  RightPaneMode,
} from "../../types";
import { DiffPane } from "../diff/DiffPane";
import { DiffSetupPane } from "../diff/DiffSetupPane";
import { OutlinePane } from "../editor/OutlinePane";
import PreviewPane from "../editor/preview/PreviewPane";
import { PreviewUnavailablePane } from "../editor/preview/PreviewUnavailablePane";

type SidePaneProps = {
  activeContents: string;
  activeTab: EditorTab | null;
  compareSource: CompareAnchor | null;
  compareTarget: CompareAnchor | null;
  compareView: CompareViewState | null;
  copy: SidePaneCopy;
  currentHeadingLine: number | null;
  documentHeadings: MarkdownHeading[];
  getCompareCaseByKey: (caseKey: string) => CompareCase | undefined;
  menuLanguage: MenuLanguage;
  onClearCompareSource: () => void;
  onClearCompareTarget: () => void;
  onCloseCompareView: (options?: { returnToEditor?: boolean }) => void;
  onOpenPreviewLocalLink: (path: string) => void | Promise<void>;
  onPreviewScroll: () => void;
  onRunSelectedFileCompare: () => void;
  onSelectHeading: (heading: MarkdownHeading) => void;
  outlineTruncated: boolean;
  previewPaneRef: RefObject<HTMLDivElement | null>;
  previewVisible: boolean;
  sidePaneMode: RightPaneMode;
  workspaceRootPath: string | null;
};

export function SidePane({
  activeContents,
  activeTab,
  compareSource,
  compareTarget,
  compareView,
  copy,
  currentHeadingLine,
  documentHeadings,
  getCompareCaseByKey,
  menuLanguage,
  onClearCompareSource,
  onClearCompareTarget,
  onCloseCompareView,
  onOpenPreviewLocalLink,
  onPreviewScroll,
  onRunSelectedFileCompare,
  onSelectHeading,
  outlineTruncated,
  previewPaneRef,
  previewVisible,
  sidePaneMode,
  workspaceRootPath,
}: SidePaneProps) {
  const compareCase = compareView
    ? getCompareCaseByKey(compareView.caseKey) ?? null
    : null;
  // The right-pane compare route only handles file / changes cases.
  // The manual candidate case is owned by the Review Desk
  // (useReviewDeskState) and never registered with
  // useCompareState, but narrow defensively in case a future
  // slice accidentally adds a candidate case to the right pane.
  const rightPaneCompareCase =
    compareCase && compareCase.kind !== "candidate" ? compareCase : null;

  return (
    <div
      className="pane preview-pane"
      ref={sidePaneMode === "preview" ? previewPaneRef : null}
      aria-label={sidePaneAriaLabel(sidePaneMode, copy)}
      onScroll={sidePaneMode === "preview" ? onPreviewScroll : undefined}
    >
      {sidePaneMode === "compare" && compareView && rightPaneCompareCase ? (
        <DiffPane
          menuLanguage={menuLanguage}
          compareCase={rightPaneCompareCase}
          view={compareView}
          onClose={() =>
            onCloseCompareView({
              returnToEditor: rightPaneCompareCase.kind === "changes",
            })
          }
        />
      ) : sidePaneMode === "compare" ? (
        <DiffSetupPane
          compareSource={compareSource}
          compareTarget={compareTarget}
          onClearSource={onClearCompareSource}
          onClearTarget={onClearCompareTarget}
          onCompare={onRunSelectedFileCompare}
          menuLanguage={menuLanguage}
          workspaceRootPath={workspaceRootPath}
        />
      ) : sidePaneMode === "outline" ? (
        <OutlinePane
          copy={copy}
          currentHeadingLine={currentHeadingLine}
          headings={documentHeadings}
          onSelect={onSelectHeading}
          truncated={outlineTruncated}
        />
      ) : activeTab && previewVisible ? (
        <PreviewPane
          onOpenLocalLink={onOpenPreviewLocalLink}
          source={activeContents}
          workspaceRoot={
            workspaceRootPath ??
            (activeTab.path ? activeTab.path.replace(/\/[^/]+$/, "") : null)
          }
        />
      ) : (
        <PreviewUnavailablePane
          ariaLabel={copy.previewUnavailable}
          reason={activeTab ? copy.previewDisabled : copy.openTextFileToPreview}
        />
      )}
    </div>
  );
}

function sidePaneAriaLabel(mode: RightPaneMode, copy: SidePaneCopy): string {
  if (mode === "compare") {
    return copy.fileComparison;
  }

  if (mode === "outline") {
    return copy.documentOutline;
  }

  return copy.markdownPreview;
}
