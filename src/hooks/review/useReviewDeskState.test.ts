import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReviewDeskState } from "./useReviewDeskState";

describe("useReviewDeskState candidate compare primitive", () => {
  it("builds an internal candidate compare view without a Review Desk surface", () => {
    const { result } = renderHook(() => useReviewDeskState());

    act(() => {
      const compareResult = result.current.runCandidateCompare({
        bufferContents: "# Draft\nold line\n",
        documentTabId: "tab-1",
        documentPath: "/workspace/draft.md",
        documentLabel: "draft.md",
        leftColumnLabel: "Current buffer",
        rightColumnLabel: "AI candidate",
        candidateSourceLabel: "Hazakura Local Assist",
        candidateText: "# Draft\nnew line\n",
      });
      expect(compareResult).toEqual({ ok: true });
    });

    expect(result.current.candidateErrorMessage).toBeNull();
    expect(result.current.candidateCompareCase).toEqual(
      expect.objectContaining({
        kind: "candidate",
        documentTabId: "tab-1",
        documentPath: "/workspace/draft.md",
        documentLabel: "draft.md",
        leftColumnLabel: "Current buffer",
        rightColumnLabel: "AI candidate",
        candidateSourceLabel: "Hazakura Local Assist",
        candidateText: "# Draft\nnew line\n",
      }),
    );
    expect(result.current.candidateCompareView?.caseKey).toBe(
      result.current.candidateCompareCase?.key,
    );
  });

  it("clears an internal candidate compare view", () => {
    const { result } = renderHook(() => useReviewDeskState());

    act(() => {
      result.current.runCandidateCompare({
        bufferContents: "before\n",
        documentTabId: "tab-1",
        documentPath: "/workspace/draft.md",
        documentLabel: "draft.md",
        leftColumnLabel: "Current buffer",
        rightColumnLabel: "AI candidate",
        candidateSourceLabel: "Hazakura Local Assist",
        candidateText: "after\n",
      });
    });
    act(() => {
      result.current.clearCandidate();
    });

    expect(result.current.candidateCompareCase).toBeNull();
    expect(result.current.candidateCompareView).toBeNull();
    expect(result.current.candidateErrorMessage).toBeNull();
  });
});
