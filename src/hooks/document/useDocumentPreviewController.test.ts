import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentPreviewController } from "./useDocumentPreviewController";

describe("useDocumentPreviewController", () => {
  it("returns the image preview + document identity surface", () => {
    const { result } = renderHook(() =>
      useDocumentPreviewController({
        activeTab: null,
        activeTabId: null,
        onError: vi.fn(),
        onStatus: vi.fn(),
        setActiveTabId: vi.fn(),
        setCompareView: vi.fn(),
        tabs: [],
        workspaceRootPath: null,
      }),
    );

    // image preview (5)
    expect(result.current).toHaveProperty("clearImagePreview");
    expect(result.current).toHaveProperty("closeSelectedImagePreview");
    expect(result.current).toHaveProperty("imageReturnTabId");
    expect(result.current).toHaveProperty("openImagePreview");
    expect(result.current).toHaveProperty("selectedImage");
    // document identity (4)
    expect(result.current).toHaveProperty("activeTabPath");
    expect(result.current).toHaveProperty("documentKey");
    expect(result.current).toHaveProperty("hasActiveDocument");
    expect(result.current).toHaveProperty("selectedImageOpen");
  });
});
