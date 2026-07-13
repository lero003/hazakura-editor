import { describe, expect, it } from "vitest";
import { parseMarkdownStructure } from "./markdownStructure";
import { buildHeadingLevelChange } from "./markdownStructureEdits";
import { applyLiveEditorContentsById, isDirty } from "./editorTabs";
import type { EditorTab } from "../../types";

function applyChange(
  source: string,
  change: NonNullable<ReturnType<typeof buildHeadingLevelChange>>,
): string {
  return `${source.slice(0, change.from)}${change.insert}${source.slice(change.to)}`;
}

describe("buildHeadingLevelChange", () => {
  it("changes only the ATX marker and preserves CRLF and closing markers", () => {
    const source = "### Chapter ###\r\nbody\r\n";
    const [heading] = parseMarkdownStructure(source).headings;
    const change = buildHeadingLevelChange(source, heading, "promote");

    expect(change).toEqual({ from: 0, insert: "##", nextLevel: 2, to: 3 });
    expect(applyChange(source, change!)).toBe("## Chapter ###\r\nbody\r\n");
  });

  it("refuses level boundaries and stale source offsets", () => {
    const [h1] = parseMarkdownStructure("# One\n").headings;
    const [h6] = parseMarkdownStructure("###### Six\n").headings;

    expect(buildHeadingLevelChange("# One\n", h1, "promote")).toBeNull();
    expect(buildHeadingLevelChange("###### Six\n", h6, "demote")).toBeNull();
    expect(buildHeadingLevelChange("body\n", h1, "demote")).toBeNull();
  });

  it("keeps the edit in the existing tab identity and marks its buffer dirty", () => {
    const source = "## Chapter\nbody\n";
    const [heading] = parseMarkdownStructure(source).headings;
    const change = buildHeadingLevelChange(source, heading, "promote")!;
    const nextSource = applyChange(source, change);
    const tab: EditorTab = {
      contents: source,
      encoding: "utf-8",
      error: null,
      externalFingerprint: null,
      fingerprint: "fp",
      id: "/workspace/book.md",
      ignoredExternalFingerprint: null,
      large_file_warning: false,
      lastSavedContents: source,
      lastSavedEncoding: "utf-8",
      lastSavedLineEnding: "crlf",
      line_ending: "crlf",
      modified_ms: null,
      name: "book.md",
      path: "/workspace/book.md",
      saveStatus: "idle",
      sessionId: "session:book",
      size: source.length,
    };

    const [updated] = applyLiveEditorContentsById([tab], tab.id, nextSource);

    expect(updated).toMatchObject({
      contents: "# Chapter\nbody\n",
      id: tab.id,
      lastSavedContents: source,
      line_ending: "crlf",
      path: tab.path,
      sessionId: tab.sessionId,
    });
    expect(isDirty(updated)).toBe(true);
  });
});
