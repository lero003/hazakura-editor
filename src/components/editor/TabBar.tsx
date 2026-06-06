import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import type { EditorTab } from "../../types";

type TabBarProps = {
  activeTabId: string | null;
  children: ReactNode;
  draggingTabId: string | null;
  dragOverTabId: string | null;
  emptyTabsLabel: string;
  onCloseTab: (tabId: string) => void;
  onFinishTabPointerDrag: (target?: EventTarget | null) => void;
  onPointerEnter: () => void;
  onSelectTab: (tabId: string) => void;
  onTabContextMenu: (
    path: string,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => void;
  onTabPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    tabId: string,
  ) => void;
  onTabPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  shouldSuppressTabClick: () => boolean;
  tabs: EditorTab[];
};

export function TabBar({
  activeTabId,
  children,
  draggingTabId,
  dragOverTabId,
  emptyTabsLabel,
  onCloseTab,
  onFinishTabPointerDrag,
  onPointerEnter,
  onSelectTab,
  onTabContextMenu,
  onTabPointerDown,
  onTabPointerMove,
  shouldSuppressTabClick,
  tabs,
}: TabBarProps) {
  return (
    <section
      className="tabs-row lmode-surface"
      aria-label="Open files"
      onPointerEnter={onPointerEnter}
    >
      <div className="tab-list" role="tablist" aria-label="Open file tabs">
        {tabs.length === 0 ? (
          <span className="empty-tabs">{emptyTabsLabel}</span>
        ) : (
          tabs.map((tab) => {
            const dirty = isDirtyTab(tab);

            return (
              <div
                className={`tab-item${tab.id === activeTabId ? " active" : ""}${draggingTabId === tab.id ? " dragging" : ""}${dragOverTabId === tab.id ? " drag-over" : ""}`}
                data-tab-id={tab.id}
                key={tab.id}
                role="presentation"
                onContextMenu={(event) => onTabContextMenu(tab.path, event)}
                onPointerDown={(event) => onTabPointerDown(event, tab.id)}
                onPointerMove={onTabPointerMove}
                onPointerUp={(event) =>
                  onFinishTabPointerDrag(event.currentTarget)
                }
                onPointerCancel={(event) =>
                  onFinishTabPointerDrag(event.currentTarget)
                }
                onClick={(event) => {
                  // The tab-select click is handled on the tab
                  // item rather than the inner button so it still
                  // fires when the Tauri WKWebView retargets the
                  // click event to the captured <div> after
                  // pointerdown. The close button stops propagation
                  // via its own onClick + the .tab-close class
                  // guard in handleTabPointerDown.
                  if (
                    event.target instanceof Element &&
                    event.target.closest(".tab-close")
                  ) {
                    return;
                  }
                  if (shouldSuppressTabClick()) {
                    return;
                  }
                  onSelectTab(tab.id);
                }}
              >
                <button
                  aria-selected={tab.id === activeTabId}
                  className="tab-button"
                  role="tab"
                  title={tab.path}
                  type="button"
                >
                  <span className="tab-name">{tab.name}</span>
                  {dirty ? (
                    <span className="tab-dirty-dot" aria-label="unsaved" />
                  ) : null}
                </button>
                <button
                  aria-label={`Close ${tab.name}`}
                  className="tab-close"
                  onClick={() => onCloseTab(tab.id)}
                  type="button"
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 1L7 7M7 1L1 7"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
      {children}
    </section>
  );
}

function isDirtyTab(tab: EditorTab): boolean {
  return (
    tab.contents !== tab.lastSavedContents ||
    tab.line_ending !== tab.lastSavedLineEnding
  );
}
