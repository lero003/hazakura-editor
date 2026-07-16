import { describe, expect, it } from "vitest";
import {
  isPathUnderApprovedRoots,
  mergeApprovedRoot,
  parentDirectoryOfPath,
  parseMediaImageSettings,
} from "./mediaImageSettings";

describe("mediaImageSettings", () => {
  it("defaults remote off and outside ask", () => {
    const settings = parseMediaImageSettings({});
    expect(settings.loadRemoteImages).toBe(false);
    expect(settings.outsideImages).toBe("ask");
    expect(settings.materializeImagesOnExport).toBe(true);
  });

  it("approves parent folder coverage for nested assets", () => {
    const roots = mergeApprovedRoot([], parentDirectoryOfPath("/project/assets/cover.jpg"));
    expect(roots).toEqual(["/project/assets"]);
    expect(isPathUnderApprovedRoots("/project/assets/cover.jpg", roots)).toBe(
      true,
    );
    expect(isPathUnderApprovedRoots("/project/assets/other.png", roots)).toBe(
      true,
    );
    expect(isPathUnderApprovedRoots("/project/secret.png", roots)).toBe(false);
  });

  it("widens a child approval when a parent root is added", () => {
    const roots = mergeApprovedRoot(
      ["/project/assets/sub"],
      "/project/assets",
    );
    expect(roots).toEqual(["/project/assets"]);
  });
});
