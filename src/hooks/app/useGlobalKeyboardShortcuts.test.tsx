import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGlobalKeyboardShortcuts } from "./useGlobalKeyboardShortcuts";

function setup(
  overrides: Partial<Parameters<typeof useGlobalKeyboardShortcuts>[0]> = {},
) {
  const props: Parameters<typeof useGlobalKeyboardShortcuts>[0] = {
    activeTabId: "tab-1",
    editorPaneRef: { current: null },
    findInputRef: { current: null },
    findVisible: false,
    globalSearchVisible: false,
    modalOpen: false,
    onApplyMarkdownFormat: vi.fn(),
    onCloseFindAndFocusEditor: vi.fn(),
    onCloseSelectedImagePreview: vi.fn(),
    onCreateNewFile: vi.fn(),
    onFocusAdjacentTab: vi.fn(),
    onFocusEditorSoon: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onOpenFile: vi.fn(),
    onOpenGlobalSearch: vi.fn(),
    onOpenWorkspace: vi.fn(),
    onRequestCloseTab: vi.fn(),
    onRequestWindowClose: vi.fn(),
    onSaveActiveTab: vi.fn(),
    onSaveActiveTabAs: vi.fn(),
    selectedImageOpen: false,
    setEditorSettings: vi.fn(),
    setFindVisible: vi.fn(),
    setPreferencesDialogMode: vi.fn(),
    setPreviewVisible: vi.fn(),
    setStatus: vi.fn(),
    ...overrides,
  };

  renderHook(() => useGlobalKeyboardShortcuts(props));

  return props;
}

describe("useGlobalKeyboardShortcuts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reserves Cmd+Shift+R without opening a hidden Review Desk surface", () => {
    const props = setup();
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "r",
      metaKey: true,
      shiftKey: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(props.onOpenCommandPalette).not.toHaveBeenCalled();
    expect(props.onOpenGlobalSearch).not.toHaveBeenCalled();
    expect(props.onRequestCloseTab).not.toHaveBeenCalled();
    expect(props.onRequestWindowClose).not.toHaveBeenCalled();
  });
});
