import { describe, expect, it } from "vitest";
import { readProjectFile } from "../../test-support/source";

// Agent窓（Developerレーン）の chrome は英語固定で、保存済み表示言語を読まない。
// 窓の言語宣言（agentEntry.tsx の `en`）と表示文言が食い違わないよう、
// 「英語の文言」と「表示言語を読んでいないこと」を構造として固定する。
// 翻訳を入れるときは、この契約と `agentEntry.tsx` の宣言を一緒に変える。
const windowSource = readProjectFile("src/components/agent/AgentWindowApp.tsx");
const entrySource = readProjectFile("src/agentEntry.tsx");

describe("Agent window language contract", () => {
  it("declares en while the window chrome stays English", () => {
    expect(entrySource).toContain('document.documentElement.lang = "en"');
    expect(entrySource).not.toContain("syncDocumentLanguageFromStorage");

    expect(windowSource).toContain("Start session");
    expect(windowSource).toContain("Stop session");
    expect(windowSource).not.toContain("MENU_LANGUAGE_STORAGE_KEY");
    expect(windowSource).not.toContain("menuLanguage");
  });
});
