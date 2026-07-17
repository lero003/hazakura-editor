import { describe, expect, it } from "vitest";
import { getSidePaneCopy } from "./sidePane";

describe("getSidePaneCopy purpose-led pane titles", () => {
  it("explains the task behind each pane instead of repeating its feature name", () => {
    expect(getSidePaneCopy("en")).toMatchObject({
      previewTabTitle:
        "Scroll continuously to check Markdown layout (not e-book pages)",
      previewTabTitleHide: "Hide preview — source stays in the editor",
      previewPurposeHint:
        "Preview — continuous scroll to check layout (no page turns)",
      referenceTabTitle: "Edit while checking the source beside it",
      referenceTabTitleRetained: "Show the loaded reference again",
      ebookTabTitle:
        "Turn pages and read like a book (not continuous preview)",
      ebookPurposeHint:
        "E-book — turn pages to reread (separate from Preview)",
      outlineTabTitle: "Jump to a section from its headings",
      diffTabTitle: "Compare changes before deciding",
    });

    expect(getSidePaneCopy("ja")).toMatchObject({
      previewTabTitle:
        "縦スクロールで Markdown の見た目を確認（電子書籍ではない）",
      previewTabTitleHide: "プレビューを隠す（原稿は残る）",
      previewPurposeHint:
        "プレビュー — 縦スクロールで見た目を確認（ページめくりなし）",
      referenceTabTitle: "原本を横に見ながら直す",
      referenceTabTitleRetained: "読み込み済みの参照を再表示",
      ebookTabTitle:
        "ページめくりで本のように読み返す（プレビューとは別）",
      ebookPurposeHint:
        "電子書籍 — ページめくりで読み返す（プレビューとは別）",
      outlineTabTitle: "見出しから目的の場所へ移動",
      diffTabTitle: "変更を見比べて確認",
    });

    expect(getSidePaneCopy("kana")).toMatchObject({
      previewTabTitle:
        "たてスクロールで Markdown の みためを たしかめる（えーぼっくではない）",
      referenceTabTitle: "げんぽんを よこに みながら なおす",
      ebookTabTitle:
        "ぺーじめくりで ほんのように よみかへす（したみとは べつ）",
      outlineTabTitle: "みだしから もくてきの ばしょへ うつる",
      diffTabTitle: "へんかを みくらべて たしかめる",
      previewDisabled:
        "したみは おこのみで つかわないせっていです。ふみそのものは のこります。",
    });
  });

  it("localizes delayed loading status for Preview and e-book", () => {
    expect(getSidePaneCopy("en").loadingPreview).toMatch(/preview/i);
    expect(getSidePaneCopy("en").loadingEbook).toMatch(/e-book/i);
    expect(getSidePaneCopy("ja").loadingPreview).toContain("プレビュー");
    expect(getSidePaneCopy("ja").loadingEbook).toContain("電子書籍");
    expect(getSidePaneCopy("kana").loadingPreview.length).toBeGreaterThan(4);
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
