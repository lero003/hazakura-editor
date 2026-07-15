import type { CompareAnchor, MenuLanguage, WorkspaceContextMenuEntryKind, WorkspaceContextMenuState } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";
import type { WorkspaceFileOpsCopy } from "../../lib/locale/workspaceFileOps";
import { isImportAssistSourceFile } from "../../lib/utils";
import { isReferencePath } from "../../features/referenceCompare/referenceCompare";
import type { ReferenceCompareCopy } from "../../lib/locale/referenceCompare";
import { getOkfReviewCopy } from "../../lib/locale/okfReview";

export function WorkspaceContextMenu({
  activeTabPath,
  anchor,
  canSendToAgent,
  compareSource,
  fileOpsCopy,
  kind = "file",
  menuLanguage,
  onClearCompareSource,
  onClose,
  onCompare,
  onCopyFullPath,
  onCreateFileHere,
  onCreateFolderHere,
  onImportAsMarkdownDraft,
  onMoveToTrash,
  onOpen,
  onOpenAsReference,
  onOpenOkfReview,
  onRename,
  onRevealInFinder,
  onSendFullPathToAgent,
  onSetCompareSource,
  onSetCompareTarget,
  referenceCopy,
}: {
  activeTabPath: string | null;
  anchor: WorkspaceContextMenuState;
  canSendToAgent: boolean;
  compareSource: CompareAnchor | null;
  fileOpsCopy: WorkspaceFileOpsCopy;
  kind?: WorkspaceContextMenuEntryKind;
  menuLanguage: MenuLanguage;
  onClearCompareSource: () => void;
  onClose: () => void;
  onCompare: () => void;
  onCopyFullPath: () => void;
  onCreateFileHere: () => void;
  onCreateFolderHere: () => void;
  onImportAsMarkdownDraft: () => void;
  onMoveToTrash: () => void;
  onOpen: () => void;
  onOpenAsReference: () => void;
  onOpenOkfReview: () => void;
  onRename: () => void;
  onRevealInFinder: () => void;
  onSendFullPathToAgent: () => void;
  onSetCompareSource: () => void;
  onSetCompareTarget: () => void;
  referenceCopy: ReferenceCompareCopy;
}) {
  const canCompareWithActiveTab =
    activeTabPath !== null && activeTabPath !== anchor.path;
  const hasDifferentCompareSource =
    compareSource !== null && compareSource.path !== anchor.path;
  const canCreateHere = kind === "directory" || kind === "root";
  const canRename = kind === "file" || kind === "directory";
  // Trash is allowed for any tree entry — the workspace root
  // (kind === "root") is excluded because the root is the
  // security anchor for the workspace tree and trashing it
  // would orphan every other entry.
  const canTrash = kind === "file" || kind === "directory";
  // Import Assist: only user-selected PDF / image files (not dirs/root).
  const canImport =
    kind === "file" && isImportAssistSourceFile(anchor.name);
  // v1.7 R2: Markdown/text, PDF, and common images as read-only reference.
  const canOpenAsReference = kind === "file" && isReferencePath(anchor.name);
  const canReviewOkf = kind === "directory" || kind === "root";
  const okfCopy = getOkfReviewCopy(menuLanguage);
  const itemCount =
    7 +
    (canSendToAgent ? 1 : 0) +
    (compareSource ? 1 : 0) +
    (canCreateHere ? 2 : 0) +
    (canImport ? 1 : 0) +
    (canOpenAsReference ? 1 : 0) +
    (canReviewOkf ? 1 : 0) +
    (canRename ? 1 : 0) +
    (canTrash ? 1 : 0);
  const estimatedWidth = 240;
  const estimatedHeight = 12 + itemCount * 34;
  const menuLeft = Math.min(
    Math.max(anchor.x, 8),
    Math.max(8, window.innerWidth - estimatedWidth),
  );
  const menuTop = Math.min(
    Math.max(anchor.y, 8),
    Math.max(8, window.innerHeight - estimatedHeight),
  );
  const labels = isKanaStyle(menuLanguage)
    ? {
        clearCompareSource: "くらべもとを とく",
        close: "めにゅーを とぢる",
        compareActive: "ひらいてゐる ふみと くらべる",
        compare: "せんたくちゅうの くらべもとと くらべる",
        copyFullPath: "ふるぱすを こぴー",
        importAsMarkdownDraft: "したがきを つくる…",
        menu: "ふぉるだ こうもくの さばき",
        open: "ひらく",
        revealInFinder: "ファインダーで ひらく",
        sendFullPathToAgent: "Agent に ふるぱすを おくる",
        setCompareSource: "くらべもとに せってい",
        setCompareTarget: "くらべさきに せってい",
      }
    : isJapaneseMenuLanguage(menuLanguage)
      ? {
          clearCompareSource: "比較元を解除",
          close: "メニューを閉じる",
          compareActive: "開いているファイルと比較",
          compare: "選択中の比較元と比較",
          copyFullPath: "フルパスをコピー",
          importAsMarkdownDraft: "下書きを作る…",
          menu: "ワークスペース項目の操作",
          open: "開く",
          revealInFinder: "Finderで表示",
          sendFullPathToAgent: "Agent にフルパスを送る",
          setCompareSource: "比較元に設定",
          setCompareTarget: "比較先に設定",
        }
      : {
          clearCompareSource: "Clear compare source",
          close: "Close menu",
          compareActive: "Compare with open file",
          compare: "Compare with selected source",
          copyFullPath: "Copy full path",
          importAsMarkdownDraft: "Create draft…",
          menu: "Workspace item actions",
          open: "Open",
          revealInFinder: "Show in Finder",
          sendFullPathToAgent: "Send full path to Agent",
          setCompareSource: "Set compare source",
          setCompareTarget: "Set compare target",
        };

  return (
    <div
      aria-label={labels.menu}
      className="workspace-context-menu"
      role="menu"
      style={{ left: menuLeft, top: menuTop }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {canCreateHere ? (
        <>
          <button type="button" role="menuitem" onClick={onCreateFileHere}>
            {fileOpsCopy.newFileHere}
          </button>
          <button type="button" role="menuitem" onClick={onCreateFolderHere}>
            {fileOpsCopy.newFolderHere}
          </button>
        </>
      ) : null}
      <button type="button" role="menuitem" onClick={onOpen}>
        {labels.open}
      </button>
      {canImport ? (
        <button
          type="button"
          role="menuitem"
          onClick={onImportAsMarkdownDraft}
        >
          {labels.importAsMarkdownDraft}
        </button>
      ) : null}
      {canOpenAsReference ? (
        <button type="button" role="menuitem" onClick={onOpenAsReference}>
          {referenceCopy.openAsReference}
        </button>
      ) : null}
      {canReviewOkf ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => onOpenOkfReview()}
        >
          {okfCopy.contextMenuReview}
        </button>
      ) : null}
      <button type="button" role="menuitem" onClick={onCopyFullPath}>
        {labels.copyFullPath}
      </button>
      <button type="button" role="menuitem" onClick={onRevealInFinder}>
        {labels.revealInFinder}
      </button>
      {canSendToAgent ? (
        <button type="button" role="menuitem" onClick={onSendFullPathToAgent}>
          {labels.sendFullPathToAgent}
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={!anchor.canCompare}
        onClick={onSetCompareSource}
      >
        {labels.setCompareSource}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!anchor.canCompare}
        onClick={onSetCompareTarget}
      >
        {labels.setCompareTarget}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={
          !anchor.canCompare ||
          (!canCompareWithActiveTab && !hasDifferentCompareSource)
        }
        onClick={onCompare}
      >
        {hasDifferentCompareSource
          ? labels.compare
          : canCompareWithActiveTab
            ? labels.compareActive
            : labels.compare}
      </button>
      {compareSource ? (
        <button type="button" role="menuitem" onClick={onClearCompareSource}>
          {labels.clearCompareSource}
        </button>
      ) : null}
      {canRename ? (
        <button type="button" role="menuitem" onClick={onRename}>
          {fileOpsCopy.rename}
        </button>
      ) : null}
      {canTrash ? (
        <button type="button" role="menuitem" onClick={onMoveToTrash}>
          {fileOpsCopy.moveToTrash}
        </button>
      ) : null}
      <button type="button" role="menuitem" onClick={onClose}>
        {labels.close}
      </button>
    </div>
  );
}
