import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { savePastedImage } from "../../lib/tauri";
import { usePastedImageAction } from "./usePastedImageAction";

vi.mock("../../lib/tauri", () => ({
  savePastedImage: vi.fn(),
}));

describe("usePastedImageAction", () => {
  it("returns an image path relative to a nested active document", async () => {
    vi.mocked(savePastedImage).mockResolvedValueOnce("assets/image.png");
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      usePastedImageAction({
        activeTabPath: "/workspace/books/draft.md",
        setStatus,
        workspaceRootPath: "/workspace",
      }),
    );

    let pastedPath: string | null = null;
    await act(async () => {
      pastedPath = await result.current.handlePasteImage("base64", "pasted.png");
    });

    expect(pastedPath).toBe("../assets/image.png");
    expect(setStatus).toHaveBeenLastCalledWith(
      "Image saved: ../assets/image.png",
    );
  });

  it("keeps the pasted image failure reason in the status message", async () => {
    vi.mocked(savePastedImage).mockRejectedValueOnce(
      new Error("Pasted image is larger than the image limit of 20 MB."),
    );
    const setStatus = vi.fn();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() =>
      usePastedImageAction({
        activeTabPath: null,
        setStatus,
        workspaceRootPath: "/workspace",
      }),
    );

    let pastedPath: string | null = "not-called";
    await act(async () => {
      pastedPath = await result.current.handlePasteImage("base64", "pasted.png");
    });

    expect(pastedPath).toBeNull();
    expect(setStatus).toHaveBeenLastCalledWith(
      "Image paste failed: Pasted image is larger than the image limit of 20 MB.",
    );

    consoleWarn.mockRestore();
  });
});
