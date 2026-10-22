import { describe, expect, it } from "vitest";
import { ruleBody, stripCssComments } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const css = stripCssComments(readProjectFile("src/styles/edohigan-theme.css"));

describe("edohigan dawn backdrop", () => {
  it("keeps the sky behind the editor content inside the shell", () => {
    const backdrop = ruleBody(css, ".edohigan-scene-backdrop");
    expect(backdrop).toContain("z-index: -1");
    expect(backdrop).toContain("position: fixed");
    expect(backdrop).toContain("pointer-events: none");
    const shell = css.slice(css.indexOf(".app-shell:has(.edohigan-scene-backdrop)"));
    expect(shell).toContain("isolation: isolate");
  });

  it("keeps the writing surface as a scrim only while the scene exists", () => {
    // 情景が無いときは従来の不透明な紙。:has() の中だけで透かす。
    expect(css).toContain(":root[data-theme=\"edohigan\"] .app-shell:has(.edohigan-scene-backdrop)");
    const editor = ruleBody(
      css,
      ':root[data-theme="edohigan"] .app-shell:has(.edohigan-scene-backdrop) .cm-editor',
    );
    // 「紙」ではなく、上から下まで明るい霞。情景が右と下に残る。
    // 下端ほど白を強くし、長い原稿の最後の行までコントラストを保つ。
    expect(editor).toContain("radial-gradient(");
    expect(editor).toContain("linear-gradient(");
    expect(editor).toContain("rgba(255, 253, 249, 0.56) 100%");
    expect(editor).toContain("background-color: transparent");
    // 背景をぼかすと木が消えるので、エディタ側では使わない（プレビューだけ）。
    expect(editor).not.toContain("backdrop-filter");
  });

  it("shows the scene through a deep glass preview", () => {
    const preview = ruleBody(
      css,
      ':root[data-theme="edohigan"] .app-shell:has(.edohigan-scene-backdrop) .preview-pane-preview',
    );
    // 本文の紙と外側のガラスを別の濃さにして、二重の霞で木を隠さない。
    expect(preview).toContain("--preview-reading-surface: rgba(252, 244, 236, 0.65)");
    expect(preview).toContain("background: rgba(252, 244, 236, 0.22)");
    expect(preview).toContain("backdrop-filter: blur(5px)");
    const paper = ruleBody(
      css,
      ':root[data-theme="edohigan"] .app-shell:has(.edohigan-scene-backdrop) .preview-pane-preview .markdown-preview',
    );
    expect(paper).toContain("background-color: transparent");
    expect(paper).toContain("var(--preview-reading-surface) 16px");
    expect(paper).toContain("var(--preview-reading-surface) calc(100% - 16px)");
  });

  it("keeps the reading surface solid so text never sits on the scene", () => {
    // 読む面は `--surface-paper-solid` のまま。glass 規則で上書きしない。
    const shellRule = css.slice(
      css.indexOf(":root[data-theme=\"edohigan\"] .app-shell:has(.edohigan-scene-backdrop)"),
      css.indexOf(".edohigan-scene-backdrop {"),
    );
    expect(shellRule).not.toContain("--surface-paper-solid");
  });
});
