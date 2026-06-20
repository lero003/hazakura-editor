import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentExport } from "./useDocumentExport";
import type { EditorTab } from "../../types";

const dialogApi = vi.hoisted(() => ({
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: dialogApi.save,
}));

const tauriApi = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(() => false),
  openTempPrintHtml: vi.fn(),
  openWorkspaceImage: vi.fn(),
  saveBinaryFileAs: vi.fn(),
  saveTextFileAs: vi.fn(),
}));

const epubApi = vi.hoisted(() => ({
  buildEpubBetaArchive: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

vi.mock("../../lib/tauri", () => ({
  isTauriRuntime: tauriApi.isTauriRuntime,
  openTempPrintHtml: tauriApi.openTempPrintHtml,
  openWorkspaceImage: tauriApi.openWorkspaceImage,
  saveBinaryFileAs: tauriApi.saveBinaryFileAs,
  saveTextFileAs: tauriApi.saveTextFileAs,
}));

vi.mock("../../features/document/epubExport", () => ({
  buildEpubBetaArchive: epubApi.buildEpubBetaArchive,
}));

vi.mock("../../features/document/markdownExportCss", () => ({
  getMarkdownPreviewCss: () => `
.markdown-preview pre {
  background: var(--status-bg);
  color: var(--status-text);
}
.blocked-image {
  background: var(--status-bg);
  color: var(--status-text);
}
`,
}));

const markdownApi = vi.hoisted(() => ({
  inlineWorkspaceAssetImages: vi.fn(async (html: string) => html),
  renderMarkdown: vi.fn((contents: string) => `<p>${contents}</p>`),
}));

vi.mock("../../features/editor/markdown", () => ({
  inlineWorkspaceAssetImages: markdownApi.inlineWorkspaceAssetImages,
  renderMarkdown: markdownApi.renderMarkdown,
}));

const useDocumentExportSource = readFileSync(
  `${process.cwd()}/src/hooks/document/useDocumentExport.ts`,
  "utf8",
);

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/workspace/a.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

describe("useDocumentExport", () => {
  it("keeps the Markdown renderer statically imported", () => {
    expect(useDocumentExportSource).not.toContain(
      'import("../../features/editor/markdown")',
    );
  });

  beforeEach(() => {
    dialogApi.save.mockReset();
    markdownApi.inlineWorkspaceAssetImages.mockClear();
    markdownApi.renderMarkdown.mockClear();
    epubApi.buildEpubBetaArchive.mockClear();
    tauriApi.saveBinaryFileAs.mockReset();
    tauriApi.saveTextFileAs.mockReset();
    tauriApi.openWorkspaceImage.mockReset();
    document.documentElement.removeAttribute("style");
  });

  it("exports the latest active contents after the save dialog completes", async () => {
    const tab = makeTab();
    let resolvePath: (value: string) => void = () => {};
    dialogApi.save.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePath = resolve;
        }),
    );
    tauriApi.saveTextFileAs.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ activeContents, activeTab }) =>
        useDocumentExport({
          activeContents,
          activeTab,
          setGlobalError: vi.fn(),
          setStatus: vi.fn(),
          workspaceRootPath: null,
        }),
      {
        initialProps: {
          activeContents: "before dialog",
          activeTab: tab,
        },
      },
    );

    let exportHtml: Promise<void> = Promise.resolve();
    act(() => {
      exportHtml = result.current.exportHtml();
    });
    rerender({ activeContents: "after dialog", activeTab: tab });

    await act(async () => {
      resolvePath("/tmp/a.html");
      await exportHtml;
    });

    expect(markdownApi.renderMarkdown).toHaveBeenCalledWith("after dialog", {
      documentPath: "/workspace/a.md",
      workspaceRoot: null,
    });
    expect(tauriApi.saveTextFileAs.mock.calls[0]?.[1]).toContain(
      "after dialog",
    );
    expect(tauriApi.saveTextFileAs.mock.calls[0]?.[1]).not.toContain(
      "before dialog",
    );
  });

  it("stops HTML export when the active tab changes while the dialog is open", async () => {
    const firstTab = makeTab();
    const secondTab = makeTab({
      id: "/workspace/b.md",
      name: "b.md",
      path: "/workspace/b.md",
    });
    const setStatus = vi.fn();
    let resolvePath: (value: string) => void = () => {};
    dialogApi.save.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePath = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ activeContents, activeTab }) =>
        useDocumentExport({
          activeContents,
          activeTab,
          setGlobalError: vi.fn(),
          setStatus,
          workspaceRootPath: null,
        }),
      {
        initialProps: {
          activeContents: "first",
          activeTab: firstTab,
        },
      },
    );

    let exportHtml: Promise<void> = Promise.resolve();
    act(() => {
      exportHtml = result.current.exportHtml();
    });
    rerender({ activeContents: "second", activeTab: secondTab });

    await act(async () => {
      resolvePath("/tmp/a.html");
      await exportHtml;
    });

    expect(tauriApi.saveTextFileAs).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      "Export HTML stopped; document changed",
    );
  });

  it("exports the preview status colors used by code blocks and blocked-image placeholders", async () => {
    document.documentElement.style.setProperty("--status-bg", "#102030");
    document.documentElement.style.setProperty("--status-text", "#f6f1e8");
    dialogApi.save.mockResolvedValue("/tmp/a.html");
    tauriApi.saveTextFileAs.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "```ts\nconst value = 1;\n```",
        activeTab: makeTab(),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportHtml();
    });

    const exportedHtml = tauriApi.saveTextFileAs.mock.calls[0]?.[1] ?? "";
    expect(exportedHtml).toContain("  --status-bg: #102030;");
    expect(exportedHtml).toContain("  --status-text: #f6f1e8;");
    expect(exportedHtml).toContain("background: var(--status-bg)");
    expect(exportedHtml).toContain("color: var(--status-text)");
  });

  it("exports EPUB beta through an EPUB save dialog and binary file write", async () => {
    dialogApi.save.mockResolvedValue("/tmp/a.epub");
    tauriApi.saveBinaryFileAs.mockResolvedValue(undefined);
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Book\n",
        activeTab: makeTab({ name: "book.md" }),
        setGlobalError: vi.fn(),
        setStatus,
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportEpubBeta();
    });

    expect(dialogApi.save).toHaveBeenCalledWith({
      defaultPath: "book.epub",
      filters: [{ name: "EPUB (Beta)", extensions: ["epub"] }],
    });
    expect(tauriApi.saveBinaryFileAs).toHaveBeenCalledWith(
      "/tmp/a.epub",
      new Uint8Array([1, 2, 3]),
    );
    expect(setStatus).toHaveBeenCalledWith("Exported EPUB beta: /tmp/a.epub");
  });

  it("passes workspace image loading into EPUB beta archive generation", async () => {
    dialogApi.save.mockResolvedValue("/tmp/a.epub");
    tauriApi.saveBinaryFileAs.mockResolvedValue(undefined);
    tauriApi.openWorkspaceImage.mockResolvedValue({
      dataUrl: "data:image/png;base64,AAAA",
    });

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Book\n\n![cover](assets/cover.png)",
        activeTab: makeTab({ name: "book.md" }),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: "/workspace",
      }),
    );

    await act(async () => {
      await result.current.exportEpubBeta();
    });

    type BuildEpubOptions = {
      documentName: string;
      documentPath: string;
      loadWorkspaceImage?: (absolutePath: string) => Promise<{ dataUrl: string }>;
      markdown: string;
      workspaceRoot: string;
    };
    const buildCalls = epubApi.buildEpubBetaArchive.mock
      .calls as unknown as Array<[BuildEpubOptions]>;
    const options = buildCalls[0]?.[0];
    expect(options).toMatchObject({
      documentName: "book.md",
      documentPath: "/workspace/a.md",
      markdown: "# Book\n\n![cover](assets/cover.png)",
      workspaceRoot: "/workspace",
    });
    expect(options?.loadWorkspaceImage).toEqual(expect.any(Function));

    const loaded = await options?.loadWorkspaceImage?.(
      "/workspace/assets/cover.png",
    );
    expect(tauriApi.openWorkspaceImage).toHaveBeenCalledWith(
      "/workspace",
      "/workspace/assets/cover.png",
    );
    expect(loaded).toEqual({ dataUrl: "data:image/png;base64,AAAA" });
  });

  it("stops EPUB beta export when the active tab changes while the dialog is open", async () => {
    const firstTab = makeTab();
    const secondTab = makeTab({
      id: "/workspace/b.md",
      name: "b.md",
      path: "/workspace/b.md",
    });
    const setStatus = vi.fn();
    let resolvePath: (value: string) => void = () => {};
    dialogApi.save.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePath = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ activeContents, activeTab }) =>
        useDocumentExport({
          activeContents,
          activeTab,
          setGlobalError: vi.fn(),
          setStatus,
          workspaceRootPath: null,
        }),
      {
        initialProps: {
          activeContents: "# First",
          activeTab: firstTab,
        },
      },
    );

    let exportEpub: Promise<void> = Promise.resolve();
    act(() => {
      exportEpub = result.current.exportEpubBeta();
    });
    rerender({ activeContents: "# Second", activeTab: secondTab });

    await act(async () => {
      resolvePath("/tmp/a.epub");
      await exportEpub;
    });

    expect(tauriApi.saveBinaryFileAs).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      "Export EPUB beta stopped; document changed",
    );
  });
});
