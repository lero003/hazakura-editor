import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closePdfReference,
  getReferenceFileMetadata,
  openImageFile,
  openPdfReference,
  openTextFile,
  pickReferenceFile,
} from "../../lib/tauri";
import {
  __resetPdfOpenQueueForTests,
  useReferenceCompareActions,
} from "./useReferenceCompareActions";
import type { EditorTab } from "../../types";

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    openTextFile: vi.fn(),
    openImageFile: vi.fn(),
    openWorkspaceImage: vi.fn(),
    openPdfReference: vi.fn(),
    closePdfReference: vi.fn().mockResolvedValue(undefined),
    getReferenceFileMetadata: vi.fn().mockResolvedValue({
      path: "/ws/x",
      size: 1,
      modified_ms: 1,
      fingerprint: "fp-meta",
      large_file_warning: false,
    }),
    pickReferenceFile: vi.fn(),
    pickMarkdownFile: vi.fn(),
    createSecurityScopedBookmark: vi.fn().mockResolvedValue(null),
  };
});

function makeTab(path: string): EditorTab {
  return {
    id: path,
    sessionId: "sess-1",
    path,
    name: "a.md",
    contents: "buffer",
    lastSavedContents: "disk",
    lastSavedLineEnding: "lf",
    lastSavedEncoding: "utf-8",
    line_ending: "lf",
    encoding: "utf-8",
    size: 10,
    modified_ms: null,
    fingerprint: "fp",
    large_file_warning: false,
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
  };
}

const baseOptions = () => ({
  activeTab: makeTab("/ws/draft.md") as EditorTab,
  clearReferenceCompare: vi.fn(),
  menuLanguage: "ja" as const,
  referenceCompare: null,
  requestReviewTabAgainstDisk: vi.fn(),
  setGlobalError: vi.fn(),
  setReferenceDocument: vi.fn(),
  setReferenceFollowMode: vi.fn(),
  setStatus: vi.fn(),
  workspaceRootPath: "/ws" as string | null,
});

