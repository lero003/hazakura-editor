import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentExport } from "./useDocumentExport";
import type { EditorTab } from "../../types";

const dialogApi = vi.hoisted(() => ({
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: dialogApi.save,
}));

const tauriApi = vi.hoisted(() => ({
  exportPdfFile: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  openWorkspaceImage: vi.fn(),
  saveBinaryFileAs: vi.fn(),
  saveTextFileAs: vi.fn(),
}));

const epubApi = vi.hoisted(() => ({
  buildEpubBetaArchive: vi.fn(async () => new Uint8Array([1, 2, 3])),
  buildEpubBetaArchiveWithReport: vi.fn(async () => ({
    archive: new Uint8Array([1, 2, 3]),
    warnings: [] as Array<{ label: string | null; type: "image-unavailable" }>,
  })),
  defaultEpubExportSettings: vi.fn(() => ({
    author: "",
    language: "ja",
    title: "Book",
  })),
}));

vi.mock("../../lib/tauri", () => ({
  exportPdfFile: tauriApi.exportPdfFile,
  isTauriRuntime: tauriApi.isTauriRuntime,
  openWorkspaceImage: tauriApi.openWorkspaceImage,
  saveBinaryFileAs: tauriApi.saveBinaryFileAs,
  saveTextFileAs: tauriApi.saveTextFileAs,
}));

vi.mock("../../features/document/epubExport", () => ({
  buildEpubBetaArchive: epubApi.buildEpubBetaArchive,
  buildEpubBetaArchiveWithReport: epubApi.buildEpubBetaArchiveWithReport,
  defaultEpubExportSettings: epubApi.defaultEpubExportSettings,
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
  renderMarkdown: vi.fn((contents: string) => `<p>${contents}</p>`),
}));

