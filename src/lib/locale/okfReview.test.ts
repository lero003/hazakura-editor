import { describe, expect, it } from "vitest";
import {
  formatOkfFindingMessage,
  formatOkfSurfaceStatus,
  formatOkfTruncationMessage,
  getOkfReviewCopy,
} from "./okfReview";

describe("getOkfReviewCopy", () => {
  it("keeps keys aligned across languages", () => {
    const en = getOkfReviewCopy("en");
    for (const language of ["ja", "kana"] as const) {
      const copy = getOkfReviewCopy(language);
      expect(Object.keys(copy).sort()).toEqual(Object.keys(en).sort());
      expect(Object.keys(copy.truncationReasons).sort()).toEqual(
        Object.keys(en.truncationReasons).sort(),
      );
      expect(Object.keys(copy.findingMessages).sort()).toEqual(
        Object.keys(en.findingMessages).sort(),
      );
    }
  });

  it("localizes the command-facing title for writers", () => {
    expect(getOkfReviewCopy("ja").title).toContain("知識フォルダ");
    expect(getOkfReviewCopy("ja").title).toContain("OKF");
    expect(getOkfReviewCopy("ja").contextMenuReview).toContain("知識フォルダ");
    expect(getOkfReviewCopy("ja").purposeIntro).toContain("自動では直しません");
    expect(getOkfReviewCopy("kana").cancelling).toContain("ちゅうし");
    expect(getOkfReviewCopy("en").title).toContain("knowledge folder");
  });
});

describe("formatOkfFindingMessage", () => {
  it("localizes finding text and preserves the related path", () => {
    const ja = getOkfReviewCopy("ja");
    const message = formatOkfFindingMessage(ja, {
      code: "broken-link",
      severity: "failure",
      relativePath: "concepts/a.md",
      message: "Broken internal link",
      relatedPath: "missing.md",
    });

    expect(message).toContain("リンク先");
    expect(message).toContain("missing.md");
    expect(message).not.toContain("Broken internal link");
  });
});

describe("formatOkfSurfaceStatus", () => {
  it("frames ordinary manuscript folders without sounding broken", () => {
    const ja = getOkfReviewCopy("ja");
    const status = formatOkfSurfaceStatus(
      ja,
      {
        folderKind: "plain-markdown",
        priorityFindings: [],
        optionalFindings: [],
        failureCount: 3,
        optionalCount: 0,
        hasNoIssues: false,
      },
      "ja",
    );
    expect(status).toContain("通常の原稿フォルダ");
    expect(status).not.toContain("{count}");
  });

  it("counts failures for okf-like folders", () => {
    const en = getOkfReviewCopy("en");
    const status = formatOkfSurfaceStatus(
      en,
      {
        folderKind: "okf-like",
        priorityFindings: [],
        optionalFindings: [],
        failureCount: 2,
        optionalCount: 1,
        hasNoIssues: false,
      },
      "en",
    );
    expect(status).toContain("2");
    expect(status).toContain("worth fixing");
  });
});

describe("formatOkfTruncationMessage", () => {
  it("localizes known budget reasons", () => {
    const ja = getOkfReviewCopy("ja");
    expect(formatOkfTruncationMessage(ja, "markdown-files", "ja")).toContain(
      "Markdown",
    );
    expect(formatOkfTruncationMessage(ja, "markdown-files", "ja")).toContain(
      "上限",
    );

    const en = getOkfReviewCopy("en");
    expect(formatOkfTruncationMessage(en, "total-bytes", "en")).toContain(
      "total bytes",
    );
  });

  it("falls back when reason is missing or unknown", () => {
    const en = getOkfReviewCopy("en");
    expect(formatOkfTruncationMessage(en, null, "en")).toBe(en.truncated);
    expect(formatOkfTruncationMessage(en, "custom", "en")).toContain("custom");
  });
});
