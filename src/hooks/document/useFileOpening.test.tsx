import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmImportMarkdownDraft,
  createTextFile,
  createSecurityScopedBookmark,
  importSourceToMarkdown,
  openExternalUrl,
  openTextFile,
  pickImportSourceFile,
  pickMarkdownFile,
  pickNewMarkdownFilePath,
} from "../../lib/tauri";
import { writePersistedFileBookmark } from "../../lib/storage";
import { useFileOpening } from "./useFileOpening";

vi.mock("../../lib/tauri", () => ({
  confirmImportMarkdownDraft: vi.fn(),
  createTextFile: vi.fn(),
  createSecurityScopedBookmark: vi.fn(),
  importSourceToMarkdown: vi.fn(),
  openExternalUrl: vi.fn(),
  openTextFile: vi.fn(),
  pickImportSourceFile: vi.fn(),
  pickMarkdownFile: vi.fn(),
  pickNewMarkdownFilePath: vi.fn(),
}));

vi.mock("../../lib/storage", () => ({
  readStoredDrafts: vi.fn(() => []),
  upsertDraftRecord: vi.fn((records, draft) => [...records, draft]),
  writePersistedFileBookmark: vi.fn(),
}));

function setup(
  overrides: Partial<Parameters<typeof useFileOpening>[0]> = {},
) {
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
    ...overrides,
  };

  return {
    options,
    result: renderHook(() => useFileOpening(options)).result,
  };
}

