import { describe, expect, it } from "vitest";
import { importAssistConfirmCopy } from "./importAssist";

describe("importAssistConfirmCopy", () => {
  it("uses Japanese draft framing for Japanese menus", () => {
    const copy = importAssistConfirmCopy("ja", "メモ.pdf");
    expect(copy.title).toContain("Markdown");
    expect(copy.message).toContain("メモ.pdf");
    expect(copy.message).toContain("未保存");
    expect(copy.message).toContain("OCR");
  });

  it("uses English draft framing for English menus", () => {
    const copy = importAssistConfirmCopy("en", "scan.png");
    expect(copy.title).toMatch(/Import/i);
    expect(copy.message).toContain("scan.png");
    expect(copy.message).toMatch(/unsaved/i);
    expect(copy.message).toMatch(/on-device OCR/i);
  });
});
