import { describe, expect, it } from "vitest";
import { getSidePaneCopy } from "./sidePane";

describe("getSidePaneCopy purpose-led pane titles", () => {
  it("explains the task behind each pane instead of repeating its feature name", () => {
    expect(getSidePaneCopy("en")).toMatchObject({
      previewTabTitle: "Check how the Markdown looks",
      previewTabTitleHide: "Hide preview — source stays in the editor",
      referenceTabTitle: "Edit while checking the source beside it",
      referenceTabTitleRetained: "Show the loaded reference again",
      ebookTabTitle: "Read the document like a book",
      outlineTabTitle: "Jump to a section from its headings",
      diffTabTitle: "Compare changes before deciding",
    });

    expect(getSidePaneCopy("ja")).toMatchObject({
      previewTabTitle: "書いた Markdown の見た目を確認",
      previewTabTitleHide: "プレビューを隠す（原稿は残る）",
      referenceTabTitle: "原本を横に見ながら直す",
      referenceTabTitleRetained: "読み込み済みの参照を再表示",
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
      previewDisabled:
        "したみは おこのみで つかわないせっていです。ふみそのものは のこります。",
    });
  });

  it("keeps each purpose tooltip distinct within every language", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getSidePaneCopy(lang);
      const titles = [
        copy.previewTabTitle,
        copy.previewTabTitleHide,
        copy.referenceTabTitle,
        copy.referenceTabTitleHide,
        copy.referenceTabTitleRetained,
        copy.ebookTabTitle,
        copy.ebookTabTitleHide,
        copy.outlineTabTitle,
        copy.outlineTabTitleHide,
        copy.diffTabTitle,
        copy.diffTabTitleHide,
      ];

      expect(new Set(titles), `duplicate pane title in ${lang}`).toHaveLength(
        titles.length,
      );
      expect(titles.every((title) => title.length > 0)).toBe(true);
    }
  });

  it("keeps the copy key set aligned across languages", () => {
    const keys = Object.keys(getSidePaneCopy("en")).sort();
    for (const language of ["ja", "kana"] as const) {
      expect(Object.keys(getSidePaneCopy(language)).sort()).toEqual(keys);
    }
  });
});
