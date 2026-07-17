import { describe, expect, it } from "vitest";
import {
  resolveReferencePaneHeader,
  resolveSidePaneHeader,
  type RightPaneHeaderCopy,
} from "./rightPaneHeaderModel";

const copy: RightPaneHeaderCopy = {
  previewTab: "Preview",
  ebookTab: "e-book",
  outlineTab: "Outline",
  diffTab: "Diff",
  referenceTab: "Reference",
  previewPurposeHint: "continuous scroll",
  ebookPurposeHint: "page turns",
  closeRightPane: "Close side pane",
  outlinePurposeFallback: "Jump by headings",
};

describe("resolveSidePaneHeader", () => {
  it("maps each side-pane mode to title and purpose without inventing chrome", () => {
    expect(resolveSidePaneHeader("preview", copy)).toEqual({
      mode: "preview",
      title: "Preview",
      purpose: "continuous scroll",
      closeLabel: "Close side pane",
    });
    expect(resolveSidePaneHeader("ebook", copy).purpose).toBe("page turns");
    expect(resolveSidePaneHeader("compare", copy).purpose).toBeNull();
  });

  it("prefers a live outline purpose over the fallback", () => {
    expect(
      resolveSidePaneHeader("outline", copy, {
        outlinePurpose: "2 structure hints (not errors)",
      }).purpose,
    ).toBe("2 structure hints (not errors)");
    expect(resolveSidePaneHeader("outline", copy).purpose).toBe(
      "Jump by headings",
    );
  });
});

describe("resolveReferencePaneHeader", () => {
  it("keeps reference identity in the purpose line", () => {
    expect(
      resolveReferencePaneHeader({
        title: "Reference",
        fileName: "scan.pdf",
        readOnlyLabel: "Read-only",
        closeLabel: "Close reference",
      }),
    ).toEqual({
      mode: "reference",
      title: "Reference",
      purpose: "Read-only · scan.pdf",
      closeLabel: "Close reference",
    });
  });
});
