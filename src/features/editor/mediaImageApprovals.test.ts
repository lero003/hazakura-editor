import { describe, expect, it } from "vitest";
import {
  approveParentFolderForContext,
  effectiveApprovedRoots,
  type MediaImageApprovalState,
} from "./mediaImageApprovals";

describe("mediaImageApprovals", () => {
  it("does not carry ask approvals into a newly opened document context", () => {
    const initial: MediaImageApprovalState = { contextKey: null, roots: [] };
    const approved = approveParentFolderForContext(
      initial,
      "workspace-a:tab-1",
      "/project/assets/cover.png",
      "ask",
    );

    expect(
      effectiveApprovedRoots(approved, "workspace-a:tab-1", "ask"),
    ).toEqual(["/project/assets"]);
    expect(
      effectiveApprovedRoots(approved, "workspace-a:tab-2", "ask"),
    ).toEqual([]);
  });

  it("uses an explicit allow setting without persisting folder approvals", () => {
    const state: MediaImageApprovalState = {
      contextKey: "workspace-a:tab-1",
      roots: ["/project/assets"],
    };
    expect(effectiveApprovedRoots(state, "workspace-b:tab-2", "allow")).toEqual([
      "/",
    ]);
  });
});
