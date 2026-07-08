import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxTree, ensureSyntaxTree } from "@codemirror/language";
import { editorBaseSetup } from "./editorBaseSetup";

const setupSource = readFileSync(
  `${process.cwd()}/src/features/editor/editorBaseSetup.ts`,
  "utf8",
);
const editorPaneSource = readFileSync(
  `${process.cwd()}/src/components/editor/EditorPane.tsx`,
  "utf8",
);

describe("editorBaseSetup", () => {
  it("documents and excludes folding from the writing surface", () => {
    expect(setupSource).toMatch(/foldGutter/);
    expect(setupSource).toMatch(/omit folding|excluding folding|no fold/i);
    // No live fold APIs — comments may still name them.
    expect(setupSource).not.toMatch(/foldGutter\s*\(/);
    expect(setupSource).not.toMatch(/import\s*\{[^}]*\bfold(?:Gutter|Keymap|Service)\b/);
    expect(editorPaneSource).toMatch(/editorBaseSetup/);
    expect(editorPaneSource).not.toMatch(/from \"codemirror\"/);
    expect(editorPaneSource).not.toMatch(/\bbasicSetup\b/);
  });

  it("marks fenced ```markdown sample blocks as a single FencedCode node", () => {
    // Regression fixture for the template that triggered blank / fold
    // confusion in normal edit mode. The body must stay CodeText, not
    // real ATX headings, so structure outside the fence remains stable.
    const fence = [
      "```markdown",
      "## 判断ライン名",
      "",
      "### 目的",
      "この判断ラインで守りたいもの。",
      "",
      "### 原則",
      "基本的にはどう考えるか。",
      "```",
      "",
    ].join("\n");
    const doc = `# intro\n\n${fence}\n## after\n`;
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage }), editorBaseSetup],
    });
    const tree = ensureSyntaxTree(state, doc.length, 2000) ?? syntaxTree(state);

    const fenced: Array<{ from: number; to: number }> = [];
    const headings: Array<{ name: string; from: number }> = [];
    tree.iterate({
      enter(node) {
        if (node.name === "FencedCode") {
          fenced.push({ from: node.from, to: node.to });
        }
        if (node.name.startsWith("ATXHeading")) {
          headings.push({ name: node.name, from: node.from });
        }
      },
    });

    expect(fenced).toHaveLength(1);
    expect(state.doc.sliceString(fenced[0].from, fenced[0].from + 3)).toBe(
      "```",
    );
    // Real headings only outside the fence.
    expect(headings.map((h) => h.name)).toEqual([
      "ATXHeading1",
      "ATXHeading2",
    ]);
    expect(state.doc.sliceString(headings[0].from, headings[0].from + 7)).toBe(
      "# intro",
    );
    expect(state.doc.sliceString(headings[1].from, headings[1].from + 8)).toBe(
      "## after",
    );
  });

  it("does not install a fold gutter in the mounted editor chrome", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      doc: "```markdown\n## sample\n```\n",
      extensions: [
        editorBaseSetup,
        markdown({ base: markdownLanguage }),
      ],
    });

    expect(parent.querySelector(".cm-foldGutter")).toBeNull();
    expect(parent.querySelector(".cm-gutters")).not.toBeNull();

    view.destroy();
    parent.remove();
  });
});
