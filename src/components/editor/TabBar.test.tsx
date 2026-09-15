import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";
import type { EditorTab } from "../../types";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    startDragging: vi.fn().mockResolvedValue(undefined),
  }),
}));

afterEach(cleanup);

function tab(id: string, name: string): EditorTab {
  return {
    contents: "",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: id,
    id,
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name,
    path: `/workspace/${name}`,
    saveStatus: "idle",
    sessionId: id,
    size: 0,
  };
}

const tabs = [tab("a", "a.md"), tab("b", "b.md"), tab("c", "c.md")];

// TabBar has no external controller in these tests, so every callback
// stays inert; only the active-tab scroll effect is under test.
const inert = () => vi.fn();

function tabBar(activeTabId: string) {
  return (
    <TabBar
      activeTabId={activeTabId}
      children={null}
      draggingTabId={null}
      dragOverTabId={null}
      emptyTabsLabel="No open files"
      onCloseSelectedImagePreview={inert()}
      onCloseTab={inert()}
      onFinishTabPointerDrag={inert()}
      onPointerEnter={inert()}
      onSelectTab={inert()}
      onTabContextMenu={inert()}
      onTabPointerDown={inert()}
      onTabPointerMove={inert()}
      openFileTabsLabel="Open files"
      openFilesLabel="Open files"
      selectedImage={null}
      shouldSuppressTabClick={() => false}
      tabs={tabs}
    />
  );
}

function rect(left: number, right: number): DOMRect {
  return {
    bottom: 10,
    height: 10,
    left,
    right,
    top: 0,
    width: right - left,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * The tab row is horizontally scrollable, which jsdom does not lay out.
 * Install the measured geometry and a writable `scrollLeft` on the real
 * nodes so the effect under test reads the same values a browser would.
 * Only one tab at a time needs geometry: every other row still measures
 * as the all-zero jsdom rect, which the effect treats as "already
 * visible".
 */
function installGeometry(
  container: HTMLElement,
  tabId: string,
  row: { left: number; right: number },
  item: { left: number; right: number },
  initialScrollLeft = 0,
) {
  const rowElement = container.querySelector<HTMLElement>(".tab-list");
  const itemElement = container.querySelector<HTMLElement>(
    `[data-tab-id="${tabId}"]`,
  );
  if (!rowElement || !itemElement) {
    throw new Error(`missing tab row geometry for ${tabId}`);
  }
  Object.defineProperty(rowElement, "scrollLeft", {
    configurable: true,
    value: initialScrollLeft,
    writable: true,
  });
  rowElement.getBoundingClientRect = () => rect(row.left, row.right);
  itemElement.getBoundingClientRect = () => rect(item.left, item.right);
  return rowElement;
}

describe("TabBar active-tab scrolling", () => {
  it("scrolls a tab that overflows the right edge into view", () => {
    const { container, rerender } = render(tabBar("a"));
    const row = installGeometry(
      container,
      "c",
      { left: 0, right: 300 },
      { left: 280, right: 400 },
    );

    rerender(tabBar("c"));

    expect(row.scrollLeft).toBe(100);
  });

  it("scrolls a tab that overflows the left edge back into view", () => {
    const { container, rerender } = render(tabBar("b"));
    const row = installGeometry(
      container,
      "a",
      { left: 0, right: 300 },
      { left: -40, right: 60 },
      200,
    );

    rerender(tabBar("a"));

    expect(row.scrollLeft).toBe(160);
  });

  it("leaves a fully visible tab row untouched", () => {
    const { container, rerender } = render(tabBar("a"));
    const row = installGeometry(
      container,
      "b",
      { left: 0, right: 300 },
      { left: 120, right: 200 },
      50,
    );

    rerender(tabBar("b"));

    expect(row.scrollLeft).toBe(50);
  });
});
