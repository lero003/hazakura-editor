import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentStatus } from "./useDocumentStatus";
import type { EditorTab } from "../../types";

const activeTab: EditorTab = {
  contents: "# Title\n\nBody\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/book.md",
  large_file_warning: false,
  lastSavedContents: "# Title\n\nBody\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "book.md",
  path: "/workspace/book.md",
  saveStatus: "idle",
  size: 14,
};

describe("useDocumentStatus", () => {
  it("splits active document status into primary and secondary metadata", () => {
    const { result } = renderHook(() =>
      useDocumentStatus({
        activeContents: activeTab.contents,
        activeDirty: false,
        activeTab,
        compareCase: null,
        compareView: null,
        currentMarkdownHeading: { level: 1, line: 1, text: "Title" },
        menuLanguage: "en",
        noFileOpenText: "No file open",
        selectedImage: null,
        selectionInfo: {
          column: 1,
          line: 3,
          selectedCharacters: 0,
          selectedLines: 0,
        },
        sidePaneMode: "preview",
      }),
    );

    expect(result.current.statusDetail).toBe("Markdown · 14 B · 14 chars");
    expect(result.current.statusSecondaryDetail).toBe(
      "UTF-8 · LF · final newline · Ln 3, Col 1 · Position: § Title",
    );
  });
});
