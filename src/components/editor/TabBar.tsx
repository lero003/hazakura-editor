import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { useRef } from "react";
import { isDirty } from "../../features/editor/editorTabs";
import type { EditorTab, ImagePreviewState } from "../../types";

type TabBarProps = {
  activeTabId: string | null;
  children: ReactNode;
  draggingTabId: string | null;
  dragOverTabId: string | null;
  emptyTabsLabel: string;
  onCloseTab: (tabId: string) => void;
  onCloseSelectedImagePreview: () => void;
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
  selectedImage: ImagePreviewState | null;
  tabs: EditorTab[];
};

export function TabBar({
  activeTabId,
  children,
  draggingTabId,
  dragOverTabId,
  emptyTabsLabel,
  onCloseTab,
  onCloseSelectedImagePreview,
  onFinishTabPointerDrag,
  onPointerEnter,
  onSelectTab,
  onTabContextMenu,
  onTabPointerDown,
  onTabPointerMove,
  shouldSuppressTabClick,
  selectedImage,
  tabs,
}: TabBarProps) {
  const tabButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const showEmptyState = tabs.length === 0 && selectedImage === null;

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTabId: string,
  ) => {
    // The image preview tab lives in the same
    // `role="tablist"` but does not have a text-tab id
    // (it's keyed by `image:{path}`). Include it in the
    // navigation order so arrow keys can reach it, but
    // do not call `onSelectTab` for it — the image tab
    // is a display-only companion slot whose only action
    // is the close button.
    const imageTabId = selectedImage
      ? `image:${selectedImage.path}`
      : null;
    const textTabIds = tabs.map((tab) => tab.id);
    const allTabIds = imageTabId
      ? [...textTabIds, imageTabId]
      : textTabIds;
    const currentIndex = allTabIds.indexOf(currentTabId);

    if (currentIndex === -1) {
      return;
    }

    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
        nextIndex = currentIndex - 1;
        break;
      case "ArrowRight":
        nextIndex = currentIndex + 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = allTabIds.length - 1;
        break;
      default:
        return;
    }

    // Boundary clamp without wrap: ArrowLeft on the
    // first tab and ArrowRight on the last tab are
    // no-ops. WAI-ARIA does not require wrapping; the
    // no-wrap behaviour avoids focus moving from the
    // last tab to the first one unexpectedly.
    if (nextIndex !== null && nextIndex >= 0 && nextIndex < allTabIds.length) {
      event.preventDefault();
      const nextId = allTabIds[nextIndex];
      if (textTabIds.includes(nextId)) {
        onSelectTab(nextId);
      }
      // `onSelectTab` triggers a state change; React
      // re-renders the tab row before the next paint.
      // Defer the focus call so the new tab button is
      // already in the DOM with `aria-selected=true`
      // when it receives focus.
      window.requestAnimationFrame(() => {
        tabButtonRefs.current.get(nextId)?.focus();
      });
    }
  };

  return (
    <section
      className="tabs-row lmode-surface"
      aria-label="Open files"
      onPointerEnter={onPointerEnter}
    >
      <div className="tab-list" role="tablist" aria-label="Open file tabs">
        {showEmptyState ? (
          <span className="empty-tabs">{emptyTabsLabel}</span>
        ) : (
          <>
            {tabs.map((tab) => {
              const dirty = isDirty(tab);

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
                    aria-describedby={dirty ? `tab-dirty-${encodeURIComponent(tab.id)}` : undefined}
                    aria-selected={tab.id === activeTabId}
                    className="tab-button"
                    onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                    ref={(el) => {
                      if (el) {
                        tabButtonRefs.current.set(tab.id, el);
                      } else {
                        tabButtonRefs.current.delete(tab.id);
                      }
                    }}
                    role="tab"
                    title={tab.path}
                    type="button"
                  >
                    <span className="tab-name">{tab.name}</span>
                    {dirty ? (
                      <>
                        <span className="tab-dirty-dot" aria-hidden="true" />
                        <span
                          hidden
                          id={`tab-dirty-${encodeURIComponent(tab.id)}`}
                        >
                          unsaved
                        </span>
                      </>
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
            })}
            {selectedImage ? (
              <div
                className="tab-item active image-tab"
                data-tab-id={selectedImage.path}
                key={`image:${selectedImage.path}`}
                role="presentation"
              >
                <button
                  aria-selected
                  className="tab-button"
                  onKeyDown={(event) =>
                    handleTabKeyDown(event, `image:${selectedImage.path}`)
                  }
                  ref={(el) => {
                    const key = `image:${selectedImage.path}`;
                    if (el) {
                      tabButtonRefs.current.set(key, el);
                    } else {
                      tabButtonRefs.current.delete(key);
                    }
                  }}
                  role="tab"
                  title={selectedImage.path}
                  type="button"
                >
                  <span className="tab-name">{selectedImage.name}</span>
                </button>
                <button
                  aria-label={`Close ${selectedImage.name}`}
                  className="tab-close"
                  onClick={onCloseSelectedImagePreview}
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
            ) : null}
          </>
        )}
      </div>
      {children}
    </section>
  );
}
