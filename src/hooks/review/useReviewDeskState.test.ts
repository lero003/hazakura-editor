import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReviewDeskState } from "./useReviewDeskState";

describe("useReviewDeskState candidate input source", () => {
  it("tracks a file-imported candidate source until the user edits it", () => {
    const { result } = renderHook(() => useReviewDeskState());

    act(() => {
      result.current.setCandidateInputFromFile("# Proposal\n", "proposal.md");
    });

    expect(result.current.candidateInputText).toBe("# Proposal\n");
    expect(result.current.candidateInputSource).toEqual({
      kind: "file",
      name: "proposal.md",
      edited: false,
    });

    act(() => {
      result.current.setCandidateInputText("# Edited proposal\n");
    });

    expect(result.current.candidateInputSource).toEqual({
      kind: "file",
      name: "proposal.md",
      edited: true,
    });

    act(() => {
      result.current.setCandidateInputText("");
    });

    expect(result.current.candidateInputSource).toEqual({ kind: "manual" });
  });

  it("resets the candidate source when clearing the candidate", () => {
    const { result } = renderHook(() => useReviewDeskState());

    act(() => {
      result.current.setCandidateInputFromFile("# Proposal\n", "proposal.md");
    });
    act(() => {
      result.current.clearCandidate();
    });

    expect(result.current.candidateInputText).toBe("");
    expect(result.current.candidateInputSource).toEqual({ kind: "manual" });
  });
});
