import { describe, expect, it } from "vitest";
import { getSafeEditorCopy } from "./safeEditor";

describe("getSafeEditorCopy tab accessibility labels", () => {
  it("localizes the tab row and tab list names", () => {
    expect(getSafeEditorCopy("en").openFiles).toBe("Open files");
    expect(getSafeEditorCopy("en").openFileTabs).toBe("Open file tabs");
    expect(getSafeEditorCopy("ja").openFiles).toBe("開いているファイル");
    expect(getSafeEditorCopy("ja").openFileTabs).toBe("開いているファイルの一覧");
    expect(getSafeEditorCopy("kana").openFiles).toBe("ひらいている ふみ");
    expect(getSafeEditorCopy("kana").openFileTabs).toBe(
      "ひらいている ふみのならび",
    );
  });

  it("keeps the copy key set aligned across languages", () => {
    const keys = Object.keys(getSafeEditorCopy("en")).sort();
    for (const language of ["ja", "kana"] as const) {
      expect(Object.keys(getSafeEditorCopy(language)).sort()).toEqual(keys);
    }
  });
});
