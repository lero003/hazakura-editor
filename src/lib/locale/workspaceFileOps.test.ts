import { describe, expect, it } from "vitest";
import { getWorkspaceFileOpsCopy } from "./workspaceFileOps";

describe("getWorkspaceFileOpsCopy Theme A clarity", () => {
  it("groups OKF starters under a section label across locales", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getWorkspaceFileOpsCopy(lang);
      expect(copy.newOkfScaffoldGroup.length).toBeGreaterThan(4);
      expect(copy.newOkfScaffoldMinimalRoot.length).toBeGreaterThan(1);
      expect(copy.newOkfScaffoldBookLikeRoot.length).toBeGreaterThan(1);
    }
    expect(getWorkspaceFileOpsCopy("en").newOkfScaffoldGroup).toMatch(
      /Knowledge folder/i,
    );
    expect(getWorkspaceFileOpsCopy("ja").newOkfScaffoldGroup).toContain(
      "知識フォルダ",
    );
  });

  it("names the trash target and distinct disabled reasons", () => {
    const en = getWorkspaceFileOpsCopy("en");
    expect(en.sidebarTrashTarget("draft.md")).toContain("draft.md");
    expect(en.sidebarTrashDisabledNoActive).toMatch(/select/i);
    expect(en.sidebarTrashDisabledNotInTree).toMatch(/expand/i);

    const ja = getWorkspaceFileOpsCopy("ja");
    expect(ja.sidebarTrashTarget("下書き.md")).toContain("下書き.md");
    expect(ja.sidebarTrashDisabledNoActive).toContain("選択");
    expect(ja.sidebarTrashDisabledNotInTree).toContain("展開");
  });
});
