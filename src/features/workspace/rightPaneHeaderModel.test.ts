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

// 実機フィードバック: 見出しに長い説明文を出していた（モックは `PREVIEW / 表示のみ`
// のような2〜3語）。説明文は purposeTitle（ホバー）へ回し、見出しに残すのは
// **情報**（注意件数・読み取り専用）だけにする。
describe("resolveSidePaneHeader", () => {
  it("keeps the descriptive hints off the heading", () => {
    expect(resolveSidePaneHeader("preview", copy)).toEqual({
      mode: "preview",
      title: "Preview",
      purpose: null,
      purposeTitle: "Continuous scroll to check layout",
      closeLabel: "Close side pane",
    });
    expect(resolveSidePaneHeader("ebook", copy).purpose).toBeNull();
    expect(resolveSidePaneHeader("ebook", copy).purposeTitle).toBe(
      "Turn pages to reread",
    );
    expect(resolveSidePaneHeader("compare", copy).purpose).toBeNull();
    expect(resolveSidePaneHeader("compare", copy).purposeTitle).toBe(
      "Compare changes before deciding",
    );
  });

  it("keeps the live outline count visible and the fallback on hover", () => {
    expect(
      resolveSidePaneHeader("outline", copy, {
        outlinePurpose: "2 structure hints (not errors)",
      }).purpose,
    ).toBe("2 structure hints (not errors)");
    const withoutAdvisories = resolveSidePaneHeader("outline", copy);
    expect(withoutAdvisories.purpose).toBeNull();
    expect(withoutAdvisories.purposeTitle).toBe("Jump by headings");
  });
});

describe("resolveReferencePaneHeader", () => {
  it("puts the file identity in the heading and the read-only status as the note", () => {
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
      title: "scan.pdf",
      purpose: "Read-only",
      purposeTitle: "/ws/docs/scan.pdf",
      closeLabel: "Close reference",
    });
  });

  it("falls back to the pane title when the file has no name yet", () => {
    expect(
      resolveReferencePaneHeader({
        title: "Reference",
        fileName: "",
        filePath: "",
        readOnlyLabel: "Read-only",
        closeLabel: "Close reference",
      }).title,
    ).toBe("Reference");
  });
});
