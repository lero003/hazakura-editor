import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closePdfReference,
  openImageFile,
  openPdfReference,
  openTextFile,
  pickReferenceFile,
} from "../../lib/tauri";
import { useReferenceCompareActions } from "./useReferenceCompareActions";
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
    vi.mocked(openTextFile).mockReset();
    vi.mocked(openImageFile).mockReset();
    vi.mocked(openPdfReference).mockReset();
    vi.mocked(closePdfReference).mockReset().mockResolvedValue(undefined);
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
      { origin: "manual", linkedEditorSessionId: null },
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
      { origin: "manual", linkedEditorSessionId: null },
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
      { origin: "manual", linkedEditorSessionId: null },
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
      {
        origin: "import-assist",
        linkedEditorSessionId: "sess-import-1",
        followMode: "following",
      },
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
});
