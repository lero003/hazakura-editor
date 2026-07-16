import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePinExternalImagesAction } from "./usePinExternalImagesAction";
import {
  confirmPinRemoteImages,
  fetchRemoteImage,
  importImageFromPath,
  savePastedImage,
} from "../../lib/tauri";
import type { EditorTab } from "../../types";

vi.mock("../../lib/tauri", () => ({
  confirmPinRemoteImages: vi.fn(),
  fetchRemoteImage: vi.fn(),
  importImageFromPath: vi.fn(),
  savePastedImage: vi.fn(),
}));

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "![cover](../assets/cover.png)\n",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fp",
    id: "/ws/book/chapter.md",
    sessionId: "s1",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "![cover](../assets/cover.png)\n",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "chapter.md",
    path: "/ws/book/chapter.md",
    saveStatus: "idle",
    size: 10,
    ...overrides,
  };
}

describe("usePinExternalImagesAction", () => {
  beforeEach(() => {
    vi.mocked(importImageFromPath).mockReset();
    vi.mocked(fetchRemoteImage).mockReset();
    vi.mocked(savePastedImage).mockReset();
    vi.mocked(confirmPinRemoteImages).mockReset();
    vi.mocked(confirmPinRemoteImages).mockResolvedValue(true);
  });

  it("refuses without workspace", async () => {
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      usePinExternalImagesAction({
        activeTab: makeTab(),
        editorPaneRef: { current: null },
        setStatus,
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.pinExternalImages();
    });

    expect(setStatus).toHaveBeenCalledWith(
      expect.stringContaining("workspace"),
    );
    expect(importImageFromPath).not.toHaveBeenCalled();
  });

  it("imports outside-local images and rewrites via one editor transaction", async () => {
    vi.mocked(importImageFromPath).mockResolvedValue("assets/abcdef01.png");
    const replaceDocumentContents = vi.fn(() => true);
    const setStatus = vi.fn();
    const tab = makeTab();
    const { result } = renderHook(() =>
      usePinExternalImagesAction({
        activeTab: tab,
        editorPaneRef: {
          current: {
            getActiveDocument: () => ({
              text: tab.contents,
              from: 0,
              to: 0,
            }),
            replaceDocumentContents,
          } as never,
        },
        mediaAccess: {
          outsideImages: "ask",
          loadRemoteImages: false,
          approvedRoots: [],
        },
        setStatus,
        workspaceRootPath: "/ws/book",
      }),
    );

    await act(async () => {
      await result.current.pinExternalImages();
    });

    expect(importImageFromPath).toHaveBeenCalledWith(
      "/ws/book",
      "/ws/assets/cover.png",
    );
    expect(replaceDocumentContents).toHaveBeenCalledWith(
      "![cover](assets/abcdef01.png)\n",
    );
    expect(setStatus).toHaveBeenLastCalledWith(
      expect.stringMatching(/Pinned 1 image/),
    );
    expect(setStatus).toHaveBeenLastCalledWith(
      expect.stringContaining("save to keep"),
    );
  });

  it("does not fetch remote images when the explicit network confirmation is declined", async () => {
    vi.mocked(confirmPinRemoteImages).mockResolvedValueOnce(false);
    const setStatus = vi.fn();
    const tab = makeTab({ contents: "![remote](https://example.com/cover.png)\n" });
    const { result } = renderHook(() =>
      usePinExternalImagesAction({
        activeTab: tab,
        editorPaneRef: {
          current: {
            getActiveDocument: () => ({ text: tab.contents, from: 0, to: 0 }),
            replaceDocumentContents: vi.fn(() => true),
          } as never,
        },
        mediaAccess: { loadRemoteImages: false },
        setStatus,
        workspaceRootPath: "/ws/book",
      }),
    );

    await act(async () => {
      await result.current.pinExternalImages();
    });

    expect(confirmPinRemoteImages).toHaveBeenCalledTimes(1);
    expect(fetchRemoteImage).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith("Image pin cancelled");
  });
});
