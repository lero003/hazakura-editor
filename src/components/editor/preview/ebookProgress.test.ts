import { describe, expect, it } from "vitest";
import {
  ebookProgressAria,
  ebookProgressPercent,
  ebookProgressText,
  resolveMeasurement,
  type EBookProgressCopy,
} from "./ebookProgress";

const copy: EBookProgressCopy = {
  pageProgress: "Page",
  footerPageProgress: "Chapter page",
  pageProgressUnknown: "Counting pages…",
};

describe("ebook progress display (R4)", () => {
  it("does not claim a value or a page number before measurement", () => {
    const input = { measured: false, pageIndex: 0, pageCount: 1 };
    // 文字も ARIA も「1 / 1」と言い切らない。
    expect(ebookProgressText(input, copy, "header")).toBe("Counting pages…");
    expect(ebookProgressText(input, copy, "footer")).toBe("Counting pages…");
    expect(ebookProgressAria(input, copy)).toEqual({
      "aria-valuetext": "Counting pages…",
    });
    expect(ebookProgressPercent(input)).toBe(0);
  });

  it("shows 1 / 1 once a genuinely one-page chapter is measured", () => {
    // 初期値の1と実測の1が同じでも、計測済みなら値を出す（最も微妙な境界）。
    const input = { measured: true, pageIndex: 0, pageCount: 1 };
    expect(ebookProgressText(input, copy, "header")).toBe("Page 1 / 1");
    expect(ebookProgressText(input, copy, "footer")).toBe("Chapter page 1 / 1");
    expect(ebookProgressPercent(input)).toBe(100);
    expect(ebookProgressAria(input, copy)).toEqual({
      "aria-valuemin": 0,
      "aria-valuemax": 1,
      "aria-valuenow": 1,
    });
  });

  it("keeps the visual fill and the ARIA range on the same percentage", () => {
    const input = { measured: true, pageIndex: 0, pageCount: 4 };
    const percent = ebookProgressPercent(input);
    expect(percent).toBe(25);
    const aria = ebookProgressAria(input, copy);
    const min = Number(aria["aria-valuemin"]);
    const max = Number(aria["aria-valuemax"]);
    const now = Number(aria["aria-valuenow"]);
    expect(((now - min) / (max - min)) * 100).toBe(percent);
  });

  it("invalidates the measurement when the document changes (P2-low)", () => {
    // 文書A の chapter 0 = 12ページ。文書B の chapter 0 は**別物**。
    const fromDocumentA = {
      documentLocationKey: "/workspace/a.md",
      chapterIndex: 0,
      count: 12,
    };
    expect(resolveMeasurement(fromDocumentA, "/workspace/a.md", 0)).toEqual(fromDocumentA);
    // 文書が変わった最初の render から無効（章番号だけでは足りない）。
    expect(resolveMeasurement(fromDocumentA, "/workspace/b.md", 0)).toBeNull();
    // 章が変わったときも無効。
    expect(resolveMeasurement(fromDocumentA, "/workspace/a.md", 1)).toBeNull();
    // 未計測はそのまま未計測。
    expect(resolveMeasurement(null, "/workspace/a.md", 0)).toBeNull();
  });

  it("never reports a page beyond the measured total", () => {
    // 章の切り替え直後など、現在ページが新しい総数を超える場合の防御。
    const aria = ebookProgressAria(
      { measured: true, pageIndex: 9, pageCount: 2 },
      copy,
    );
    expect(aria["aria-valuenow"]).toBe(2);
    expect(aria["aria-valuemax"]).toBe(2);
  });
});
