import { describe, expect, it, vi } from "vitest";

// vitest with `css: false` does not process the Vite `?raw`
// import used by the helper, so the production helper would
// see an empty string in tests. Stub the import with a
// representative slice of preview.css to keep the test
// meaningful without round-tripping the real file.
vi.mock("../../styles/preview.css?raw", () => ({
  default: `
.markdown-preview { color: var(--text); line-height: 1.7; }
.markdown-preview h1 { border-bottom: 2px solid var(--border); }
.markdown-table-frame { background: var(--surface); border: 1px solid var(--border); }
.markdown-table-frame th { background: var(--accent-soft); }
.blocked-image { background: var(--surface-muted); }
:root[data-theme="dark"] .markdown-preview code { color: #afe9c8; }
:root[data-theme="yakou"] .markdown-preview code { color: #b8f4df; }
`,
}));

import { getMarkdownPreviewCss } from "./markdownExportCss";

describe("getMarkdownPreviewCss", () => {
  it("returns the preview CSS text", () => {
    const css = getMarkdownPreviewCss();
    expect(css).toContain(".markdown-preview");
    expect(css).toContain(".markdown-table-frame");
    expect(css).toContain(".blocked-image");
  });

  it("strips theme-specific override rules", () => {
    // The export pulls the resolved CSS variables for the
    // current theme, so the [data-theme="dark"] /
    // [data-theme="yakou"] override blocks from preview.css
    // would be dead weight. Make sure they're not inlined
    // into the export.
    const css = getMarkdownPreviewCss();
    expect(css).not.toMatch(/data-theme="dark"/);
    expect(css).not.toMatch(/data-theme="yakou"/);
    expect(css).not.toMatch(/data-theme="shokou"/);
  });
});
