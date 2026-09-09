import { describe, expect, it } from "vitest";
import { getCompactViewCopy } from "./compactView";

describe("compact view copy", () => {
  it.each([
    ["en", "Document view", "Edit", "Preview"],
    ["ja", "文書の表示", "編集", "プレビュー"],
    ["kana", "ぶんしょの ひょうじ", "へんしゅう", "ぷれびゅー"],
  ] as const)("localizes all controls in %s", (language, label, edit, preview) => {
    expect(getCompactViewCopy(language)).toEqual({ label, edit, preview });
  });
});
