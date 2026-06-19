import { describe, expect, it } from "vitest";
import type { EditorTab } from "../../types";
import { useActiveDocumentIdentity } from "./useActiveDocumentIdentity";

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "body",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fp",
    id: "/workspace/note.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "body",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: 1,
    name: "note.md",
    path: "/workspace/note.md",
    saveStatus: "idle",
    size: 4,
    ...overrides,
  };
}

describe("useActiveDocumentIdentity", () => {
  it("uses the untitled tab id as the document key when no file path exists", () => {
    const identity = useActiveDocumentIdentity({
      activeTab: makeTab({
        id: "untitled:1",
        name: "untitled.md",
        path: "",
      }),
      selectedImage: null,
    });

    expect(identity.activeTabPath).toBeNull();
    expect(identity.documentKey).toBe("untitled:1");
    expect(identity.hasActiveDocument).toBe(true);
  });
});
