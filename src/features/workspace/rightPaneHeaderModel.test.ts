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
  previewPurposeHint: "Continuous scroll to check layout",
  ebookPurposeHint: "Turn pages to reread",
  diffTabTitle: "Compare changes before deciding",
  closeRightPane: "Close side pane",
  outlinePurposeFallback: "Jump by headings",
};

describe("resolveSidePaneHeader", () => {
  it("maps each side-pane mode to a short title and purpose", () => {
    expect(resolveSidePaneHeader("preview", copy)).toEqual({
      mode: "preview",
      title: "Preview",
      purpose: "Continuous scroll to check layout",
      purposeTitle: null,
      closeLabel: "Close side pane",
    });
    expect(resolveSidePaneHeader("ebook", copy).purpose).toBe(
      "Turn pages to reread",
    );
    expect(resolveSidePaneHeader("compare", copy).purpose).toBe(
      "Compare changes before deciding",
    );
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
  it("puts the filename first and keeps the full path for hover", () => {
    expect(
      resolveReferencePaneHeader({
        title: "Reference",
        fileName: "scan.pdf",
        filePath: "/ws/docs/scan.pdf",
        readOnlyLabel: "Read-only",
        closeLabel: "Close reference",
      }),
    ).toEqual({
      mode: "reference",
      title: "Reference",
      purpose: "scan.pdf · Read-only",
      purposeTitle: "/ws/docs/scan.pdf",
      closeLabel: "Close reference",
    });
  });
});
