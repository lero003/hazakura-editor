import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";
import type { MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { isKanaStyle } from "../../lib/locale/_helpers";

export type TabContextMenuState = {
  path: string;
  x: number;
  y: number;
};

const MENU_WIDTH = 200;
const ITEM_HEIGHT = 34;
const CLOSE_LABEL_HEIGHT = 12;

type TabContextMenuProps = {
  anchor: TabContextMenuState;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  onOpenAsReference: () => void;
  onRename: () => void;
  openAsReferenceLabel: string;
};

export function TabContextMenu({
  anchor,
  menuLanguage,
  onClose,
  onOpenAsReference,
  onRename,
  openAsReferenceLabel,
}: TabContextMenuProps) {
  // Dismiss on outside click / Esc, mirroring the workspace
  // context menu's outside-dismissal pattern.
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const itemCount = 3;
  const estimatedHeight = CLOSE_LABEL_HEIGHT + itemCount * ITEM_HEIGHT;
  const menuLeft = Math.min(
    Math.max(anchor.x, 8),
    Math.max(8, window.innerWidth - MENU_WIDTH),
  );
  const menuTop = Math.min(
    Math.max(anchor.y, 8),
    Math.max(8, window.innerHeight - estimatedHeight),
  );

  const labels = isKanaStyle(menuLanguage)
    ? { menu: "たぶの さばき", rename: "なまえを かえる", close: "めにゅーを とぢる" }
    : isJapaneseMenuLanguage(menuLanguage)
      ? { menu: "タブの操作", rename: "ファイル名を変更", close: "メニューを閉じる" }
      : { menu: "Tab actions", rename: "Rename file", close: "Close menu" };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      aria-label={labels.menu}
      className="tab-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: menuLeft, top: menuTop }}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={onOpenAsReference}>
        {openAsReferenceLabel}
      </button>
      <button type="button" role="menuitem" onClick={onRename}>
        {labels.rename}
      </button>
      <button type="button" role="menuitem" onClick={onClose}>
        {labels.close}
      </button>
    </div>
  );
}
