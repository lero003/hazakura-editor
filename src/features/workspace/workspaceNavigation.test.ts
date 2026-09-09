import { describe, expect, it } from "vitest";
import { resolveWorkspaceNavigation } from "./workspaceNavigation";

const base = { hasDocument: true, imageVisible: false, sidePaneMode: "preview" as const,
  referenceVisible: false, referenceLoaded: false, hasProposal: false,
  canReviewDisk: false, hasComparison: false };

describe("workspace navigation", () => {
  it("keeps Preview and Outline in Write, with no invented review target", () => {
    expect(resolveWorkspaceNavigation(base)).toEqual({ mode: "write", canNavigate: true, reviewTargets: [] });
    expect(resolveWorkspaceNavigation({ ...base, sidePaneMode: "outline" }).mode).toBe("write");
  });
  it("derives Read and Review from the visible surface", () => {
    expect(resolveWorkspaceNavigation({ ...base, sidePaneMode: "ebook" }).mode).toBe("read");
    expect(resolveWorkspaceNavigation({ ...base, referenceVisible: true }).mode).toBe("review");
    expect(resolveWorkspaceNavigation({ ...base, sidePaneMode: "compare" }).mode).toBe("review");
  });
  it("keeps all available review kinds distinct", () => {
    expect(resolveWorkspaceNavigation({ ...base, referenceLoaded: true, hasProposal: true,
      canReviewDisk: true, hasComparison: true }).reviewTargets).toEqual(["proposal", "disk", "reference", "comparison"]);
  });
  it("never navigates or saves a document hidden behind an image", () => {
    expect(resolveWorkspaceNavigation({ ...base, imageVisible: true, hasProposal: true,
      referenceLoaded: true, canReviewDisk: true })).toEqual({ mode: "read", canNavigate: false, reviewTargets: [] });
  });
  it("does not invent a current document for an empty workspace", () => {
    expect(resolveWorkspaceNavigation({ ...base, hasDocument: false }).canNavigate).toBe(false);
    expect(resolveWorkspaceNavigation({ ...base, hasDocument: false, hasProposal: true, canReviewDisk: true }).reviewTargets).toEqual([]);
  });
});
