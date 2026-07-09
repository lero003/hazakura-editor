import { describe, expect, it } from "vitest";
import { importAssistConfirmCopy } from "./importAssist";

describe("importAssistConfirmCopy", () => {
  it("uses plain Japanese wording for general users", () => {
    const copy = importAssistConfirmCopy("ja", "メモ.pdf");
    expect(copy.title).toContain("下書き");
    expect(copy.message).toContain("メモ.pdf");
    expect(copy.message).toContain("まだ保存していない");
    expect(copy.message).toContain("この Mac");
    expect(copy.message).toContain("あとから直せる");
    // Avoid jargon-heavy labels in the primary confirm copy.
    expect(copy.message).not.toMatch(/\bOCR\b/);
  });

  it("uses plain English wording for general users", () => {
    const copy = importAssistConfirmCopy("en", "scan.png");
    expect(copy.title).toMatch(/draft/i);
    expect(copy.message).toContain("scan.png");
    expect(copy.message).toMatch(/unsaved draft/i);
    expect(copy.message).toMatch(/this Mac/i);
    expect(copy.message).toMatch(/edit the draft/i);
    expect(copy.message).not.toMatch(/\bOCR\b/);
  });
});