describe("useReferenceCompareActions", () => {
  beforeEach(() => {
    __resetPdfOpenQueueForTests();
    vi.mocked(openTextFile).mockReset();
    vi.mocked(openImageFile).mockReset();
    vi.mocked(openPdfReference).mockReset();
    vi.mocked(closePdfReference).mockReset().mockResolvedValue(undefined);
    vi.mocked(getReferenceFileMetadata).mockReset().mockResolvedValue({
      path: "/ws/x",
      size: 1,
      modified_ms: 1,
      fingerprint: "fp-meta",
      large_file_warning: false,
    });
    vi.mocked(pickReferenceFile).mockReset();
  });

  it("opens a text file as a manual reference", async () => {
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/ws/style.md",
      name: "style.md",
      contents: "# style\n",
      line_ending: "lf",
      encoding: "utf-8",
      size: 8,
      modified_ms: null,
      fingerprint: "fp",
      large_file_warning: false,
    });

    const setReferenceDocument = vi.fn();
    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/ws/style.md");
    });

    expect(setReferenceDocument).toHaveBeenCalledWith(
      {
        kind: "text",
        path: "/ws/style.md",
        name: "style.md",
        contents: "# style\n",
        encoding: "utf-8",
      },
      {
        origin: "manual",
        linkedEditorSessionId: null,
        followMode: "off",
        sourceFingerprint: "fp",
      },
    );
  });

  it("opens a PDF via the opaque reference handle", async () => {
    vi.mocked(openPdfReference).mockResolvedValueOnce({
      referenceId: "pdf-ref-1",
      pageCount: 3,
      name: "scan.pdf",
    });
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/ws/scan.pdf");
    });

    expect(openPdfReference).toHaveBeenCalledWith("/ws/scan.pdf");
    expect(setReferenceDocument).toHaveBeenCalledWith(
      {
        kind: "pdf",
        path: "/ws/scan.pdf",
        name: "scan.pdf",
        pageCount: 3,
        referenceId: "pdf-ref-1",
      },
      expect.objectContaining({
        origin: "manual",
        linkedEditorSessionId: null,
        sourceFingerprint: "fp-meta",
      }),
    );
  });

  it("opens an image as a reference without switching editor tab", async () => {
    vi.mocked(openImageFile).mockResolvedValueOnce({
      path: "/tmp/cover.png",
      name: "cover.png",
      dataUrl: "data:image/png;base64,aaa",
      size: 12,
    });
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        workspaceRootPath: null,
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/tmp/cover.png");
    });

    expect(setReferenceDocument).toHaveBeenCalledWith(
      {
        kind: "image",
        path: "/tmp/cover.png",
        name: "cover.png",
        url: "data:image/png;base64,aaa",
        size: 12,
      },
      expect.objectContaining({
        origin: "manual",
        linkedEditorSessionId: null,
        sourceFingerprint: "fp-meta",
      }),
    );
  });

  it("routes same-file open to buffer-vs-disk review", async () => {
    const requestReviewTabAgainstDisk = vi.fn();
    const setReferenceDocument = vi.fn();
    const tab = makeTab("/ws/a.md");

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        activeTab: tab,
        requestReviewTabAgainstDisk,
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/ws/a.md");
    });

    expect(requestReviewTabAgainstDisk).toHaveBeenCalledWith(tab);
    expect(setReferenceDocument).not.toHaveBeenCalled();
    expect(openTextFile).not.toHaveBeenCalled();
  });

  it("releases the PDF handle when closing a PDF reference", async () => {
    const clearReferenceCompare = vi.fn();
    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        clearReferenceCompare,
        referenceCompare: {
          reference: {
            kind: "pdf",
            path: "/ws/a.pdf",
            name: "a.pdf",
            pageCount: 2,
            referenceId: "pdf-ref-9",
          },
          origin: "manual",
          linkedEditorSessionId: null,
          followMode: "off",
          sourceFingerprint: "fp",
          externalChangePending: false,
        },
      }),
    );

    await act(async () => {
      result.current.closeReferenceCompare();
      await Promise.resolve();
    });

    expect(closePdfReference).toHaveBeenCalledWith("pdf-ref-9");
    expect(clearReferenceCompare).toHaveBeenCalled();
  });

  it("rejects unsupported types", async () => {
    const setGlobalError = vi.fn();
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        setGlobalError,
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/ws/a.docx");
    });

    expect(setReferenceDocument).not.toHaveBeenCalled();
    expect(String(setGlobalError.mock.calls.at(-1)?.[0])).toContain("参照");
  });

  it("pairs an import source PDF with the draft sessionId", async () => {
    vi.mocked(openPdfReference).mockResolvedValueOnce({
      referenceId: "pdf-ref-pair",
      pageCount: 4,
      name: "scan.pdf",
    });
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.pairImportAssistReference(
        "/ws/scan.pdf",
        "sess-import-1",
      );
    });

    expect(setReferenceDocument).toHaveBeenCalledWith(
      {
        kind: "pdf",
        path: "/ws/scan.pdf",
        name: "scan.pdf",
        pageCount: 4,
        referenceId: "pdf-ref-pair",
      },
      expect.objectContaining({
        origin: "import-assist",
        linkedEditorSessionId: "sess-import-1",
        followMode: "following",
      }),
    );
  });

  it("opens a picker path as reference", async () => {
    vi.mocked(pickReferenceFile).mockResolvedValueOnce("/tmp/note.md");
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/tmp/note.md",
      name: "note.md",
      contents: "n",
      line_ending: "lf",
      encoding: "utf-8",
      size: 1,
      modified_ms: null,
      fingerprint: "fp",
      large_file_warning: false,
    });
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        activeTab: null,
        menuLanguage: "en",
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openReferenceFile();
    });

    expect(pickReferenceFile).toHaveBeenCalled();
    expect(setReferenceDocument).toHaveBeenCalled();
  });

  it("does not close the previous PDF handle when a replace open fails", async () => {
    vi.mocked(openPdfReference).mockRejectedValueOnce(new Error("open failed"));
    const setReferenceDocument = vi.fn();
    const previous = {
      reference: {
        kind: "pdf" as const,
        path: "/ws/old.pdf",
        name: "old.pdf",
        pageCount: 2,
        referenceId: "pdf-ref-old",
      },
      origin: "manual" as const,
      linkedEditorSessionId: null,
      followMode: "off" as const,
      sourceFingerprint: "fp-old",
      externalChangePending: false,
    };

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        referenceCompare: previous,
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/ws/new.pdf");
    });

    expect(closePdfReference).not.toHaveBeenCalled();
    expect(setReferenceDocument).not.toHaveBeenCalled();
  });

  it("releases the previous PDF handle only after a successful image replace", async () => {
    vi.mocked(openImageFile).mockResolvedValueOnce({
      path: "/tmp/cover.png",
      name: "cover.png",
      dataUrl: "data:image/png;base64,aaa",
      size: 12,
    });
    const setReferenceDocument = vi.fn();
    const previous = {
      reference: {
        kind: "pdf" as const,
        path: "/ws/old.pdf",
        name: "old.pdf",
        pageCount: 2,
        referenceId: "pdf-ref-old",
      },
      origin: "manual" as const,
      linkedEditorSessionId: null,
      followMode: "off" as const,
      sourceFingerprint: "fp-old",
      externalChangePending: false,
    };

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        referenceCompare: previous,
        workspaceRootPath: null,
        setReferenceDocument,
      }),
    );

    await act(async () => {
      await result.current.openPathAsReference("/tmp/cover.png");
    });

    expect(openImageFile).toHaveBeenCalled();
    expect(closePdfReference).toHaveBeenCalledWith("pdf-ref-old");
    expect(setReferenceDocument).toHaveBeenCalled();
  });

  it("serializes concurrent PDF opens so a slower first open cannot replace a later one", async () => {
    let resolveFirst: ((value: {
      referenceId: string;
      pageCount: number;
      name: string;
    }) => void) | undefined;
    const firstOpen = new Promise<{
      referenceId: string;
      pageCount: number;
      name: string;
    }>((resolve) => {
      resolveFirst = resolve;
    });

    let openCalls = 0;
    vi.mocked(openPdfReference).mockImplementation(async (path: string) => {
      openCalls += 1;
      if (path.endsWith("a.pdf")) {
        return firstOpen;
      }
      return {
        referenceId: "pdf-ref-b",
        pageCount: 1,
        name: "b.pdf",
      };
    });

    const setReferenceDocument = vi.fn();
    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        setReferenceDocument,
      }),
    );

    const pFirst = result.current.openPathAsReference("/ws/a.pdf");
    // Let the first open enter the PDF queue and start native open.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(openCalls).toBe(1);

    const pSecond = result.current.openPathAsReference("/ws/b.pdf");
    // Second open must wait behind the first native call (no reverse-order ACTIVE).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(openCalls).toBe(1);

    resolveFirst?.({
      referenceId: "pdf-ref-a",
      pageCount: 2,
      name: "a.pdf",
    });

    await act(async () => {
      await pFirst;
      await pSecond;
    });

    expect(openCalls).toBe(2);
    // First open was superseded after B bumped generation: close the late A handle.
    expect(closePdfReference).toHaveBeenCalledWith("pdf-ref-a");
    // Only the later open commits UI state.
    expect(setReferenceDocument).toHaveBeenCalledTimes(1);
    expect(setReferenceDocument.mock.calls[0][0]).toMatchObject({
      kind: "pdf",
      path: "/ws/b.pdf",
      referenceId: "pdf-ref-b",
    });

    // Restore default mock so later cases are not poisoned by this implementation.
    vi.mocked(openPdfReference).mockReset();
    vi.mocked(openPdfReference).mockResolvedValue({
      referenceId: "pdf-ref-default",
      pageCount: 1,
      name: "default.pdf",
    });
  });

  it("clears reference state immediately so late PDF close cannot wipe a new open", async () => {
    let resolveClose: (() => void) | undefined;
    vi.mocked(closePdfReference).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    const clearReferenceCompare = vi.fn();
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        ...baseOptions(),
        clearReferenceCompare,
        setReferenceDocument,
        referenceCompare: {
          reference: {
            kind: "pdf",
            path: "/ws/old.pdf",
            name: "old.pdf",
            pageCount: 2,
            referenceId: "pdf-ref-old",
          },
          origin: "manual",
          linkedEditorSessionId: null,
          followMode: "off",
          sourceFingerprint: "fp-old",
          externalChangePending: false,
        },
      }),
    );

    act(() => {
      result.current.closeReferenceCompare();
    });
    expect(clearReferenceCompare).toHaveBeenCalledTimes(1);

    vi.mocked(openPdfReference).mockResolvedValueOnce({
      referenceId: "pdf-ref-new",
      pageCount: 1,
      name: "new.pdf",
    });
    await act(async () => {
      await result.current.openPathAsReference("/ws/new.pdf");
    });
    expect(setReferenceDocument).toHaveBeenCalled();

    await act(async () => {
      resolveClose?.();
      await Promise.resolve();
    });
    // Late close completion must not clear again.
    expect(clearReferenceCompare).toHaveBeenCalledTimes(1);
  });

  it("pauses and resumes import page follow only when linked", async () => {
    const setReferenceFollowMode = vi.fn();
    const followingState = {
      reference: {
        kind: "pdf" as const,
        path: "/ws/a.pdf",
        name: "a.pdf",
        pageCount: 2,
        referenceId: "pdf-ref-9",
      },
      origin: "import-assist" as const,
      linkedEditorSessionId: "sess-1",
      followMode: "following" as const,
      sourceFingerprint: "fp",
      externalChangePending: false,
    };

    const followingOpts = {
      ...baseOptions(),
      setReferenceFollowMode,
      referenceCompare: followingState,
    };
    const { result } = renderHook(() =>
      useReferenceCompareActions(followingOpts),
    );

    act(() => {
      result.current.pauseReferenceFollow();
    });
    expect(setReferenceFollowMode).toHaveBeenCalledWith("paused");

    setReferenceFollowMode.mockClear();
    const pausedOpts = {
      ...baseOptions(),
      setReferenceFollowMode,
      referenceCompare: {
        ...followingState,
        followMode: "paused" as const,
      },
    };
    const resumed = renderHook(() => useReferenceCompareActions(pausedOpts));
    act(() => {
      resumed.result.current.resumeReferenceFollow();
    });
    expect(setReferenceFollowMode).toHaveBeenCalledWith("following");
  });
});
