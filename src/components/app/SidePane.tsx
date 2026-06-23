import { lazy, Suspense, type RefObject } from "react";
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
import { PreviewUnavailablePane } from "../editor/preview/PreviewUnavailablePane";
import type { EBookReaderLocation } from "../editor/preview/EBookPane";

// PreviewPane pulls in marked + DOMPurify, which together add
// ~150 kB gzipped to the main bundle. The preview is off by
// default, so defer the chunk until the user opens the preview
// pane and let the empty pane (already wrapped in `.preview-pane`
// styling) act as the loading frame.
const PreviewPane = lazy(() => import("../editor/preview/PreviewPane"));

// EBookPane reuses the same marked + DOMPurify pipeline, so it lives
// in the same lazy chunk as PreviewPane. Like PreviewPane it is a
// display-only, sanitised surface — it renders Markdown through
// `renderMarkdown()` and never edits source.
const EBookPane = lazy(() => import("../editor/preview/EBookPane"));

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
  onApplyBackup?: (documentPath: string, backupContents: string) => void;
  onCloseCompareView: (options?: { returnToEditor?: boolean }) => void;
  onEbookLocationChange: (location: EBookReaderLocation) => void;
  onOpenEbookReadingFocus: (location: EBookReaderLocation) => void;
  onOpenPreviewLocalLink: (path: string) => void | Promise<void>;
  onPreviewScroll: () => void;
  onRunSelectedFileCompare: () => void;
  onSelectHeading: (heading: MarkdownHeading) => void;
  outlineTruncated: boolean;
  previewPaneRef: RefObject<HTMLDivElement | null>;
  previewVisible: boolean;
  ebookLocation: EBookReaderLocation | null;
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
  onApplyBackup,
  onCloseCompareView,
  onEbookLocationChange,
  onOpenEbookReadingFocus,
  onOpenPreviewLocalLink,
  onPreviewScroll,
  onRunSelectedFileCompare,
  onSelectHeading,
  outlineTruncated,
  previewPaneRef,
  previewVisible,
  ebookLocation,
  sidePaneMode,
  workspaceRootPath,
}: SidePaneProps) {
  const compareCase = compareView
    ? getCompareCaseByKey(compareView.caseKey) ?? null
    : null;
  // The right-pane compare route only handles file / changes cases.
  // AI candidate cases are owned by the internal candidate-review
  // primitive and never registered with useCompareState, but narrow
  // defensively in case a future slice accidentally adds one here.
  const rightPaneCompareCase =
    compareCase && compareCase.kind !== "candidate" ? compareCase : null;
  const showMarkdownPreviewCard =
    sidePaneMode === "preview" && activeTab !== null && previewVisible;
  const activeEbookDocumentKey = activeTab ? ebookDocumentKey(activeTab) : null;
  const initialEbookLocation = activeEbookDocumentKey ? ebookLocation : null;

  return (
    <div
      className={`pane preview-pane preview-pane-${sidePaneMode}${showMarkdownPreviewCard ? " preview-pane-card" : ""}`}
      ref={sidePaneMode === "preview" ? previewPaneRef : null}
      aria-label={sidePaneAriaLabel(sidePaneMode, copy)}
      onScroll={sidePaneMode === "preview" ? onPreviewScroll : undefined}
    >
      {sidePaneMode === "compare" && compareView && rightPaneCompareCase ? (
        <DiffPane
          menuLanguage={menuLanguage}
          compareCase={rightPaneCompareCase}
          onApplyBackup={onApplyBackup}
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
      ) : sidePaneMode === "ebook" && activeTab && previewVisible ? (
        <Suspense fallback={null}>
          <EBookPane
            documentKey={activeEbookDocumentKey ?? undefined}
            documentPath={activeTab.path}
            initialLocation={initialEbookLocation}
            menuLanguage={menuLanguage}
            onEnterReadingFocus={onOpenEbookReadingFocus}
            onLocationChange={onEbookLocationChange}
            onOpenLocalLink={onOpenPreviewLocalLink}
            source={activeContents}
            workspaceRoot={
              workspaceRootPath ??
              (activeTab.path ? activeTab.path.replace(/\/[^/]+$/, "") : null)
            }
          />
        </Suspense>
      ) : activeTab && previewVisible ? (
        <Suspense fallback={null}>
          <PreviewPane
            documentKey={activeTab.id}
            documentPath={activeTab.path}
            onOpenLocalLink={onOpenPreviewLocalLink}
            source={activeContents}
            workspaceRoot={
              workspaceRootPath ??
              (activeTab.path ? activeTab.path.replace(/\/[^/]+$/, "") : null)
            }
          />
        </Suspense>
      ) : (
        <PreviewUnavailablePane
          ariaLabel={copy.previewUnavailable}
          reason={activeTab ? copy.previewDisabled : copy.openTextFileToPreview}
        />
      )}
    </div>
  );
}

function ebookDocumentKey(tab: EditorTab): string {
  return tab.path || tab.id;
}

function sidePaneAriaLabel(mode: RightPaneMode, copy: SidePaneCopy): string {
  if (mode === "compare") {
    return copy.fileComparison;
  }

  if (mode === "outline") {
    return copy.documentOutline;
  }

  if (mode === "ebook") {
    return copy.ebookReading;
  }

  return copy.markdownPreview;
}
