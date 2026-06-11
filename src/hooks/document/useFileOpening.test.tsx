import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSecurityScopedBookmark,
  openTextFile,
  pickMarkdownFile,
} from "../../lib/tauri";
import { writePersistedFileBookmark } from "../../lib/storage";
import { useFileOpening } from "./useFileOpening";

vi.mock("../../lib/tauri", () => ({
  createTextFile: vi.fn(),
  createSecurityScopedBookmark: vi.fn(),
  openTextFile: vi.fn(),
  pickMarkdownFile: vi.fn(),
  pickNewMarkdownFilePath: vi.fn(),
}));

vi.mock("../../lib/storage", () => ({
  readStoredDrafts: vi.fn(() => []),
  upsertDraftRecord: vi.fn((records, draft) => [...records, draft]),
  writePersistedFileBookmark: vi.fn(),
}));

function setup() {
  const options: Parameters<typeof useFileOpening>[0] = {
    activeTab: null,
    clearImagePreview: vi.fn(),
    menuLanguage: "en",
    openImagePreview: vi.fn(async () => true),
    refreshWorkspaceTree: vi.fn(async () => {}),
    rememberRecentFile: vi.fn(),
    setActiveTabId: vi.fn(),
    setCompareView: vi.fn(),
    setGlobalError: vi.fn(),
    setPendingDrafts: vi.fn(),
    setStatus: vi.fn(),
    setTabs: vi.fn(),
    tabs: [],
    workspaceRootPath: null,
  };

  return {
    options,
    result: renderHook(() => useFileOpening(options)).result,
  };
}

describe("useFileOpening", () => {
  beforeEach(() => {
    vi.mocked(createSecurityScopedBookmark).mockReset();
    vi.mocked(openTextFile).mockReset();
    vi.mocked(pickMarkdownFile).mockReset();
    vi.mocked(writePersistedFileBookmark).mockReset();
  });

  it("routes directly opened image files to image preview instead of text open", async () => {
    const { options, result } = setup();

    await act(async () => {
      await result.current.openExternalFilePaths(["/outside/photo.png"]);
    });

    expect(options.openImagePreview).toHaveBeenCalledWith("/outside/photo.png");
    expect(openTextFile).not.toHaveBeenCalled();
  });

  it("routes a file-dialog-selected image to image preview instead of text open", async () => {
    vi.mocked(pickMarkdownFile).mockResolvedValueOnce("/outside/photo.png");
    const { options, result } = setup();

    await act(async () => {
      await result.current.openFile();
    });

    expect(options.openImagePreview).toHaveBeenCalledWith("/outside/photo.png");
    expect(openTextFile).not.toHaveBeenCalled();
    expect(writePersistedFileBookmark).not.toHaveBeenCalled();
  });

  it("stores a file bookmark when a directly opened text file is outside the workspace", async () => {
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/outside/note.md",
      name: "note.md",
      contents: "body",
      line_ending: "lf",
      encoding: "utf-8",
      size: 4,
      modified_ms: 1,
      fingerprint: "fp",
      large_file_warning: false,
    });
    vi.mocked(createSecurityScopedBookmark).mockResolvedValueOnce([7, 8, 9]);
    const { result } = setup();

    await act(async () => {
      await result.current.openExternalFilePaths(["/outside/note.md"]);
    });

    expect(createSecurityScopedBookmark).toHaveBeenCalledWith("/outside/note.md");
    expect(writePersistedFileBookmark).toHaveBeenCalledWith(
      "/outside/note.md",
      [7, 8, 9],
    );
  });
});
