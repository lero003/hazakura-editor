import { describe, expect, it } from "vitest";
import { splitDroppedPaths } from "./useWindowDragDrop";

describe("splitDroppedPaths", () => {
  it("treats source files and extensionless files as text-open candidates", () => {
    const result = splitDroppedPaths([
      "/workspace/src/app.ts",
      "/workspace/Makefile",
      "/workspace/README.md",
      "/workspace/docs/diagram.png",
    ]);

    expect(result.textFiles).toEqual([
      "/workspace/src/app.ts",
      "/workspace/Makefile",
      "/workspace/README.md",
    ]);
    expect(result.imageFiles).toEqual(["/workspace/docs/diagram.png"]);
  });
});
