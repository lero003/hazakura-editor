import { describe, expect, it } from "vitest";
import {
  COMPACT_SIDEBAR_MAX_WIDTH,
  nextSidebarOverride,
  releasedSidebarOverride,
  resolveSidebarCollapsed,
} from "./compactSidebar";

describe("compactSidebar", () => {
  it("folds only as a default while the window is narrow", () => {
    expect(resolveSidebarCollapsed(null, true)).toBe(true);
    expect(resolveSidebarCollapsed(null, false)).toBe(false);
  });

  it("lets an explicit choice win over the width default", () => {
    expect(resolveSidebarCollapsed(false, true)).toBe(false);
    expect(resolveSidebarCollapsed(true, false)).toBe(true);
  });

  it("toggles against what is currently visible", () => {
    expect(nextSidebarOverride(null, true)).toBe(false);
    expect(nextSidebarOverride(null, false)).toBe(true);
    expect(nextSidebarOverride(false, true)).toBe(true);
  });

  it("keeps the fold threshold on the existing narrow breakpoint", () => {
    expect(COMPACT_SIDEBAR_MAX_WIDTH).toBe(1100);
  });

  it("returns to the width default when the explicit choice is released", () => {
    expect(releasedSidebarOverride()).toBeNull();
  });
});
