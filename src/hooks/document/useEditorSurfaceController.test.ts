import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEditorSurfaceController } from "./useEditorSurfaceController";

describe("useEditorSurfaceController", () => {
  it("returns the side pane + active document surface surface", () => {
    const { result } = renderHook(() =>
      useEditorSurfaceController({
        activeContents: "",
        activeDirty: false,
        activeTab: null,
        compareView: null,
        editorPaneRef: { current: null },
        getCompareCaseByKey: vi.fn(),
        hasActiveDocument: false,
        menuLanguage: "en",
        noFileOpenText: "No file open",
        previewPaneRef: { current: null },
        previewVisible: true,
        rightPaneMode: "preview",
        selectedImage: null,
        selectionInfo: { line: 0, column: 0, selectedCharacters: 0, selectedLines: 0 },
        setPreviewVisible: vi.fn(),
        setRightPaneMode: vi.fn(),
        setSidePaneOpen: vi.fn(),
        sidePaneOpen: true,
      }),
    );

    // side pane controller (12)
    expect(result.current).toHaveProperty("editorPreviewGridRef");
    expect(result.current).toHaveProperty("editorPreviewGridStyle");
    expect(result.current).toHaveProperty("handlePreviewResizeKeyDown");
    expect(result.current).toHaveProperty("handlePreviewResizePointerDown");
    expect(result.current).toHaveProperty("handlePreviewResizePointerMove");
    expect(result.current).toHaveProperty("hasWorkspaceSelection");
    expect(result.current).toHaveProperty("previewColumnPercent");
    expect(result.current).toHaveProperty("sidePaneMode");
    expect(result.current).toHaveProperty("sidePaneVisible");
    expect(result.current).toHaveProperty("toggleDiffPane");
    expect(result.current).toHaveProperty("toggleOutlinePane");
    expect(result.current).toHaveProperty("togglePreviewPane");
    // active document surface (10)
    expect(result.current).toHaveProperty("activeDocumentLineCount");
    expect(result.current).toHaveProperty("activeStatusDetail");
    expect(result.current).toHaveProperty("currentMarkdownHeading");
    expect(result.current).toHaveProperty("documentHeadings");
    expect(result.current).toHaveProperty("documentOutline");
    expect(result.current).toHaveProperty("scrollHudContext");
    expect(result.current).toHaveProperty("scrollHudLine");
    expect(result.current).toHaveProperty("scrollHudVisible");
    expect(result.current).toHaveProperty("syncEditorScroll");
    expect(result.current).toHaveProperty("syncPreviewScroll");
  });
});
