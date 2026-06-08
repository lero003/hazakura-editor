import { describe, expect, it } from "vitest";
import {
  cssHighlightStyle,
  cssSyntaxHighlighting,
  htmlHighlightStyle,
  htmlSyntaxHighlighting,
  markdownHighlightStyle,
  markdownSyntaxHighlighting,
  pickEditorLanguage,
} from "./codeMirrorTheme";

// The picker + highlight-style module is the single source of
// truth for which file families get which CodeMirror language
// and which `HighlightStyle` they share. These tests pin three
// contracts:
//
//   1. The extension dispatch (`pickEditorLanguage`) routes
//      `.md`/`.markdown`/unknown to the GFM Markdown parser,
//      `.css` to the CSS parser, and `.html`/`.htm`/`.xml` to
//      the HTML parser.
//   2. The Markdown highlight style deliberately OMITS HTML
//      node tags so embedded `<br>` / `<div>` inside a `.md`
//      file stays prose-typed (the user explicitly asked for
//      this separation).
//   3. The HTML and CSS highlight styles each map their own
//      `cm-mark-*` token to at least one tag from their
//      language, so opening a `.css` or `.html` file shows
//      non-default colour.

function styleTagStrings(style: ReturnType<typeof markdownHighlightStyle>) {
  // `HighlightStyle` exposes the rule list via `.specs` — each
  // spec has a `tag` that may be a single `Tag` or an array of
  // them. We flatten to the readable `.toString()` so the test
  // is robust against ordering.
  return style.specs.flatMap((spec) => {
    const tag = spec.tag;
    if (Array.isArray(tag)) {
      return tag.map((t) => t.toString());
    }
    return [tag.toString()];
  });
}

function styleColorStrings(style: ReturnType<typeof markdownHighlightStyle>) {
  return style.specs.map((spec) => String(spec.color ?? ""));
}

describe("pickEditorLanguage", () => {
  it("routes Markdown extensions to the GFM-flavoured Markdown parser", () => {
    expect(pickEditorLanguage("/notes/spec.md").kind).toBe("markdown");
    expect(pickEditorLanguage("/notes/spec.markdown").kind).toBe("markdown");
    expect(pickEditorLanguage("/notes/README").kind).toBe("markdown");
    expect(pickEditorLanguage("/notes/no-extension").kind).toBe("markdown");
  });

  it("routes .css to the CSS parser", () => {
    const picked = pickEditorLanguage("/assets/style.css");
    expect(picked.kind).toBe("css");
  });

  it("routes .html / .htm / .xml to the HTML parser", () => {
    expect(pickEditorLanguage("/site/index.html").kind).toBe("html");
    expect(pickEditorLanguage("/site/index.htm").kind).toBe("html");
    expect(pickEditorLanguage("/site/feed.xml").kind).toBe("html");
  });

  it("is case-insensitive on the extension", () => {
    expect(pickEditorLanguage("/a/Index.HTML").kind).toBe("html");
    expect(pickEditorLanguage("/a/Theme.CSS").kind).toBe("css");
    expect(pickEditorLanguage("/a/Note.MD").kind).toBe("markdown");
  });

  it("forces the Markdown branch when L Mode is enabled", () => {
    // The L Mode decoration pass targets Markdown / GFM AST
    // nodes (ATXHeading*, Blockquote, FencedCode, Task, ...),
    // so a non-Markdown parser would leave the surface in an
    // inconsistent state. The picker pins both the parser and
    // the highlight to Markdown so L Mode stays honest and the
    // user's "no CSS/HTML highlighting in L Mode" rule holds.
    expect(pickEditorLanguage("/a/site.css", { lModeEnabled: true }).kind).toBe(
      "markdown",
    );
    expect(pickEditorLanguage("/a/index.html", { lModeEnabled: true }).kind).toBe(
      "markdown",
    );
    expect(pickEditorLanguage("/a/feed.xml", { lModeEnabled: true }).kind).toBe(
      "markdown",
    );
  });

  it("still returns Markdown for .md files in L Mode (regression pin)", () => {
    // L Mode + .md was the pre-existing happy path. Pin it
    // here so a future refactor can't quietly change the
    // behaviour for the markdown surface.
    expect(pickEditorLanguage("/a/note.md", { lModeEnabled: true }).kind).toBe(
      "markdown",
    );
  });

  it("returns a non-null syntaxHighlighting extension for each family", () => {
    // `syntaxHighlighting(...)` returns an opaque `Extension`
    // wrapper, so identity is not stable. We pin the contract
    // at the level of the `kind` field plus a non-null
    // `highlight`. The wiring itself is covered indirectly by
    // the `*HighlightStyle` spec assertions below.
    const md = pickEditorLanguage("/a/note.md");
    const css = pickEditorLanguage("/a/site.css");
    const html = pickEditorLanguage("/a/index.html");

    expect(md.kind).toBe("markdown");
    expect(css.kind).toBe("css");
    expect(html.kind).toBe("html");
    expect(md.highlight).toBeTruthy();
    expect(css.highlight).toBeTruthy();
    expect(html.highlight).toBeTruthy();
  });
});

describe("markdownHighlightStyle", () => {
  it("omits HTML node tags so embedded <br>/<div> stays prose-typed", () => {
    const tagStrings = styleTagStrings(markdownHighlightStyle());
    // `tagName` / `attributeName` / `attributeValue` are the
    // tags the HTML parser would attach to `<br>` / `class=`.
    // They MUST NOT appear in the Markdown rule set, or the
    // `.md` writing surface would inherit the HTML palette.
    expect(tagStrings).not.toContain("tagName");
    expect(tagStrings).not.toContain("attributeName");
    expect(tagStrings).not.toContain("attributeValue");
  });
});

describe("htmlHighlightStyle", () => {
  it("maps tagName / attributeName / attributeValue to cm-mark tokens", () => {
    const tagStrings = styleTagStrings(htmlHighlightStyle());
    expect(tagStrings).toContain("tagName");
    expect(tagStrings).toContain("attributeName");
    expect(tagStrings).toContain("attributeValue");
  });

  it("uses existing --cm-mark-* tokens (no new theme tokens)", () => {
    // Serialise the colour rules and assert they only reference
    // the project's shared mark tokens, not raw hex / rgb.
    const colourStrings = styleColorStrings(htmlHighlightStyle()).join("\n");
    expect(colourStrings).toMatch(/var\(--cm-mark-link\)/);
    expect(colourStrings).toMatch(/var\(--cm-mark-monospace\)/);
    expect(colourStrings).toMatch(/var\(--cm-mark-quote\)/);
    expect(colourStrings).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("cssHighlightStyle", () => {
  it("maps CSS-specific tags to cm-mark tokens", () => {
    const tagStrings = styleTagStrings(cssHighlightStyle());
    expect(tagStrings).toContain("propertyName");
    expect(tagStrings).toContain("tagName");
    expect(tagStrings).toContain("className");
    expect(tagStrings).toContain("number");
  });

  it("uses existing --cm-mark-* tokens (no new theme tokens)", () => {
    const colourStrings = styleColorStrings(cssHighlightStyle()).join("\n");
    expect(colourStrings).toMatch(/var\(--cm-mark-link\)/);
    expect(colourStrings).toMatch(/var\(--cm-mark-strong\)/);
    expect(colourStrings).toMatch(/var\(--cm-mark-monospace\)/);
    expect(colourStrings).toMatch(/var\(--cm-mark-quote\)/);
    expect(colourStrings).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
