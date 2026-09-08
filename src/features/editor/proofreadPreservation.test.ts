import { describe, expect, it } from "vitest";
import { preservesProofreadStructure } from "./proofreadPreservation";
describe("proofreading preservation", () => {
  const source = '# 見出し\n\n9月18日、1200円です。\n\n[案内](https://example.com)\n\n> 引用です。\n\n| 数 |\n|---|\n| 3 |\n\n```js\nconst x = 3;\n```\n\n- 項目';
  it("accepts prose corrections while preserving protected content", () => {
    expect(preservesProofreadStructure(source, source.replace('です。\n\n[案内]', 'になります。\n\n[案内]'))).toBe(true);
  });
  it.each([
    source.replace('1200', '1300'), source.replace('https://example.com', 'https://example.net'),
    source.replace('> 引用です。', '引用です。'), source.replace('| 数 |\n|---|\n| 3 |', '数量は3です。'),
    source.replace('const x', 'let x'), source.replace('# 見出し', '見出し'), source.replace('- 項目', '項目'),
  ])("rejects structural or numerical drift", candidate => {
    expect(preservesProofreadStructure(source, candidate)).toBe(false);
  });
  it("preserves inline code exactly", () => {
    expect(preservesProofreadStructure("`const value` を使います。", "`let value` を使います。")).toBe(false);
  });
  it("accepts a corrected link label with unchanged destination", () => {
    expect(preservesProofreadStructure('[案內](guide.md)', '[案内](guide.md)')).toBe(true);
  });
});
