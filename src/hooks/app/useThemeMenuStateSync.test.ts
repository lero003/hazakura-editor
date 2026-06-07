import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateThemeMenuState } from "../../lib/tauri";
import { useThemeMenuStateSync } from "./useThemeMenuStateSync";

vi.mock("../../lib/tauri", () => ({
  updateThemeMenuState: vi.fn(),
}));

describe("useThemeMenuStateSync", () => {
  beforeEach(() => {
    vi.mocked(updateThemeMenuState).mockReset();
  });

  it("surfaces theme menu sync failures through the status channel", async () => {
    vi.mocked(updateThemeMenuState).mockRejectedValue(new Error("ipc failed"));
    const onStatus = vi.fn();

    renderHook(() => useThemeMenuStateSync("yakou", { onStatus }));

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(
        "Failed to update theme menu state",
      );
    });
  });
});
