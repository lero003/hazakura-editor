import { describe, expect, it } from "vitest";
import {
  isImageReferencePath,
  isPdfReferencePath,
  isReferencePath,
  isSameFileAsActiveEditor,
  isTextReferencePath,
  normalizePathForCompare,
  referenceDisplayName,
  referenceRoleLabel,
} from "./referenceCompare";
import type { ReferenceDocument } from "./types";

describe("referenceCompare helpers", () => {
  it("classifies text, pdf, and image reference paths", () => {
    expect(isTextReferencePath("/ws/a.md")).toBe(true);
    expect(isTextReferencePath("/ws/note.TXT")).toBe(true);
    expect(isPdfReferencePath("/ws/a.pdf")).toBe(true);
    expect(isPdfReferencePath("/ws/a.PDF")).toBe(true);
    expect(isImageReferencePath("/ws/photo.png")).toBe(true);
    expect(isImageReferencePath("/ws/a.webp")).toBe(true);
    expect(isReferencePath("/ws/a.md")).toBe(true);
    expect(isReferencePath("/ws/a.pdf")).toBe(true);
    expect(isReferencePath("/ws/a.png")).toBe(true);
    expect(isReferencePath("/ws/a.docx")).toBe(false);
  });

  it("detects same-file self-reference", () => {
    expect(isSameFileAsActiveEditor("/ws/a.md", "/ws/a.md")).toBe(true);
    expect(isSameFileAsActiveEditor("/ws/a.md/", "/ws/a.md")).toBe(true);
    expect(isSameFileAsActiveEditor("/ws/a.md", "/ws/b.md")).toBe(false);
    expect(isSameFileAsActiveEditor("/ws/a.md", null)).toBe(false);
  });

  it("normalizes trailing slashes for path compare", () => {
    expect(normalizePathForCompare("/ws/docs/")).toBe("/ws/docs");
  });

  it("builds display name and accessible role label", () => {
    const ref: ReferenceDocument = {
      kind: "text",
      path: "/ws/outline.md",
      name: "outline.md",
      contents: "# hi\n",
      encoding: "utf-8",
    };
    expect(referenceDisplayName(ref)).toBe("outline.md");
    expect(referenceRoleLabel("ja", ref)).toContain("参照");
    expect(referenceRoleLabel("ja", ref)).toContain("読み取り専用");
    expect(referenceRoleLabel("en", ref)).toContain("read-only");
  });
});
