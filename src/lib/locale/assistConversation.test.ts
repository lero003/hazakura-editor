import { describe, expect, it } from "vitest";
import { getAssistConversationCopy } from "./assistConversation";

describe("Assist conversation copy", () => {
  it.each([ ["en", "Request"], ["ja", "依頼"], ["kana", "おねがい"] ] as const)("provides %s copy", (language, composer) => {
    const copy = getAssistConversationCopy(language);
    expect(copy.composer).toBe(composer);
    // 「ことばを、整える。」のような作業に効かない言葉は UI から外したので、
    // 但し書き（安全のための情報）だけが残る。
    expect(copy.boundary).toBeTruthy();
  });
});
