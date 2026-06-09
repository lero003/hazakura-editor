import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentCoreController } from "./useDocumentCoreController";

// `usePastedImageAction` calls `savePastedImage` from
// `../../lib/tauri` only when `handlePasteImage` is invoked, so
// the shape test does not need to stub the Tauri layer. The shape
// test only checks field presence, not behavior.

describe("useDocumentCoreController", () => {
  it("returns the editor tab state + pasted image surface", () => {
    const { result } = renderHook(() =>
      useDocumentCoreController({
        activeTabId: null,
        globalError: null,
        pendingCloseTabId: null,
        pendingDrafts: [],
        menuLanguage: "ja",
        setStatus: vi.fn(),
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    // editor tab state (10)
    expect(result.current).toHaveProperty("activeConflict");
    expect(result.current).toHaveProperty("activeContents");
    expect(result.current).toHaveProperty("activeDirty");
    expect(result.current).toHaveProperty("activeDraft");
    expect(result.current).toHaveProperty("activeError");
    expect(result.current).toHaveProperty("activeSaveError");
    expect(result.current).toHaveProperty("activeTab");
    expect(result.current).toHaveProperty("dirtyTabCount");
    expect(result.current).toHaveProperty("dirtyTabs");
    expect(result.current).toHaveProperty("pendingCloseTab");
    // pasted image (1)
    expect(result.current).toHaveProperty("handlePasteImage");
  });
});
