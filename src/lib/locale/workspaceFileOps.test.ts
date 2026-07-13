import { describe, expect, it } from "vitest";
import { getWorkspaceFileOpsCopy } from "./workspaceFileOps";

describe("getWorkspaceFileOpsCopy workspace state labels", () => {
  it("localizes open and unsaved file states", () => {
    expect(getWorkspaceFileOpsCopy("en")).toMatchObject({
      loading: "Loading…",
      partialEntries: "Some entries are hidden by the per-folder limit.",
      openFileState: "open",
      unsavedOpenFileState: "unsaved",
    });
    expect(getWorkspaceFileOpsCopy("ja")).toMatchObject({
      loading: "読み込み中…",
      partialEntries: "フォルダごとの上限により一部の項目は非表示です。",
      openFileState: "開いている",
      unsavedOpenFileState: "未保存",
    });
    expect(getWorkspaceFileOpsCopy("kana")).toMatchObject({
      loading: "よみこみちゅう…",
      partialEntries: "ふぉるだごとの じょうげんにより いちぶの ふみは みえません。",
      openFileState: "ひらいている",
      unsavedOpenFileState: "ほぞんまえ",
    });
  });

  it("keeps the copy key set aligned across languages", () => {
    const keys = Object.keys(getWorkspaceFileOpsCopy("en")).sort();
    for (const language of ["ja", "kana"] as const) {
      expect(Object.keys(getWorkspaceFileOpsCopy(language)).sort()).toEqual(keys);
    }
  });
});
