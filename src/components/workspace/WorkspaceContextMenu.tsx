import type { CompareAnchor, MenuLanguage, WorkspaceContextMenuEntryKind, WorkspaceContextMenuState } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

export function WorkspaceContextMenu({
  activeTabPath,
  anchor,
  canSendToAgent,
  compareSource,
  kind = "file",
  menuLanguage,
  onClearCompareSource,
  onClose,
  onCompare,
  onCopyFullPath,
  onOpen,
  onRevealInFinder,
  onSendFullPathToAgent,
  onSetCompareSource,
  onSetCompareTarget,
}: {
  activeTabPath: string | null;
  anchor: WorkspaceContextMenuState;
  canSendToAgent: boolean;
  compareSource: CompareAnchor | null;
  kind?: WorkspaceContextMenuEntryKind;
  menuLanguage: MenuLanguage;
  onClearCompareSource: () => void;
  onClose: () => void;
  onCompare: () => void;
  onCopyFullPath: () => void;
  onOpen: () => void;
  onRevealInFinder: () => void;
  onSendFullPathToAgent: () => void;
  onSetCompareSource: () => void;
  onSetCompareTarget: () => void;
}) {
  const canCompareWithActiveTab =
    activeTabPath !== null && activeTabPath !== anchor.path;
  const hasDifferentCompareSource =
    compareSource !== null && compareSource.path !== anchor.path;
  const itemCount = 7 + (canSendToAgent ? 1 : 0) + (compareSource ? 1 : 0);
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
      <button type="button" role="menuitem" onClick={onOpen}>
        {labels.open}
      </button>
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
      <button type="button" role="menuitem" onClick={onClose}>
        {labels.close}
      </button>
    </div>
  );
}
