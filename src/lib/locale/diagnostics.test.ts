import { describe, expect, it } from "vitest";
import { getDiagnosticsPaneCopy } from "./diagnostics";

// The kana pass is not a dialect register: it is the repo's shared
// read-aloud style, hiragana words with a space between them and
// loanwords left in katakana. Pin the whole block so a future edit
// cannot quietly reintroduce English leftovers or dialect spellings.
describe("getDiagnosticsPaneCopy", () => {
  it("keeps the kana strings in the shared read-aloud style", () => {
    expect(getDiagnosticsPaneCopy("kana")).toEqual({
      actionLabel: "コピー そうさ",
      copied: "コピーしました",
      copyFailed: "コピーできませんでした",
      copy: "コピー",
      json: "しんだん JSON",
      refresh: "さいど よみこむ",
      unavailable: "しんだん スナップショットが とれません。",
    });
  });

  it("keeps Japanese and English free of untranslated leftovers", () => {
    expect(getDiagnosticsPaneCopy("ja").copyFailed).toBe(
      "コピーできませんでした",
    );
    expect(getDiagnosticsPaneCopy("en").copyFailed).toBe("Copy failed");
  });
});
