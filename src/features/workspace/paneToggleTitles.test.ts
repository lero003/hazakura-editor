import { describe, expect, it } from "vitest";
import {
  resolvePaneToggleTitles,
  type PaneToggleTitleCopy,
} from "./paneToggleTitles";

const copy: PaneToggleTitleCopy = {
  previewTabTitle: "show-preview",
  previewTabTitleHide: "hide-preview",
  referenceTabTitle: "open-reference",
  referenceTabTitleHide: "hide-reference",
  referenceTabTitleRetained: "show-retained-reference",
  ebookTabTitle: "show-ebook",
  ebookTabTitleHide: "hide-ebook",
  outlineTabTitle: "show-outline",
  outlineTabTitleHide: "hide-outline",
  diffTabTitle: "show-diff",
  diffTabTitleHide: "hide-diff",
};

describe("resolvePaneToggleTitles", () => {
  it("uses show titles when panes are idle", () => {
    expect(
      resolvePaneToggleTitles(copy, {
        previewActive: false,
        referenceActive: false,
        referenceLoaded: false,
        ebookActive: false,
        outlineActive: false,
        diffActive: false,
      }),
    ).toEqual({
      preview: "show-preview",
      reference: "open-reference",
      ebook: "show-ebook",
      outline: "show-outline",
      diff: "show-diff",
    });
  });

  it("uses hide titles when panes are active", () => {
    expect(
      resolvePaneToggleTitles(copy, {
        previewActive: true,
        referenceActive: true,
        referenceLoaded: true,
        ebookActive: true,
        outlineActive: true,
        diffActive: true,
      }),
    ).toEqual({
      preview: "hide-preview",
      reference: "hide-reference",
      ebook: "hide-ebook",
      outline: "hide-outline",
      diff: "hide-diff",
    });
  });

  it("prefers retained reference title when loaded but hidden", () => {
    const titles = resolvePaneToggleTitles(copy, {
      previewActive: false,
      referenceActive: false,
      referenceLoaded: true,
      ebookActive: false,
      outlineActive: false,
      diffActive: false,
    });

    expect(titles.reference).toBe("show-retained-reference");
  });
});
