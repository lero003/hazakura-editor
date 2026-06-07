import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEditorFindController } from "./useEditorFindController";

describe("useEditorFindController", () => {
  it("returns the find/replace surface", () => {
    const { result } = renderHook(() =>
      useEditorFindController({
        documentKey: "test",
        editorPaneRef: { current: null },
        setStatus: () => {},
        source: "hello world",
      }),
    );

    // find / replace (19)
    expect(result.current).toHaveProperty("activeMatchIndex");
    expect(result.current).toHaveProperty("closeFindAndFocusEditor");
    expect(result.current).toHaveProperty("findMatchCount");
    expect(result.current).toHaveProperty("findMatches");
    expect(result.current).toHaveProperty("findQuery");
    expect(result.current).toHaveProperty("findVisible");
    expect(result.current).toHaveProperty("handleFindKeyDown");
    expect(result.current).toHaveProperty("handleReplaceKeyDown");
    expect(result.current).toHaveProperty("invalidRegex");
    expect(result.current).toHaveProperty("replaceAll");
    expect(result.current).toHaveProperty("replaceOne");
    expect(result.current).toHaveProperty("replaceQuery");
    expect(result.current).toHaveProperty("searchOptions");
    expect(result.current).toHaveProperty("setFindQuery");
    expect(result.current).toHaveProperty("setFindVisible");
    expect(result.current).toHaveProperty("setReplaceQuery");
    expect(result.current).toHaveProperty("setSearchOptions");
    expect(result.current).toHaveProperty("showNextMatch");
    expect(result.current).toHaveProperty("showPreviousMatch");
  });
});
