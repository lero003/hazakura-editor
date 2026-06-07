import { describe, expect, it } from "vitest";
import { inlineWorkspaceAssetImages, renderMarkdown } from "./markdown";

describe("renderMarkdown image policy", () => {
  it("allows README-relative workspace images outside assets", () => {
    const html = renderMarkdown("![shot](docs/images/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/docs/images/shot.png"');
    expect(html).not.toContain("Image blocked");
  });

  it("keeps existing assets image references allowed", () => {
    const html = renderMarkdown("![asset](assets/pic.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/assets/pic.png"');
    expect(html).not.toContain("Image blocked");
  });

  it("allows README raw HTML image tags inside the workspace", () => {
    const html = renderMarkdown(
      '<img src="src/assets/hazakura-mark.png" alt="logo" width="128">',
      {
        documentPath: "/ws/README.md",
        workspaceRoot: "/ws",
      },
    );

    expect(html).toContain(
      'data-hazakura-image-path="/ws/src/assets/hazakura-mark.png"',
    );
    expect(html).toContain('alt="logo"');
    expect(html).not.toContain("Image blocked");
  });

  it("inlines workspace image placeholders through the preview loader", async () => {
    const html = renderMarkdown("![shot](docs/images/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    const inlined = await inlineWorkspaceAssetImages(html, async (path) => {
      expect(path).toBe("/ws/docs/images/shot.png");
      return "data:image/png;base64,iVBORw0KGgo=";
    });

    expect(inlined).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(inlined).not.toContain("data-hazakura-image-path");
  });

  it("resolves nested document-relative images inside the workspace", () => {
    const html = renderMarkdown("![figure](../docs/images/figure%201.png)", {
      documentPath: "/ws/notes/today.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain('data-hazakura-image-path="/ws/docs/images/figure 1.png"');
    expect(html).not.toContain("Image blocked");
  });

  it("blocks relative images that escape the workspace", () => {
    const html = renderMarkdown("![secret](../outside.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain("Image blocked: secret");
    expect(html).not.toContain("data-hazakura-image-path");
  });

  it("continues to block external images", () => {
    const html = renderMarkdown("![remote](https://example.com/shot.png)", {
      documentPath: "/ws/README.md",
      workspaceRoot: "/ws",
    });

    expect(html).toContain("Image blocked: remote");
    expect(html).not.toContain("https://example.com/shot.png");
  });
});
