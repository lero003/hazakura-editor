import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCurrentWindowTitle } from "../../lib/tauri";
import { useWindowTitle } from "./useWindowTitle";

vi.mock("../../lib/tauri", () => ({
  setCurrentWindowTitle: vi.fn(),
}));

describe("useWindowTitle", () => {
  beforeEach(() => {
    vi.mocked(setCurrentWindowTitle).mockReset();
    vi.mocked(setCurrentWindowTitle).mockResolvedValue(undefined);
  });

  it("does not re-send the window title when only the tab buffer changes", async () => {
    const initial = renderHook(
      ({ name }: { name: string }) =>
        useWindowTitle({
          activeDirty: true,
          // A fresh tab object on every render, exactly like a live editor
          // update while typing.
          activeTab: { name },
          selectedImage: null,
        }),
      { initialProps: { name: "note.md" } },
    );

    await waitFor(() => {
      expect(setCurrentWindowTitle).toHaveBeenCalledTimes(1);
    });
    expect(setCurrentWindowTitle).toHaveBeenLastCalledWith(
      expect.stringContaining("note.md"),
    );

    // Live editing replaces the tab object on every character. The title
    // text is unchanged, so the native window (and the macOS menu bar that
    // mirrors window state) must not be touched again.
    initial.rerender({ name: "note.md" });
    expect(setCurrentWindowTitle).toHaveBeenCalledTimes(1);

    // A real title change still goes through.
    initial.rerender({ name: "renamed.md" });
    await waitFor(() => {
      expect(setCurrentWindowTitle).toHaveBeenCalledTimes(2);
    });
  });

  it("re-sends the title when the dirty marker changes", async () => {
    const initial = renderHook(
      ({ activeDirty }: { activeDirty: boolean }) =>
        useWindowTitle({
          activeDirty,
          activeTab: { name: "note.md" },
          selectedImage: null,
        }),
      { initialProps: { activeDirty: false } },
    );

    await waitFor(() => {
      expect(setCurrentWindowTitle).toHaveBeenCalledTimes(1);
    });
    expect(setCurrentWindowTitle).toHaveBeenLastCalledWith(
      expect.stringMatching(/^note\.md - Hazakura Editor/),
    );

    initial.rerender({ activeDirty: true });
    await waitFor(() => {
      expect(setCurrentWindowTitle).toHaveBeenCalledTimes(2);
    });
    expect(setCurrentWindowTitle).toHaveBeenLastCalledWith(
      expect.stringMatching(/^note\.md \* - Hazakura Editor/),
    );
  });

  it("ignores background tab changes while an image preview owns the title", async () => {
    const initial = renderHook(
      ({ activeDirty }: { activeDirty: boolean }) =>
        useWindowTitle({
          activeDirty,
          activeTab: { name: "note.md" },
          selectedImage: { name: "photo.png" },
        }),
      { initialProps: { activeDirty: false } },
    );

    await waitFor(() => {
      expect(setCurrentWindowTitle).toHaveBeenCalledTimes(1);
    });
    expect(setCurrentWindowTitle).toHaveBeenLastCalledWith(
      expect.stringMatching(/^photo\.png - Hazakura Editor/),
    );

    // The image name is what the title shows, so a dirty flag moving on the
    // document behind it must not send the same title again.
    initial.rerender({ activeDirty: true });
    expect(setCurrentWindowTitle).toHaveBeenCalledTimes(1);
  });
});
