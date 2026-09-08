// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../src-tauri/src/commands/export.rs", import.meta.url), "utf8");
const script = source.split('PDF_CAPTURE_SIZE_SCRIPT: &str = r#"')[1].split('"#;')[0];

function measure({ text = [], media = [], scrollWidth = 595, cover = false, tailGuard }: {
  text?: number[]; media?: number[]; scrollWidth?: number; cover?: boolean; tailGuard?: number;
}) {
  const rect = (left: number) => ({ left, width: 200, top: 30 });
  const nodes = text.map((left) => ({ textContent: "本文", left, parentElement: { closest: () => null as object | null } }));
  if (tailGuard !== undefined) nodes.push({ textContent: "\u200b", left: tailGuard, parentElement: { closest: () => ({}) } });
  const preview = {
    clientHeight: 700, scrollWidth,
    getBoundingClientRect: () => ({ top: 0 }),
    querySelectorAll: (selector: string) => selector === ".book-scope-pdf-chapter"
      ? [] : media.map((left) => ({ getClientRects: () => [rect(left)] })),
  };
  const document = {
    body: { scrollWidth }, documentElement: { scrollWidth },
    querySelector: (selector: string) => selector === ".markdown-preview" ? preview : cover ? {} : null,
    createTreeWalker: () => { let i = 0; return { nextNode: () => nodes[i++] ?? null }; },
    createRange: () => {
      let selected = nodes[0];
      return { selectNodeContents: (node: typeof selected) => { selected = node; }, getClientRects: () => [rect(selected.left)] };
    },
  };
  const window = { scrollX: 0, getComputedStyle: () => ({ paddingTop: "0", paddingBottom: "0" }) };
  return JSON.parse(new Function("document", "window", "NodeFilter", `return ${script.trim()}`)(document, window, { SHOW_TEXT: 4 }));
}

describe("native PDF capture width", () => {
  it("does not capture a trailing empty column created by layout guards", () => {
    expect(measure({ text: [45, 640], media: [640], scrollWidth: 1785 })).toEqual({ width: 1190, height: 842 });
  });
  it("ignores the invisible zero-width tail-guard character", () => {
    expect(measure({ text: [45, 640], tailGuard: 1235, scrollWidth: 1785 }).width).toBe(1190);
  });
  it("retains the last text column even when scroll metrics undercount", () => {
    expect(measure({ text: [45, 1830], scrollWidth: 595 }).width).toBe(2380);
  });
  it("includes an image-only final page", () => {
    expect(measure({ text: [45], media: [1235], scrollWidth: 2380 }).width).toBe(1785);
  });
  it("counts a cover offset only once", () => {
    expect(measure({ text: [640, 1235], cover: true, scrollWidth: 2380 }).width).toBe(1785);
  });
  it("keeps a scroll fallback for content without measurable fragments", () => {
    expect(measure({ scrollWidth: 1190 }).width).toBe(1190);
  });
});
