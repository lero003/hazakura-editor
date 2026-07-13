import { describe, expect, it } from "vitest";
import { getSlashMenuCopy } from "./slashMenu";

describe("getSlashMenuCopy accessibility labels", () => {
  it("localizes the slash-menu name", () => {
    expect(getSlashMenuCopy("en").menuLabel).toBe("Slash command menu");
    expect(getSlashMenuCopy("ja").menuLabel).toBe("スラッシュコマンド");
    expect(getSlashMenuCopy("kana").menuLabel).toBe("すらっしゅこまんど");
  });

  it("keeps the copy key set aligned across languages", () => {
    const keys = Object.keys(getSlashMenuCopy("en")).sort();
    for (const language of ["ja", "kana"] as const) {
      expect(Object.keys(getSlashMenuCopy(language)).sort()).toEqual(keys);
    }
  });
});
