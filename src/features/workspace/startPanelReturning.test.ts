import { describe, expect, it } from "vitest";
import type { DraftRecord } from "../../types";
import { resolveStartPanelReturningContext } from "./startPanelReturning";

function pathlessDraft(
  recoveryId: string,
  name = "Untitled",
): DraftRecord {
  return {
    path: "",
    contents: "body",
    line_ending: "lf",
    savedFingerprint: "fp",
    updatedAt: 1,
    revision: 1,
    name,
    recoveryId,
    origin: "untitled",
  };
}

describe("resolveStartPanelReturningContext", () => {
  it("uses first-use when nothing is persisted and no drafts exist", () => {
    const context = resolveStartPanelReturningContext({
      persistedWorkspaceRootPath: null,
      liveWorkspaceRootPath: null,
      pathlessDrafts: [],
    });

    expect(context.mode).toBe("first-use");
    expect(context.showResumeWorkspace).toBe(false);
    expect(context.showRecovery).toBe(false);
  });

  it("offers resume when a persisted root exists but live root is empty", () => {
    const context = resolveStartPanelReturningContext({
      persistedWorkspaceRootPath: "/Users/me/Writing/novel",
      liveWorkspaceRootPath: null,
      pathlessDrafts: [],
    });

    expect(context.mode).toBe("returning");
    expect(context.showResumeWorkspace).toBe(true);
    expect(context.resumeWorkspacePath).toBe("/Users/me/Writing/novel");
    expect(context.resumeWorkspaceLabel).toBe("novel");
  });

  it("does not offer resume when the live workspace is already open", () => {
    const context = resolveStartPanelReturningContext({
      persistedWorkspaceRootPath: "/Users/me/Writing/novel",
      liveWorkspaceRootPath: "/Users/me/Writing/novel",
      pathlessDrafts: [],
    });

    expect(context.mode).toBe("returning");
    expect(context.showResumeWorkspace).toBe(false);
    expect(context.resumeWorkspacePath).toBeNull();
  });

  it("shows recovery for valid pathless drafts", () => {
    const drafts = [pathlessDraft("uuid-1", "import-notes")];
    const context = resolveStartPanelReturningContext({
      persistedWorkspaceRootPath: null,
      liveWorkspaceRootPath: null,
      pathlessDrafts: drafts,
    });

    expect(context.mode).toBe("returning");
    expect(context.showRecovery).toBe(true);
    expect(context.pathlessDrafts).toEqual(drafts);
  });

  it("ignores empty or path-backed draft records for start recovery", () => {
    const context = resolveStartPanelReturningContext({
      persistedWorkspaceRootPath: null,
      liveWorkspaceRootPath: null,
      pathlessDrafts: [
        {
          path: "/a.md",
          contents: "x",
          line_ending: "lf",
          savedFingerprint: "fp",
          updatedAt: 1,
          revision: 1,
          name: "a.md",
          origin: "file",
        },
        {
          ...pathlessDraft("uuid-empty", "empty"),
          contents: "",
        },
      ],
    });

    expect(context.showRecovery).toBe(false);
    expect(context.pathlessDrafts).toEqual([]);
  });
});
