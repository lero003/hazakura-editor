import { describe, expect, it } from "vitest";
import {
  commandPaletteEntry,
  getCommandPaletteCopy,
} from "./commandPalette";

describe("getCommandPaletteCopy", () => {
  it("keeps command and category keys aligned across languages", () => {
    const en = getCommandPaletteCopy("en");
    for (const language of ["ja", "kana"] as const) {
      const copy = getCommandPaletteCopy(language);
      expect(Object.keys(copy.categories).sort()).toEqual(
        Object.keys(en.categories).sort(),
      );
      expect(Object.keys(copy.commands).sort()).toEqual(
        Object.keys(en.commands).sort(),
      );
    }
  });

  it("uses purpose-led Japanese categories for write / read / verify", () => {
    expect(getCommandPaletteCopy("ja").categories).toMatchObject({
      edit: "書く",
      view: "読む",
      review: "確かめる",
    });
    expect(getCommandPaletteCopy("kana").categories).toMatchObject({
      edit: "かく",
      view: "よむ",
      review: "たしかめる",
    });
  });

  it("localizes writing-loop command labels", () => {
    expect(getCommandPaletteCopy("ja").commands["view.preview"].label).toContain(
      "プレビュー",
    );
    expect(getCommandPaletteCopy("ja").commands["view.diff"].label).toContain(
      "差分",
    );
    expect(
      getCommandPaletteCopy("ja").commands["file.openReference"].label,
    ).toContain("参照");
    expect(
      getCommandPaletteCopy("kana").commands["file.save"].label,
    ).toContain("ほぞん");
  });

  it("merges base and locale keywords for discoverability", () => {
    const entry = commandPaletteEntry(
      getCommandPaletteCopy("ja"),
      "view.diff",
      ["diff", "compare"],
    );
    expect(entry.keywords).toEqual(
      expect.arrayContaining(["diff", "compare", "確かめる"]),
    );
  });

  it("includes a short pre-create description for OKF scaffolds", () => {
    const minimal = commandPaletteEntry(
      getCommandPaletteCopy("ja"),
      "file.okfScaffoldMinimal",
    );
    expect(minimal.description).toMatch(/index\.md/);
    expect(minimal.description).toMatch(/自動修正はしません|Draft/);

    const book = commandPaletteEntry(
      getCommandPaletteCopy("en"),
      "file.okfScaffoldBookLike",
    );
    expect(book.description).toMatch(/chapters/i);
    expect(book.description).toMatch(/Book Scope/i);
  });

  it("localizes disabled reasons across languages", () => {
    expect(getCommandPaletteCopy("en").disabledReasons.needWorkspace).toContain(
      "workspace",
    );
    expect(getCommandPaletteCopy("en").disabledReasons.needSavedDocument).toContain(
      "Save",
    );
    expect(getCommandPaletteCopy("ja").disabledReasons.needActiveDocument).toContain(
      "ドキュメント",
    );
    expect(getCommandPaletteCopy("ja").disabledReasons.needSavedDocument).toContain(
      "保存",
    );
    expect(getCommandPaletteCopy("kana").disabledReasons.needWorkspace).toContain(
      "ワークスペース",
    );
  });
});