describe("useFileOpening", () => {
  beforeEach(() => {
    vi.mocked(confirmImportMarkdownDraft).mockReset();
    vi.mocked(createTextFile).mockReset();
    vi.mocked(createSecurityScopedBookmark).mockReset();
    vi.mocked(importSourceToMarkdown).mockReset();
    vi.mocked(openExternalUrl).mockReset();
    vi.mocked(openTextFile).mockReset();
    vi.mocked(pickImportSourceFile).mockReset();
    vi.mocked(pickMarkdownFile).mockReset();
    vi.mocked(pickNewMarkdownFilePath).mockReset();
    vi.mocked(writePersistedFileBookmark).mockReset();
  });

  it("creates an untitled standalone tab without choosing a path when no workspace is open", async () => {
    const { options, result } = setup({ workspaceRootPath: null });

    await act(async () => {
      await result.current.createNewFile();
    });

    expect(pickNewMarkdownFilePath).not.toHaveBeenCalled();
    expect(createTextFile).not.toHaveBeenCalled();
    expect(options.rememberRecentFile).not.toHaveBeenCalled();
    expect(options.refreshWorkspaceTree).not.toHaveBeenCalled();

    const setTabsArg = vi.mocked(options.setTabs).mock.calls[0]?.[0];
    expect(typeof setTabsArg).toBe("function");
    const nextTabs =
      typeof setTabsArg === "function" ? setTabsArg([]) : setTabsArg;
    expect(nextTabs).toHaveLength(1);
    expect(nextTabs[0]).toMatchObject({
      contents: "",
      lastSavedContents: "",
      name: "untitled.md",
      path: "",
      saveStatus: "idle",
    });
    expect(nextTabs[0].id).toMatch(/^untitled:/);
    expect(options.setActiveTabId).toHaveBeenCalledWith(nextTabs[0].id);
    expect(options.clearImagePreview).toHaveBeenCalled();
    expect(options.setCompareView).toHaveBeenCalledWith(null);
    expect(options.setStatus).toHaveBeenLastCalledWith("New file created");
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

  it("opens allowed external Markdown links outside the app WebView", async () => {
    vi.mocked(openExternalUrl).mockResolvedValueOnce(undefined);
    const { options, result } = setup();

    await act(async () => {
      await result.current.openPreviewMarkdownLink(
        "https://hazakura.dev/hazakura-editor/support/",
      );
    });

    expect(openExternalUrl).toHaveBeenCalledWith(
      "https://hazakura.dev/hazakura-editor/support/",
    );
    expect(openTextFile).not.toHaveBeenCalled();
    expect(options.setStatus).toHaveBeenLastCalledWith("External link opened");
  });

  it("keeps workspace-relative Markdown links on the in-app text-open path", async () => {
    vi.mocked(openTextFile).mockResolvedValueOnce({
      path: "/workspace/docs/linked.md",
      name: "linked.md",
      contents: "linked",
      line_ending: "lf",
      encoding: "utf-8",
      size: 6,
      modified_ms: 1,
      fingerprint: "fp-linked",
      large_file_warning: false,
    });
    const { options, result } = setup({
      activeTab: {
        id: "/workspace/docs/source.md",
        sessionId: "/workspace/docs/source.md",
        path: "/workspace/docs/source.md",
        name: "source.md",
        contents: "[linked](linked.md)",
        lastSavedContents: "[linked](linked.md)",
        line_ending: "lf",
        lastSavedLineEnding: "lf",
        encoding: "utf-8",
        lastSavedEncoding: "utf-8",
        size: 19,
        modified_ms: 1,
        fingerprint: "fp-source",
        large_file_warning: false,
        ignoredExternalFingerprint: null,
        externalFingerprint: null,
        saveStatus: "saved",
        error: null,
      },
      workspaceRootPath: "/workspace",
    });

    await act(async () => {
      await result.current.openPreviewMarkdownLink("linked.md");
    });

    expect(openTextFile).toHaveBeenCalledWith("/workspace/docs/linked.md");
    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(options.setStatus).toHaveBeenLastCalledWith("Linked file opened");
  });

  it("blocks unsafe Markdown link schemes with status feedback", async () => {
    const { options, result } = setup();

    await act(async () => {
      await result.current.openPreviewMarkdownLink("javascript:alert(1)");
    });

    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(openTextFile).not.toHaveBeenCalled();
    expect(options.setStatus).toHaveBeenLastCalledWith("External link blocked");
  });

  it("cancels path import when the user declines the confirm dialog", async () => {
    vi.mocked(confirmImportMarkdownDraft).mockResolvedValueOnce(false);
    const { options, result } = setup({ menuLanguage: "ja" });

    await act(async () => {
      await result.current.importSourcePathAsMarkdownDraft("/ws/scan.pdf");
    });

    expect(confirmImportMarkdownDraft).toHaveBeenCalledTimes(1);
    expect(importSourceToMarkdown).not.toHaveBeenCalled();
    expect(options.setStatus).toHaveBeenLastCalledWith("Import cancelled");
  });

  it("imports a confirmed path into an unsaved Markdown draft tab", async () => {
    vi.mocked(confirmImportMarkdownDraft).mockResolvedValueOnce(true);
    vi.mocked(importSourceToMarkdown).mockResolvedValueOnce({
      markdown: "# draft\n",
      sourceName: "scan.pdf",
      pageCount: 2,
      usedOcr: false,
      fixture: false,
    });
    const { options, result } = setup({ menuLanguage: "en" });

    await act(async () => {
      await result.current.importSourcePathAsMarkdownDraft("/ws/scan.pdf");
    });

    expect(importSourceToMarkdown).toHaveBeenCalledWith("/ws/scan.pdf");
    const setTabsArg = vi.mocked(options.setTabs).mock.calls.at(-1)?.[0];
    expect(typeof setTabsArg).toBe("function");
    const nextTabs =
      typeof setTabsArg === "function" ? setTabsArg([]) : [];
    expect(nextTabs).toHaveLength(1);
    expect(nextTabs[0]?.contents).toBe("# draft\n");
    expect(nextTabs[0]?.name).toBe("scan-draft.md");
    expect(options.setStatus).toHaveBeenLastCalledWith(
      "Imported text draft (2 pages, unsaved)",
    );
  });

  it("picks a file then runs the confirmed import path", async () => {
    vi.mocked(pickImportSourceFile).mockResolvedValueOnce("/tmp/page.png");
    vi.mocked(confirmImportMarkdownDraft).mockResolvedValueOnce(true);
    vi.mocked(importSourceToMarkdown).mockResolvedValueOnce({
      markdown: "ocr",
      sourceName: "page.png",
      pageCount: 1,
      usedOcr: true,
      fixture: false,
    });
    const { options, result } = setup();

    await act(async () => {
      await result.current.importSourceAsMarkdownDraft();
    });

    expect(pickImportSourceFile).toHaveBeenCalled();
    expect(importSourceToMarkdown).toHaveBeenCalledWith("/tmp/page.png");
    expect(options.setStatus).toHaveBeenLastCalledWith(
      "Imported OCR draft (1 page, unsaved)",
    );
  });
});
