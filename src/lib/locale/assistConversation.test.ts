import { describe, expect, it } from "vitest";
import { getAssistConversationCopy } from "./assistConversation";

describe("Assist conversation copy", () => {
  it.each([ ["en", "Request"], ["ja", "依頼"], ["kana", "おねがい"] ] as const)("provides %s copy", (language, composer) => {
    const copy = getAssistConversationCopy(language);
    expect(copy.composer).toBe(composer);
    expect(copy.title).toBeTruthy(); expect(copy.boundary).toBeTruthy();
  });
});
