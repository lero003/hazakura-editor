import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openTextFile, pickMarkdownFile } from "../../lib/tauri";
import { useReferenceCompareActions } from "./useReferenceCompareActions";
import type { EditorTab } from "../../types";

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    openTextFile: vi.fn(),
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

describe("useReferenceCompareActions", () => {
  beforeEach(() => {
    vi.mocked(openTextFile).mockReset();
    vi.mocked(pickMarkdownFile).mockReset();
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
    const setStatus = vi.fn();
    const setGlobalError = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        activeTab: makeTab("/ws/draft.md"),
        clearReferenceCompare: vi.fn(),
        menuLanguage: "ja",
        requestReviewTabAgainstDisk: vi.fn(),
        setGlobalError,
        setReferenceDocument,
        setStatus,
      }),
    );

    await act(async () => {
      await result.current.openTextPathAsReference("/ws/style.md");
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
    expect(setGlobalError).toHaveBeenCalledWith(null);
  });

  it("routes same-file open to buffer-vs-disk review", async () => {
    const requestReviewTabAgainstDisk = vi.fn();
    const setReferenceDocument = vi.fn();
    const tab = makeTab("/ws/a.md");

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        activeTab: tab,
        clearReferenceCompare: vi.fn(),
        menuLanguage: "ja",
        requestReviewTabAgainstDisk,
        setGlobalError: vi.fn(),
        setReferenceDocument,
        setStatus: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openTextPathAsReference("/ws/a.md");
    });

    expect(requestReviewTabAgainstDisk).toHaveBeenCalledWith(tab);
    expect(setReferenceDocument).not.toHaveBeenCalled();
    expect(openTextFile).not.toHaveBeenCalled();
  });

  it("rejects non-text reference types in R1", async () => {
    const setGlobalError = vi.fn();
    const setReferenceDocument = vi.fn();

    const { result } = renderHook(() =>
      useReferenceCompareActions({
        activeTab: null,
        clearReferenceCompare: vi.fn(),
        menuLanguage: "ja",
        requestReviewTabAgainstDisk: vi.fn(),
        setGlobalError,
        setReferenceDocument,
        setStatus: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openTextPathAsReference("/ws/scan.pdf");
    });

    expect(setReferenceDocument).not.toHaveBeenCalled();
    expect(String(setGlobalError.mock.calls.at(-1)?.[0])).toContain("参照");
  });

  it("opens a picker path as reference", async () => {
    vi.mocked(pickMarkdownFile).mockResolvedValueOnce("/tmp/note.md");
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
        activeTab: null,
        clearReferenceCompare: vi.fn(),
        menuLanguage: "en",
        requestReviewTabAgainstDisk: vi.fn(),
        setGlobalError: vi.fn(),
        setReferenceDocument,
        setStatus: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openReferenceFile();
    });

    expect(pickMarkdownFile).toHaveBeenCalled();
    expect(setReferenceDocument).toHaveBeenCalled();
  });
});
