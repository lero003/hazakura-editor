import { describe, expect, it } from "vitest";
import { documentBreadcrumbParts } from "./documentBreadcrumb";

describe("documentBreadcrumbParts", () => {
  it("shows the tail of the path (not the whole absolute path)", () => {
    // 実機/モック: 「散文集 / chapters / 02_朝の余白.md」のように末尾だけを示す。
    expect(
      documentBreadcrumbParts("/Users/kei/マイドライブ/散文集/chapters/02_朝の余白.md"),
    ).toEqual(["chapters", "02_朝の余白.md"]);
  });

  it("returns nothing for unsaved (pathless) documents", () => {
    // 未保存の文書では出さない（架空の場所を出さない）。
    expect(documentBreadcrumbParts(null)).toEqual([]);
    expect(documentBreadcrumbParts("")).toEqual([]);
    expect(documentBreadcrumbParts(undefined)).toEqual([]);
  });

  it("handles a single segment and Windows separators", () => {
    expect(documentBreadcrumbParts("/workspace/notes.md")).toEqual(["workspace", "notes.md"]);
    expect(documentBreadcrumbParts("C:\\work\\book\\ch1.md")).toEqual(["book", "ch1.md"]);
    expect(documentBreadcrumbParts("just-a-name.md")).toEqual(["just-a-name.md"]);
  });

  it("honours maxParts", () => {
    expect(documentBreadcrumbParts("/a/b/c/d.md", 3)).toEqual(["b", "c", "d.md"]);
    expect(documentBreadcrumbParts("/a/b/c/d.md", 0)).toEqual(["d.md"]);
  });
});
