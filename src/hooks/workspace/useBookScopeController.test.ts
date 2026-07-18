import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBookScopeController } from "./useBookScopeController";

const mocks = vi.hoisted(() => ({
  cancelOkfBundleScan: vi.fn(),
  resolveBookScope: vi.fn(),
  scanOkfBundle: vi.fn(),
}));

vi.mock("../../lib/tauri/bookScope", () => ({
  resolveBookScope: mocks.resolveBookScope,
}));

vi.mock("../../lib/tauri/okf", () => ({
  cancelOkfBundleScan: mocks.cancelOkfBundleScan,
  scanOkfBundle: mocks.scanOkfBundle,
}));

function makeDiscovery() {
  return {
    bundleRoot: "/workspace",
    files: [
      {
        path: "/workspace/index.md",
        relativePath: "index.md",
        content: "[Chapter](chapter.md)",
        byteLength: 21,
        unreadableReason: null,
      },
      {
        path: "/workspace/chapter.md",
        relativePath: "chapter.md",
        content: "# Chapter\n",
        byteLength: 10,
        unreadableReason: null,
      },
    ],
    scannedEntries: 2,
    scannedMarkdownFiles: 2,
    totalBytesRead: 31,
    truncated: false,
    truncationReason: null,
    cancelled: false,
    source: "disk" as const,
  };
}

describe("useBookScopeController suggestions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.cancelOkfBundleScan.mockReset().mockResolvedValue(true);
    mocks.resolveBookScope.mockReset().mockResolvedValue({
      chapters: [],
      unavailable: [],
    });
    mocks.scanOkfBundle.mockReset().mockResolvedValue(makeDiscovery());
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("uses an explicit workspace-root OKF snapshot without persisting the draft", async () => {
    const setStatus = vi.fn();
    const setGlobalError = vi.fn();
    const { result } = renderHook(() =>
      useBookScopeController({
        menuLanguage: "ja",
        setGlobalError,
        setStatus,
        workspaceRootPath: "/workspace",
      }),
    );

    let suggestion = null;
    await act(async () => {
      suggestion = await result.current.createBookScopeSuggestion({
        includeIndexPages: true,
      });
    });

    expect(mocks.scanOkfBundle).toHaveBeenCalledWith(
      "/workspace",
      "/workspace",
    );
    expect(suggestion).toMatchObject({
      chapterRelativePaths: ["index.md", "chapter.md"],
      includedIndexPageCount: 1,
      nodes: [
        {
          kind: "document",
          relativePath: "index.md",
          children: [
            {
              kind: "document",
              relativePath: "chapter.md",
              children: [],
            },
          ],
        },
      ],
    });
    expect(result.current.bookScopeChapterRelativePaths).toEqual([]);
    expect(setStatus).toHaveBeenLastCalledWith("本の候補を作りました: 2件");
  });

  it("invalidates a pending suggestion when the workspace changes", async () => {
    const setGlobalError = vi.fn();
    const setStatus = vi.fn();
    let resolveScan!: (value: ReturnType<typeof makeDiscovery>) => void;
    mocks.scanOkfBundle.mockReturnValue(
      new Promise((resolve) => {
        resolveScan = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ root }) =>
        useBookScopeController({
          menuLanguage: "en",
          setGlobalError,
          setStatus,
          workspaceRootPath: root,
        }),
      { initialProps: { root: "/workspace" } },
    );

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.createBookScopeSuggestion({
        includeIndexPages: true,
      });
    });
    await waitFor(() => expect(result.current.bookScopeSuggesting).toBe(true));
    rerender({ root: "/other" });
    await waitFor(() => expect(result.current.bookScopeSuggesting).toBe(false));
    resolveScan(makeDiscovery());

    await expect(pending!).resolves.toBeNull();
  });

  it("forwards an explicit stop request to the shared bounded scanner", () => {
    const setGlobalError = vi.fn();
    const setStatus = vi.fn();
    const { result } = renderHook(() =>
      useBookScopeController({
        menuLanguage: "en",
        setGlobalError,
        setStatus,
        workspaceRootPath: "/workspace",
      }),
    );

    act(() => result.current.cancelBookScopeSuggestion());
    expect(mocks.cancelOkfBundleScan).toHaveBeenCalledOnce();
  });
});
