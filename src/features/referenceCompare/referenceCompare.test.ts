import { describe, expect, it } from "vitest";
import {
  isSameFileAsActiveEditor,
  isTextReferencePath,
  normalizePathForCompare,
  referenceDisplayName,
  referenceRoleLabel,
} from "./referenceCompare";
import type { ReferenceDocument } from "./types";

describe("referenceCompare helpers", () => {
  it("accepts comparable text paths for R1 text references", () => {
    expect(isTextReferencePath("/ws/a.md")).toBe(true);
    expect(isTextReferencePath("/ws/note.TXT")).toBe(true);
    expect(isTextReferencePath("/ws/a.pdf")).toBe(false);
    expect(isTextReferencePath("/ws/photo.png")).toBe(false);
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
