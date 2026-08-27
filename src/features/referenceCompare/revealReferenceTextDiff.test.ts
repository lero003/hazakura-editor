import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bindExclusiveSidePaneOpen } from "../workspace/rightPaneExclusive";
import { useReferenceCompareState } from "../../hooks/referenceCompare/useReferenceCompareState";
import { revealReferenceTextDiff } from "./revealReferenceTextDiff";

describe("revealReferenceTextDiff", () => {
  it("opens Diff from a loaded text Reference and restores it without a picker", () => {
    const { result } = renderHook(() => useReferenceCompareState());
    const setSidePaneOpen = vi.fn();
    const openExclusive = bindExclusiveSidePaneOpen(setSidePaneOpen, () => {
      result.current.setReferencePaneVisible(false);
    });

    act(() => {
      result.current.setReferenceDocument({
        contents: "# style guide",
        encoding: "utf-8",
        kind: "text",
        name: "guide.md",
        path: "/workspace/guide.md",
      });
    });

    const snapshot = revealReferenceTextDiff({
      activeTab: {
        contents: "# draft",
        name: "draft.md",
        path: "/workspace/draft.md",
        sessionId: "/workspace/draft.md",
      },
      menuLanguage: "ja",
      reference: result.current.referenceCompare!.reference,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.compareCase.kind).toBe("file");
    if (snapshot?.compareCase.kind === "file") {
      expect(snapshot.compareCase.leftPath).toBe("/workspace/guide.md");
      expect(snapshot.compareCase.rightPath).toBe("/workspace/draft.md");
    }

    act(() => {
      openExclusive(true);
    });

    expect(setSidePaneOpen).toHaveBeenCalledWith(true);
    expect(result.current.referencePaneVisible).toBe(false);
    expect(result.current.referenceCompare?.reference.path).toBe(
      "/workspace/guide.md",
    );

    act(() => {
      result.current.setReferencePaneVisible(true);
    });

    expect(result.current.referencePaneVisible).toBe(true);
    expect(result.current.referenceCompare?.reference.name).toBe("guide.md");
    expect(result.current.referenceCompare).not.toBeNull();
  });

  it("does not discard the loaded Reference from the in-pane Diff action", () => {
    const source = readFileSync(
      `${process.cwd()}/src/hooks/app/useAppShellController.ts`,
      "utf8",
    );
    const start = source.indexOf("const showReferenceTextDiff");
    const end = source.indexOf("const handlePdfPageIndexChange");
    const body = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(body).toContain("revealReferenceTextDiff");
    expect(body).toContain("setSidePaneOpenFromUserAction(true)");
    expect(body).not.toContain("clearReferenceCompare");
  });
});
