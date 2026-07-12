import { describe, expect, it } from "vitest";
import { getSidePaneCopy } from "./sidePane";

describe("getSidePaneCopy purpose-led pane titles", () => {
  it("explains the task behind each pane instead of repeating its feature name", () => {
    expect(getSidePaneCopy("en")).toMatchObject({
      previewTabTitle: "Check how the Markdown looks",
      referenceTabTitle: "Edit while checking the source beside it",
      ebookTabTitle: "Read the document like a book",
      outlineTabTitle: "Jump to a section from its headings",
      diffTabTitle: "Compare changes before deciding",
    });

    expect(getSidePaneCopy("ja")).toMatchObject({
      previewTabTitle: "書いた Markdown の見た目を確認",
      referenceTabTitle: "原本を横に見ながら直す",
      ebookTabTitle: "本のように読み返す",
      outlineTabTitle: "見出しから目的の場所へ移動",
      diffTabTitle: "変更を見比べて確認",
    });

    expect(getSidePaneCopy("kana")).toMatchObject({
      previewTabTitle: "かいた Markdown の みためを たしかめる",
      referenceTabTitle: "げんぽんを よこに みながら なおす",
      ebookTabTitle: "ほんのやうに ふみを よみかへす",
      outlineTabTitle: "みだしから もくてきの ばしょへ うつる",
      diffTabTitle: "へんかを みくらべて たしかめる",
    });
  });

  it("keeps each purpose tooltip distinct within every language", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getSidePaneCopy(lang);
      const titles = [
        copy.previewTabTitle,
        copy.referenceTabTitle,
        copy.ebookTabTitle,
        copy.outlineTabTitle,
        copy.diffTabTitle,
      ];

      expect(new Set(titles), `duplicate pane title in ${lang}`).toHaveLength(5);
      expect(titles.every((title) => title.length > 0)).toBe(true);
    }
  });
});
