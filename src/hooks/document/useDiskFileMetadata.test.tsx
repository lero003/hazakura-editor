import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFileMetadata } from "../../lib/tauri/files";
import { useDiskFileMetadata } from "./useDiskFileMetadata";

vi.mock("../../lib/tauri/files", () => ({ getFileMetadata: vi.fn() }));

const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };

function metadata(size: number, modified_ms: number | null) {
  return {
    path: "/workspace/note.md",
    size,
    modified_ms,
    fingerprint: "fp",
    large_file_warning: false,
  };
}

describe("useDiskFileMetadata", () => {
  beforeEach(() => {
    vi.mocked(getFileMetadata).mockReset();
    runtimeWindow.__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    delete runtimeWindow.__TAURI_INTERNALS__;
  });

  it("does not read anything for a pathless tab", () => {
    const { result } = renderHook(() => useDiskFileMetadata(""));

    expect(result.current).toBeNull();
    expect(getFileMetadata).not.toHaveBeenCalled();
  });

  it("does not read anything outside the app runtime", () => {
    delete runtimeWindow.__TAURI_INTERNALS__;

    const { result } = renderHook(() => useDiskFileMetadata("/workspace/note.md"));

    expect(result.current).toBeNull();
    expect(getFileMetadata).not.toHaveBeenCalled();
  });

  it("exposes only the real size and modified time", async () => {
    vi.mocked(getFileMetadata).mockResolvedValue(metadata(2048, 1_760_000_000_000));

    const { result } = renderHook(() => useDiskFileMetadata("/workspace/note.md"));

    await waitFor(() =>
      expect(result.current).toEqual({ size: 2048, modifiedMs: 1_760_000_000_000 }),
    );
  });

  it("shows no numbers when the disk read fails", async () => {
    vi.mocked(getFileMetadata).mockRejectedValue(new Error("unreadable"));

    const { result } = renderHook(() => useDiskFileMetadata("/workspace/note.md"));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });

  it("ignores a late answer for the previous path", async () => {
    let resolveFirst: (value: ReturnType<typeof metadata>) => void = () => {};
    vi.mocked(getFileMetadata)
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; }),
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    const { result, rerender } = renderHook(
      ({ path }) => useDiskFileMetadata(path),
      { initialProps: { path: "/workspace/a.md" } },
    );
    rerender({ path: "/workspace/b.md" });

    resolveFirst(metadata(4096, 1_700_000_000_000));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current).toBeNull();
  });
});
