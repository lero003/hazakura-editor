import { describe, expect, it } from "vitest";
import { ruleBody } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const edohigan = readProjectFile("src/styles/edohigan-theme.css");

/**
 * S10: 江戸彼岸の紙と枝。花を「窓の端の飾り」で終わらせず、
 * 紙の上の朝の光と、枝の微かな揺れまでを契約にする。
 */
describe("S10 edohigan paper depth", () => {
  it("gives the paper a warm morning light and a token edge", () => {
    const body = ruleBody(edohigan, ':root[data-theme="edohigan"] .cm-editor');
    expect(body).toContain("var(--paper-texture)");
    expect(body).toMatch(/radial-gradient\(/);
    expect(body).toContain("var(--edge-hi)");
    expect(body).toContain("var(--edge-lo)");
  });

  it("sways the branch without touching the fall transform", () => {
    const branch = ruleBody(edohigan, ".edohigan-branch");
    expect(branch).toContain("edohigan-branch-sway");
    expect(branch).toContain("transform-origin: left bottom");
    expect(edohigan).toContain("@keyframes edohigan-branch-sway");
    expect(edohigan).toMatch(/@keyframes edohigan-branch-sway[\s\S]*rotate:/s);
  });

  it("keeps the petals out of the writing column", () => {
    const petals = ruleBody(edohigan, ".edohigan-petals");
    expect(petals).toContain("transparent 36%, transparent 64%");
  });

  it("does not leave the reader on a flat fill", () => {
    const body = ruleBody(
      edohigan,
      ':root[data-theme="edohigan"] .ebook-page-sheet,\n:root[data-theme="edohigan"] .ebook-reading-focus-surface',
    );
    expect(body).toContain("background-image:");
    expect(body).toMatch(/linear-gradient\(180deg,\s*#fffdf9/);
  });
});
