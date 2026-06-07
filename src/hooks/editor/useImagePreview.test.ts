import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openWorkspaceImage } from "../../lib/tauri";
import type { ImagePreviewDocument } from "../../lib/tauri";
import { useImagePreview } from "./useImagePreview";

vi.mock("../../lib/tauri", () => ({
  openWorkspaceImage: vi.fn(),
}));

function image(path: string, name: string): ImagePreviewDocument {
  return {
    dataUrl: `data:image/png;base64,${name}`,
    name,
    path,
    size: 128,
  };
}

function setup() {
  const options: Parameters<typeof useImagePreview>[0] = {
    activeTabId: "tab-1",
    onError: vi.fn(),
    onStatus: vi.fn(),
    setActiveTabId: vi.fn(),
    setCompareView: vi.fn(),
    tabs: [
      {
        contents: "# note",
        encoding: "utf-8",
        error: null,
        externalFingerprint: null,
        fingerprint: "fingerprint",
        id: "tab-1",
        ignoredExternalFingerprint: null,
        large_file_warning: false,
        lastSavedContents: "# note",
        lastSavedEncoding: "utf-8",
        lastSavedLineEnding: "lf",
        line_ending: "lf",
        modified_ms: null,
        name: "note.md",
        path: "/workspace/note.md",
        saveStatus: "idle",
        size: 6,
      },
    ],
    workspaceRootPath: "/workspace",
  };

  return {
    options,
    result: renderHook(() => useImagePreview(options)).result,
  };
}

describe("useImagePreview", () => {
  beforeEach(() => {
    vi.mocked(openWorkspaceImage).mockReset();
  });

  it("keeps the latest image preview when an older request resolves last", async () => {
    let resolveFirst: (value: ImagePreviewDocument) => void = () => {};
    let resolveSecond: (value: ImagePreviewDocument) => void = () => {};
    vi.mocked(openWorkspaceImage)
      .mockImplementationOnce(
        () =>
          new Promise<ImagePreviewDocument>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<ImagePreviewDocument>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result } = setup();
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();

    act(() => {
      first = result.current.openImagePreview("/workspace/a.png");
      second = result.current.openImagePreview("/workspace/b.png");
    });

    await act(async () => {
      resolveSecond(image("/workspace/b.png", "b.png"));
      await second;
    });
    expect(result.current.selectedImage?.path).toBe("/workspace/b.png");

    await act(async () => {
      resolveFirst(image("/workspace/a.png", "a.png"));
      await first;
    });
    expect(result.current.selectedImage?.path).toBe("/workspace/b.png");
  });

  it("does not reopen an image preview after the preview was cleared", async () => {
    let resolvePreview: (value: ImagePreviewDocument) => void = () => {};
    vi.mocked(openWorkspaceImage).mockImplementation(
      () =>
        new Promise<ImagePreviewDocument>((resolve) => {
          resolvePreview = resolve;
        }),
    );

    const { options, result } = setup();
    let inFlight: Promise<unknown> = Promise.resolve();
    act(() => {
      inFlight = result.current.openImagePreview("/workspace/a.png");
    });
    act(() => {
      result.current.clearImagePreview();
    });

    await act(async () => {
      resolvePreview(image("/workspace/a.png", "a.png"));
      await inFlight;
    });

    expect(result.current.selectedImage).toBeNull();
    expect(options.setActiveTabId).not.toHaveBeenCalledWith(null);
    expect(options.onStatus).not.toHaveBeenCalledWith("Image preview opened");
  });
});
