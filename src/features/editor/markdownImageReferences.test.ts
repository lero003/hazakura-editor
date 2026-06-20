import { describe, expect, it } from "vitest";
import { markdownPathForImportedImage } from "./markdownImageReferences";

describe("markdownPathForImportedImage", () => {
  it("keeps root document image references unchanged", () => {
    expect(
      markdownPathForImportedImage({
        activeTabPath: "/workspace/book.md",
        assetRelativePath: "assets/image.png",
        assetRootPath: "/workspace",
      }),
    ).toBe("assets/image.png");
  });

  it("rewrites workspace-root assets relative to nested documents", () => {
    expect(
      markdownPathForImportedImage({
        activeTabPath: "/workspace/books/draft.md",
        assetRelativePath: "assets/image.png",
        assetRootPath: "/workspace",
      }),
    ).toBe("../assets/image.png");
  });

  it("rewrites workspace-root assets relative to deeply nested documents", () => {
    expect(
      markdownPathForImportedImage({
        activeTabPath: "/workspace/books/part-1/draft.md",
        assetRelativePath: "assets/image.png",
        assetRootPath: "/workspace",
      }),
    ).toBe("../../assets/image.png");
  });

  it("leaves the imported path unchanged without an active document path", () => {
    expect(
      markdownPathForImportedImage({
        activeTabPath: null,
        assetRelativePath: "assets/image.png",
        assetRootPath: "/workspace",
      }),
    ).toBe("assets/image.png");
  });
});
