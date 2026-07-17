import { describe, expect, it } from "vitest";
import { getSafeEditorCopy } from "./safeEditor";

describe("getSafeEditorCopy tab accessibility labels", () => {
  it("localizes the tab row and tab list names", () => {
    expect(getSafeEditorCopy("en").editor).toBe("Editor");
    expect(getSafeEditorCopy("ja").editor).toBe("編集");
    expect(getSafeEditorCopy("kana").editor).toBe("へんしゅう");
    expect(getSafeEditorCopy("en").openFiles).toBe("Open files");
    expect(getSafeEditorCopy("en").openFileTabs).toBe("Open file tabs");
    expect(getSafeEditorCopy("ja").openFiles).toBe("開いているファイル");
    expect(getSafeEditorCopy("ja").openFileTabs).toBe("開いているファイルの一覧");
    expect(getSafeEditorCopy("kana").openFiles).toBe("ひらいている ふみ");
    expect(getSafeEditorCopy("kana").openFileTabs).toBe(
      "ひらいている ふみのならび",
    );
    expect(getSafeEditorCopy("en").closeFile("draft.md")).toBe(
      "Close draft.md",
    );
    expect(getSafeEditorCopy("ja").closeFile("draft.md")).toBe(
      "draft.mdを閉じる",
    );
    expect(getSafeEditorCopy("kana").closeFile("draft.md")).toBe(
      "draft.mdをとじる",
    );
  });

  it("keeps the copy key set aligned across languages", () => {
    const keys = Object.keys(getSafeEditorCopy("en")).sort();
    for (const language of ["ja", "kana"] as const) {
      expect(Object.keys(getSafeEditorCopy(language)).sort()).toEqual(keys);
    }
  });

  it("localizes returning start panel resume and recovery labels", () => {
    expect(getSafeEditorCopy("en").startHeadingReturning).toBe(
      "Continue where you left off",
    );
    expect(getSafeEditorCopy("ja").startHeadingReturning).toBe("続きから書く");
    expect(getSafeEditorCopy("kana").startHeadingReturning).toBe(
      "つづきから かく",
    );
    expect(getSafeEditorCopy("en").startResumeWorkspace("novel")).toBe(
      'Open last folder “novel”',
    );
    expect(getSafeEditorCopy("ja").startResumeWorkspace("novel")).toBe(
      "前回のフォルダ「novel」を開く",
    );
    expect(getSafeEditorCopy("kana").startResumeWorkspace("novel")).toBe(
      "まへの ところ「novel」をひらく",
    );
    expect(getSafeEditorCopy("en").startRecentWorkspacesSection).toBe(
      "Recent folders",
    );
    expect(getSafeEditorCopy("ja").startOpenRecentWorkspace("essays")).toBe(
      "フォルダ「essays」を開く",
    );
    expect(getSafeEditorCopy("en").startRecoveryHeading).toMatch(
      /pre-save notes/i,
    );
    expect(getSafeEditorCopy("ja").startRecoveryHeading).toContain("保存前");
    expect(getSafeEditorCopy("ja").startRecoverySection).toBe("確かめる");
  });
});
