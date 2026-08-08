import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useReferenceCompareState } from "./useReferenceCompareState";
import { WORKSPACE_PANE_LAYOUT_STORAGE_KEY } from "../../types";
import { readWorkspacePaneLayout } from "../../features/workspace/paneLayout";

describe("useReferenceCompareState", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the reference document while its pane is hidden", () => {
    const { result } = renderHook(() => useReferenceCompareState());

    act(() => {
      result.current.setReferenceDocument({
        contents: "# Guide",
        encoding: "utf-8",
        kind: "text",
        name: "guide.md",
        path: "/workspace/guide.md",
      });
    });

    expect(result.current.referencePaneVisible).toBe(true);
    expect(result.current.referenceCompare?.reference.name).toBe("guide.md");

    act(() => result.current.setReferencePaneVisible(false));

    expect(result.current.referencePaneVisible).toBe(false);
    expect(result.current.referenceCompare?.reference.name).toBe("guide.md");
  });

  it("clears both the document and visibility on explicit close", () => {
    const { result } = renderHook(() => useReferenceCompareState());

    act(() => {
      result.current.setReferenceDocument({
        contents: "reference",
        encoding: "utf-8",
        kind: "text",
        name: "reference.txt",
        path: "/workspace/reference.txt",
      });
      result.current.clearReferenceCompare();
    });

    expect(result.current.referenceCompare).toBeNull();
    expect(result.current.referencePaneVisible).toBe(false);
  });

  it("restores and persists the reference pane width", () => {
    window.localStorage.setItem(
      WORKSPACE_PANE_LAYOUT_STORAGE_KEY,
      JSON.stringify({ referenceColumnPercent: 61 }),
    );
    const { result } = renderHook(() => useReferenceCompareState());

    expect(result.current.referenceColumnPercent).toBe(61);

    act(() => result.current.setReferenceColumnPercent(47));

    expect(readWorkspacePaneLayout().referenceColumnPercent).toBe(47);
  });
});
