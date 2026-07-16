import { describe, expect, it } from "vitest";
import {
  listPinableImageReferences,
  rewriteImageSources,
} from "./pinExternalImages";

describe("pinExternalImages", () => {
  it("lists markdown image refs without data URLs", () => {
    const refs = listPinableImageReferences(
      [
        "![a](../assets/cover.png)",
        "![b](https://example.com/x.png)",
        "![c](data:image/png;base64,aa)",
      ].join("\n"),
    );
    expect(refs).toHaveLength(2);
    expect(refs[0]?.src).toBe("../assets/cover.png");
    expect(refs[1]?.kind).toBe("remote");
  });

  it("rewrites matching sources in one pass", () => {
    const source = "See ![cover](../assets/cover.png) and ![cover](../assets/cover.png).";
    const map = new Map([["../assets/cover.png", "assets/cover.png"]]);
    expect(rewriteImageSources(source, map)).toBe(
      "See ![cover](assets/cover.png) and ![cover](assets/cover.png).",
    );
  });
});
