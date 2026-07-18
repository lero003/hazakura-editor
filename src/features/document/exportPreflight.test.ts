import { describe, expect, it, vi } from "vitest";
import { analyzeExportPreflight } from "./exportPreflight";

describe("analyzeExportPreflight", () => {
  it("reports unavailable chapters, missing headings, and missing workspace images", async () => {
    const loadWorkspaceImage = vi.fn(async (path: string) => {
      if (path.endsWith("missing.png")) throw new Error("missing");
      return { dataUrl: "data:image/png;base64,AA==" };
    });
    const result = await analyzeExportPreflight({
      documents: [
        {
          name: "one.md",
          path: "/workspace/parts/one.md",
          markdown: "Body\n\n![ok](../assets/ok.png)\n![lost](../assets/missing.png)",
        },
      ],
      loadWorkspaceImage,
      unavailableChapterPaths: ["lost.md"],
      workspaceRoot: "/workspace",
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "chapter-unavailable", severity: "error" }),
      expect.objectContaining({ kind: "heading-missing", subject: "one.md" }),
      expect.objectContaining({ kind: "image-unavailable", subject: "/workspace/assets/missing.png" }),
    ]));
    expect(result.checkedImageCount).toBe(2);
  });

  it("deduplicates image probes and caps their count", async () => {
    const loadWorkspaceImage = vi.fn(async () => ({ dataUrl: "data:image/png;base64,AA==" }));
    const result = await analyzeExportPreflight({
      documents: [{
        name: "one.md",
        path: "/workspace/one.md",
        markdown: "# One\n![a](a.png)\n![again](a.png)\n![b](b.png)",
      }],
      loadWorkspaceImage,
      maxImages: 1,
      unavailableChapterPaths: [],
      workspaceRoot: "/workspace",
    });

    expect(loadWorkspaceImage).toHaveBeenCalledTimes(1);
    expect(result.checkedImageCount).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      kind: "image-check-truncated",
      severity: "warning",
    }));
  });
});
