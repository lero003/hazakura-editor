import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReferenceCompareState } from "./useReferenceCompareState";

describe("useReferenceCompareState", () => {
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
});
