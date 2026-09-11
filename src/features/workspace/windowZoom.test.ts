import { afterEach, describe, expect, it, vi } from "vitest";
import { toggleWindowZoom } from "./windowZoom";

const { toggleMaximize } = vi.hoisted(() => ({
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ toggleMaximize }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("toggleWindowZoom", () => {
  it("asks the native window to zoom without going full screen", () => {
    toggleWindowZoom();
    expect(toggleMaximize).toHaveBeenCalledTimes(1);
  });

  it("stays silent where no native window exists", async () => {
    toggleMaximize.mockRejectedValueOnce(new Error("no native window"));
    expect(() => toggleWindowZoom()).not.toThrow();
    await Promise.resolve();
  });
});
