import { describe, expect, it } from "vitest";
import { resolvePreviewSection } from "./previewSection";

describe("resolvePreviewSection", () => {
  const sections = [
    { text: "朝の余白", top: 0 },
    { text: "何もしない時間", top: 400 },
    { text: "窓辺の小さな習慣", top: 900 },
  ];

  it("shows nothing before the first heading (no extra information at the top of the paper)", () => {
    // 紙の先頭では何も出さない（実機要望: 情報を増やさない）。
    expect(resolvePreviewSection([{ text: "朝の余白", top: 24 }], 0)).toBeNull();
    expect(resolvePreviewSection([], 100)).toBeNull();
  });

  it("returns the last heading that has been reached", () => {
    expect(resolvePreviewSection(sections, 0)).toBe("朝の余白");
    expect(resolvePreviewSection(sections, 100)).toBe("朝の余白");
    expect(resolvePreviewSection(sections, 400)).toBe("何もしない時間");
    expect(resolvePreviewSection(sections, 1200)).toBe("窓辺の小さな習慣");
  });

  it("switches a little before the heading so the cue does not lag", () => {
    // tolerance 8px: 見出しの8px手前で切り替わる（読み始める前に出る）。
    expect(resolvePreviewSection(sections, 393)).toBe("何もしない時間");
    expect(resolvePreviewSection(sections, 391)).toBe("朝の余白");
  });

  it("ignores headings without text", () => {
    expect(
      resolvePreviewSection(
        [
          { text: "", top: 0 },
          { text: "本文", top: 100 },
        ],
        150,
      ),
    ).toBe("本文");
  });
});
