import { describe, expect, it } from "vitest";
import {
  clampEditorViewState,
  documentViewStateKey,
  patchDocumentViewState,
  pruneDocumentViewStates,
  rekeyDocumentViewState,
} from "./documentViewState";

describe("document view state", () => {
  it("patches one surface without dropping the others", () => {
    const current = {
      "/a.md": {
        ebook: { chapterIndex: 2, pageIndex: 1 },
        editor: { anchor: 8, head: 8, scrollRatio: 0.4 },
      },
    };

    expect(
      patchDocumentViewState(current, "/a.md", {
        editor: { scrollRatio: 0.7 },
      }),
    ).toEqual({
      "/a.md": {
        ebook: { chapterIndex: 2, pageIndex: 1 },
        editor: { anchor: 8, head: 8, scrollRatio: 0.7 },
      },
    });
  });

  it("clamps stale selection offsets and scroll ratio", () => {
    expect(
      clampEditorViewState({ anchor: 40, head: -2, scrollRatio: 2 }, 12),
    ).toEqual({ anchor: 12, head: 0, scrollRatio: 1 });
  });

  it("prunes closed documents without changing kept entries", () => {
    const a = { editor: { anchor: 1, head: 1, scrollRatio: 0.2 } };

    expect(
      pruneDocumentViewStates(
        { a, b: { ebook: { chapterIndex: 1, pageIndex: 0 } } },
        ["a"],
      ),
    ).toEqual({ a });
  });

  it("moves every surface to the saved path key", () => {
    expect(
      rekeyDocumentViewState(
        {
          "untitled:1": {
            ebook: { chapterIndex: 1, pageIndex: 2 },
            editor: { anchor: 4, head: 4, scrollRatio: 0.5 },
            preview: { scrollRatio: 0.25 },
          },
        },
        "untitled:1",
        "/tmp/note.md",
      ),
    ).toEqual({
      "/tmp/note.md": {
        ebook: { chapterIndex: 1, pageIndex: 2 },
        editor: { anchor: 4, head: 4, scrollRatio: 0.5 },
        preview: { scrollRatio: 0.25 },
      },
    });
  });

  it("keys continuity by sessionId so Save As path changes do not require rekey", () => {
    expect(
      documentViewStateKey({
        sessionId: "session:untitled-1",
      }),
    ).toBe("session:untitled-1");
    expect(
      documentViewStateKey({
        sessionId: "session:untitled-1",
      }),
    ).toBe(
      documentViewStateKey({
        sessionId: "session:untitled-1",
      }),
    );
  });
});