vi.mock("../../features/editor/markdown", () => ({
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
    sessionId: "/workspace/a.md",
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
    vi.useRealTimers();
    dialogApi.save.mockReset();
    markdownApi.renderMarkdown.mockClear();
    epubApi.buildEpubBetaArchive.mockClear();
    epubApi.buildEpubBetaArchiveWithReport.mockClear();
    epubApi.defaultEpubExportSettings.mockClear();
    tauriApi.saveBinaryFileAs.mockReset();
    tauriApi.saveTextFileAs.mockReset();
    tauriApi.openWorkspaceImage.mockReset();
    tauriApi.exportPdfFile.mockReset();
    tauriApi.isTauriRuntime.mockReset();
    tauriApi.isTauriRuntime.mockReturnValue(false);
    document.documentElement.removeAttribute("style");
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("opens PDF settings before exporting with the selected margin", async () => {
    tauriApi.isTauriRuntime.mockReturnValue(true);
    dialogApi.save.mockResolvedValue("/tmp/print-me.pdf");
    tauriApi.exportPdfFile.mockResolvedValue(undefined);
    tauriApi.openWorkspaceImage.mockResolvedValue({
      dataUrl: "data:image/png;base64,AAAA",
    });
    markdownApi.renderMarkdown.mockImplementationOnce(
      () => `
        <h1>本文画像の前</h1>
        <p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-hazakura-image-path="/workspace/assets/body.png" alt="本文画像"></p>
        <div class="markdown-table-frame">
          <table>
            <thead><tr><th>章</th><th>場面</th></tr></thead>
            <tbody><tr><td>第一章</td><td>図書室</td></tr></tbody>
          </table>
        </div>
      `,
    );
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Print me",
        activeTab: makeTab({ name: "print-me.md" }),
        setGlobalError: vi.fn(),
        setStatus,
        workspaceRootPath: "/workspace",
      }),
    );

    await act(async () => {
      await result.current.exportPdf();
    });

    expect(result.current.pdfExportRequest).toMatchObject({
      documentName: "print-me.md",
      preset: "standard",
      tabId: "/workspace/a.md",
    });
    expect(dialogApi.save).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmPdfExport("wide");
    });

    expect(markdownApi.renderMarkdown).toHaveBeenCalledWith("# Print me", {
      documentPath: "/workspace/a.md",
      workspaceRoot: "/workspace",
    });
    expect(dialogApi.save).toHaveBeenCalledWith({
      defaultPath: "print-me.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    expect(tauriApi.exportPdfFile).toHaveBeenCalledWith(
      "/tmp/print-me.pdf",
      expect.stringContaining("@page { margin: 25mm 22mm; }"),
    );
    const exportedPdfHtml = tauriApi.exportPdfFile.mock.calls[0]?.[1] ?? "";
    expect(exportedPdfHtml).toContain("--pdf-page-width: 595px;");
    expect(exportedPdfHtml).toContain("--pdf-page-height: 842px;");
    expect(exportedPdfHtml).toContain("--pdf-margin-block: 70.866px;");
    expect(exportedPdfHtml).toContain("--pdf-margin-inline: 62.362px;");
    expect(exportedPdfHtml).toContain("--pdf-content-width: 470.276px;");
    // wide margins minus PDF_CONTENT_BOTTOM_SAFETY_POINTS (148)
    expect(exportedPdfHtml).toContain("--pdf-content-height: 552.268px;");
    expect(exportedPdfHtml).toContain("box-sizing: border-box;");
    expect(exportedPdfHtml).toContain("pdf-export-tail-guard");
    // Fixed px max-height for in-body images (cover page uses its own rules).
    expect(exportedPdfHtml).toMatch(/max-height:\s*\d+px/);
    const bodyImage =
      exportedPdfHtml.match(/<img[^>]*alt="本文画像"[^>]*>/)?.[0] ?? "";
    // `style` wins over the body CSS. The leading-cover size (676px for
    // this preset) would overflow the 552px body column, so body images must
    // keep their dedicated 72%-of-content-height bound (397px).
    expect(bodyImage).toContain("max-height: 397px");
    expect(bodyImage).not.toContain("max-height: 676px");
    expect(tauriApi.openWorkspaceImage).toHaveBeenCalledWith(
      "/workspace",
      "/workspace/assets/body.png",
    );
    expect(exportedPdfHtml).toContain("--pdf-column-gap: 124.724px;");
    expect(exportedPdfHtml).toContain("column-fill: auto;");
    expect(exportedPdfHtml).toContain("column-width: var(--pdf-content-width);");
    expect(exportedPdfHtml).toContain(`
  .markdown-preview pre {
    background: var(--status-bg);
    border-left: 2px solid #999999;
    box-sizing: border-box;
    color: var(--status-text);
    display: inline-block;
    max-width: 100%;
    overflow: visible;
    padding: 16px;
    white-space: pre-wrap;
    width: 100%;
  }`);
    expect(exportedPdfHtml).toContain(`
  .markdown-preview .markdown-table-frame {
    break-inside: auto;
    max-width: 100%;
    overflow: visible;
  }`);
    expect(exportedPdfHtml).toContain(`
  .markdown-preview .markdown-table-frame table {
    display: block;
    min-width: 0;
    width: 100%;
  }`);
    expect(exportedPdfHtml).toContain(`
  .markdown-preview .markdown-table-frame thead,
  .markdown-preview .markdown-table-frame tbody {
    display: block;
  }`);
    expect(exportedPdfHtml).toContain(`
  .markdown-preview .markdown-table-frame tr {
    break-inside: avoid;
    display: grid;
    grid-template-columns: repeat(var(--pdf-table-columns), minmax(0, 1fr));
  }`);
    expect(exportedPdfHtml).toContain(`
  .markdown-preview .markdown-table-frame th,
  .markdown-preview .markdown-table-frame td {
    box-sizing: border-box;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }`);
    expect(exportedPdfHtml).toContain('style="--pdf-table-columns: 2;"');
    expect(exportedPdfHtml).not.toContain(`
  .markdown-preview pre,
  .markdown-preview code,
  .markdown-preview .markdown-table-frame th { background: transparent; }`);
    expect(setStatus).toHaveBeenCalledWith("PDF exported");
  });

  it("does not call an export image loader for a child-workspace escape", async () => {
    tauriApi.isTauriRuntime.mockReturnValue(true);
    dialogApi.save.mockResolvedValue("/tmp/child-workspace.pdf");
    tauriApi.exportPdfFile.mockResolvedValue(undefined);
    // Use the unmocked renderer for the resolver half of this thin export
    // integration: its blocked result must reach the PDF builder unchanged.
    const { renderMarkdown: actualRenderMarkdown } = await vi.importActual<
      typeof import("../../features/editor/markdown")
    >("../../features/editor/markdown");
    markdownApi.renderMarkdown.mockImplementationOnce(() =>
      actualRenderMarkdown("![cover](../assets/cover.jpg)", {
        documentPath: "/project/book/chapter.md",
        workspaceRoot: "/project/book",
      }),
    );

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "![cover](../assets/cover.jpg)",
        activeTab: makeTab({ path: "/project/book/chapter.md" }),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: "/project/book",
      }),
    );

    await act(async () => {
      await result.current.exportPdf();
    });
    await act(async () => {
      await result.current.confirmPdfExport("standard");
    });

    expect(tauriApi.openWorkspaceImage).not.toHaveBeenCalled();
    expect(useDocumentExportSource).not.toContain("openImageFile");
    expect(tauriApi.exportPdfFile.mock.calls[0]?.[1]).toContain(
      "画像を含む親フォルダをワークスペースとして開いてください",
    );
  });

  it("surfaces native PDF export errors for diagnosis", async () => {
    tauriApi.isTauriRuntime.mockReturnValue(true);
    dialogApi.save.mockResolvedValue("/tmp/print-me.pdf");
    tauriApi.exportPdfFile.mockRejectedValue("PDF export timed out.");
    const setGlobalError = vi.fn();
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Print me",
        activeTab: makeTab({ name: "print-me.md" }),
        setGlobalError,
        setStatus,
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportPdf();
    });
    await act(async () => {
      await result.current.confirmPdfExport("standard");
    });

    expect(setGlobalError).toHaveBeenCalledWith(
      "PDF export failed: PDF export timed out.",
    );
    expect(setStatus).toHaveBeenCalledWith("PDF export unavailable");
  });

  it("cancels PDF settings without opening the save dialog", async () => {
    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Print me",
        activeTab: makeTab({ name: "print-me.md" }),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportPdf();
    });
    act(() => result.current.cancelPdfExport());

    expect(result.current.pdfExportRequest).toBeNull();
    expect(dialogApi.save).not.toHaveBeenCalled();
    expect(tauriApi.exportPdfFile).not.toHaveBeenCalled();
  });

  it("stops PDF export when the active tab changes before confirmation", async () => {
    tauriApi.isTauriRuntime.mockReturnValue(true);
    const setStatus = vi.fn();
    const firstTab = makeTab({ id: "first", name: "first.md" });
    const secondTab = makeTab({
      id: "second",
      name: "second.md",
      path: "/workspace/second.md",
    });
    const { result, rerender } = renderHook(
      ({ activeTab }) =>
        useDocumentExport({
          activeContents: activeTab.contents,
          activeTab,
          setGlobalError: vi.fn(),
          setStatus,
          workspaceRootPath: null,
        }),
      { initialProps: { activeTab: firstTab } },
    );

    await act(async () => {
      await result.current.exportPdf();
    });
    rerender({ activeTab: secondTab });
    await act(async () => {
      await result.current.confirmPdfExport("standard");
    });

    expect(setStatus).toHaveBeenCalledWith(
      "PDF export stopped; document changed",
    );
    expect(dialogApi.save).not.toHaveBeenCalled();
    expect(tauriApi.exportPdfFile).not.toHaveBeenCalled();
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
    await act(async () => {
      await result.current.confirmEpubBetaExport({
        author: "",
        language: "ja",
        title: "Book",
      });
    });

    expect(dialogApi.save).toHaveBeenCalledWith({
      defaultPath: "book.epub",
      filters: [{ name: "EPUB", extensions: ["epub"] }],
    });
    expect(tauriApi.saveBinaryFileAs).toHaveBeenCalledWith(
      "/tmp/a.epub",
      new Uint8Array([1, 2, 3]),
    );
    expect(setStatus).toHaveBeenCalledWith("Exported EPUB: /tmp/a.epub");
  });

  it("opens EPUB metadata settings before the save dialog", async () => {
    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Book\n",
        activeTab: makeTab({ name: "book.md" }),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportEpubBeta();
    });

    expect(result.current.epubExportRequest?.settings).toEqual({
      author: "",
      language: "ja",
      title: "Book",
    });
    expect(dialogApi.save).not.toHaveBeenCalled();
  });

  it("passes EPUB metadata settings and export time into archive generation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T04:30:12.345Z"));
    dialogApi.save.mockResolvedValue("/tmp/a.epub");
    tauriApi.saveBinaryFileAs.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Source\n\nBody.",
        activeTab: makeTab({ name: "source.md" }),
        setGlobalError: vi.fn(),
        setStatus: vi.fn(),
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportEpubBeta();
    });
    await act(async () => {
      await result.current.confirmEpubBetaExport({
        author: "Kaguya",
        language: "en",
        title: "Metadata Title",
      });
    });

    expect(epubApi.buildEpubBetaArchiveWithReport).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          author: "Kaguya",
          language: "en",
          modified: "2026-06-20T04:30:12Z",
          title: "Metadata Title",
        },
      }),
    );
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
    await act(async () => {
      await result.current.confirmEpubBetaExport({
        author: "",
        language: "ja",
        title: "Book",
      });
    });

    type BuildEpubOptions = {
      documentName: string;
      documentPath: string;
      loadWorkspaceImage?: (absolutePath: string) => Promise<{ dataUrl: string }>;
      markdown: string;
      workspaceRoot: string;
    };
    const buildCalls = epubApi.buildEpubBetaArchiveWithReport.mock
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
    await act(async () => {
      await exportEpub;
    });
    rerender({ activeContents: "# Second", activeTab: secondTab });

    await act(async () => {
      const confirmPromise = result.current.confirmEpubBetaExport({
        author: "",
        language: "ja",
        title: "First",
      });
      resolvePath("/tmp/a.epub");
      await confirmPromise;
    });

    expect(tauriApi.saveBinaryFileAs).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(
      "Export EPUB beta stopped; document changed",
    );
  });

  it("reports image warnings after a successful EPUB export", async () => {
    epubApi.buildEpubBetaArchiveWithReport.mockResolvedValueOnce({
      archive: new Uint8Array([1, 2, 3]),
      warnings: [{ label: "remote", type: "image-unavailable" }],
    });
    dialogApi.save.mockResolvedValue("/tmp/a.epub");
    tauriApi.saveBinaryFileAs.mockResolvedValue(undefined);
    const setStatus = vi.fn();

    const { result } = renderHook(() =>
      useDocumentExport({
        activeContents: "# Book\n\n![remote](https://example.com/remote.png)",
        activeTab: makeTab({ name: "book.md" }),
        setGlobalError: vi.fn(),
        setStatus,
        workspaceRootPath: null,
      }),
    );

    await act(async () => {
      await result.current.exportEpubBeta();
    });
    await act(async () => {
      await result.current.confirmEpubBetaExport({
        author: "",
        language: "ja",
        title: "Book",
      });
    });

    expect(tauriApi.saveBinaryFileAs).toHaveBeenCalledWith(
      "/tmp/a.epub",
      new Uint8Array([1, 2, 3]),
    );
    expect(setStatus).toHaveBeenCalledWith(
      "Exported EPUB with image warnings: /tmp/a.epub",
    );
  });
});
