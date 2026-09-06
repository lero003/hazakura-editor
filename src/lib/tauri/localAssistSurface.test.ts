import { afterEach, describe, expect, it, vi } from "vitest";
import { openAppleAssistWindow, toggleAppleAssistWindow } from "./localAssistSurface";
import { registerLocalAssistSurface } from "../appleAssist/sidebarBridge";
import { openAppleAssistWindow as detachedOpen, toggleAppleAssistWindow as detachedToggle } from "./agent";
vi.mock("./agent", () => ({ openAppleAssistWindow: vi.fn(async () => {}), toggleAppleAssistWindow: vi.fn(async () => {}) }));
afterEach(() => { vi.clearAllMocks(); });
describe("Local Assist entry routing", () => {
  it("routes existing main-window entry points to the registered sidebar", async () => {
    const open = vi.fn(); const unregister = registerLocalAssistSurface(open);
    try {
      await openAppleAssistWindow("dark"); await toggleAppleAssistWindow("dark");
      expect(open.mock.calls).toEqual([["open"], ["toggle"]]);
      expect(detachedOpen).not.toHaveBeenCalled(); expect(detachedToggle).not.toHaveBeenCalled();
    } finally { unregister(); }
  });
  it("preserves native callers when no main sidebar is registered", async () => {
    await openAppleAssistWindow("dark"); await toggleAppleAssistWindow("light");
    expect(detachedOpen).toHaveBeenCalledWith("dark"); expect(detachedToggle).toHaveBeenCalledWith("light");
  });
});
