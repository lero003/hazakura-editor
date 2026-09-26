import { useCallback, useEffect, useRef, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  isTauriRuntime,
  exportPdfFile,
  fetchRemoteImage,
  openImageFile,
  openLocalImageUnderRoots,
  openWorkspaceImage,
  revealPathInFileManager,
  saveBinaryFileAs,
  saveTextFileAs,
} from "../../lib/tauri";
import {
  buildEpubBetaArchiveWithReport,
  defaultEpubExportSettings,
  type EpubExportSettings,
} from "../../features/document/epubExport";
import {
  DEFAULT_PDF_MARGIN_PRESET,
  extractPdfLeadingCoverHtml,
  PDF_A4_PAGE_HEIGHT_POINTS,
  pdfScreenPageLayout,
  preparePdfExportTables,
  type PdfMarginPreset,
} from "../../features/document/pdfExport";
import {
  embedAndStampPdfImages,
  preparePdfImagesForCapture,
} from "../../features/document/pdfExportImages";
import { buildPdfExportHtml } from "../../features/document/pdfExportHtml";
import { buildHtmlExportHtml, htmlExportCssVars } from "../../features/document/htmlExportHtml";
import type { MediaImageAccessOptions } from "../../features/editor/imagePolicy";
import {
  inlineMarkdownImagesWithResult,
  renderMarkdown,
} from "../../features/editor/markdown";
import { DEFAULT_MEDIA_IMAGE_SETTINGS } from "../../features/editor/mediaImageSettings";
import { isDirty } from "../../features/editor/editorTabs";
import { stripYamlFrontmatter } from "../../features/editor/markdownFrontmatter";
import type { EditorTab } from "../../types";
import type {
  BookScopeChapter,
  BookScopeUnavailableEntry,
} from "../../lib/tauri/bookScope";
import { openTextFile } from "../../lib/tauri/files";
import { loadBookScopeReaderDocuments } from "../../features/bookScope";
import type { BookScopeNode } from "../../features/bookScope";
import type { DocumentExportScope } from "../../features/document/exportScope";
import {
  analyzeExportPreflight,
  type ExportPreflightResult,
} from "../../features/document/exportPreflight";

type UseDocumentExportOptions = {
  activeContents: string;
  activeTab: EditorTab | null;
  setGlobalError: (message: string | null) => void;
  setStatus: (message: string) => void;
  workspaceRootPath: string | null;
  /** Theme G: when true, embed approved-local / optional remote images. */
  materializeImagesOnExport?: boolean;
  mediaAccess?: MediaImageAccessOptions | null;
  bookScopeChapters?: readonly BookScopeChapter[];
  bookScopeNodes?: readonly BookScopeNode[];
  bookScopeUnavailable?: readonly BookScopeUnavailableEntry[];
  tabs?: readonly EditorTab[];
};

export type HtmlExportRequest = {
  documentName: string;
  hasUnsavedChanges: boolean;
  tabId: string;
  sessionId: string;
  workspaceRootPath: string | null;
};

export type EpubExportRequest = {
  bookAvailable: boolean;
  bookChapterRelativePaths: string[];
  bookNavigationSignature: string;
  documentName: string;
  hasUnsavedChanges: boolean;
  preflightByScope: Record<DocumentExportScope, ExportPreflightResult>;
  settings: EpubExportSettings;
  tabId: string;
};

export type PdfExportRequest = {
  bookAvailable: boolean;
  bookChapterRelativePaths: string[];
  documentName: string;
  hasUnsavedChanges: boolean;
  preflightByScope: Record<DocumentExportScope, ExportPreflightResult>;
  preset: PdfMarginPreset;
  tabId: string;
};

export function useDocumentExport({
  activeContents,
  activeTab,
  setGlobalError,
  setStatus,
  workspaceRootPath,
  materializeImagesOnExport = DEFAULT_MEDIA_IMAGE_SETTINGS.materializeImagesOnExport,
  mediaAccess = null,
  bookScopeChapters = [],
  bookScopeNodes = [],
  bookScopeUnavailable = [],
  tabs = [],
}: UseDocumentExportOptions) {
  const activeContentsRef = useRef(activeContents);
  activeContentsRef.current = activeContents;
  const workspaceRootRef = useRef(workspaceRootPath);
  workspaceRootRef.current = workspaceRootPath;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const materializeRef = useRef(materializeImagesOnExport);
  materializeRef.current = materializeImagesOnExport;
  const mediaAccessRef = useRef(mediaAccess);
  mediaAccessRef.current = mediaAccess;
  const bookScopeChaptersRef = useRef(bookScopeChapters);
  bookScopeChaptersRef.current = bookScopeChapters;
  const bookScopeNodesRef = useRef(bookScopeNodes);
  bookScopeNodesRef.current = bookScopeNodes;
  const bookScopeUnavailableRef = useRef(bookScopeUnavailable);
  bookScopeUnavailableRef.current = bookScopeUnavailable;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const buildExportMediaAccess = useCallback((): MediaImageAccessOptions => {
    const access = mediaAccessRef.current;
    const materialize = materializeRef.current;
    return {
      outsideImages: access?.outsideImages ?? "ask",
      // Export never fetches remote unless both materialize and remote prefs allow.
      loadRemoteImages: Boolean(
        materialize && (access?.loadRemoteImages ?? false),
      ),
      approvedRoots: materialize ? (access?.approvedRoots ?? []) : [],
    };
  }, []);

  const createExportImageLoaders = useCallback(() => {
    const access = buildExportMediaAccess();
    const approvedRoots = [...(access.approvedRoots ?? [])];
    return {
      loadWorkspaceImage: async (path: string) => {
        if (!workspaceRootPath) {
          throw new Error("Workspace image access requires an open workspace");
        }
        const image = await openWorkspaceImage(workspaceRootPath, path);
        return image.dataUrl;
      },
      loadApprovedLocalImage: async (path: string) => {
        const image = await openLocalImageUnderRoots(path, approvedRoots);
        return image.dataUrl;
      },
      loadRemoteImage: access.loadRemoteImages
        ? async (url: string) => {
            const image = await fetchRemoteImage(url);
            return image.dataUrl;
          }
        : undefined,
    };
  }, [buildExportMediaAccess, workspaceRootPath]);
  // One owner across all formats. A new intent supersedes preflight, never a visible modal.
  type ExportFormat = "html" | "pdf" | "epub";
  type ExportAttempt = { format: ExportFormat; phase: "preflight" | "modal" };
  const exportAttemptRef = useRef<ExportAttempt | null>(null);
  /**
   * 形式切替の準備（外部レビュー F1/F2）。表示中の所有者とは別に持つ。
   * `id` は世代で、より新しい切替・取消に追い越されたら結果を採用しない。
   */
  const exportTransitionRef = useRef<{
    cancelPrevious: () => void;
    format: ExportFormat;
    id: number;
  } | null>(null);
  const exportTransitionSeqRef = useRef(0);
  useEffect(
    () => () => {
      // Hook が消えたら、表示中の所有者と**切替の準備**の両方を失効させる（外部レビュー N2）。
      // transition を残すと、アンマウント後に解決した preflight が id だけを見て
      // 「自分の番だ」と判断してしまう。ユーザー可視の実害は未確認だが、寿命管理として揃える。
      exportAttemptRef.current = null;
      exportTransitionRef.current = null;
    },
    [],
  );
  /**
   * 形式切替のときだけ渡す口。
   * `cancelPrevious` は「直前に開いていた形式のダイアログを閉じる」関数で、
   * 新しい要求を state に載せるのと同じ tick で呼ぶ（外部レビュー R6）。
   * 切替の本体は下の transition（`beginExportTransition` ほか）で、**所有者は乗っ取らない**。
   */
  type ExportCancelOptions = { cancelPrevious?: () => void };

  const beginExport = useCallback((format: ExportFormat) => {
    // 通常の書き出しは、開いているダイアログ（modal 相）があるなら始めない。
    // 形式切替はここを通らず、下の**切替（transition）**として別に持つ。
    if (exportAttemptRef.current?.phase === "modal") return null;
    const attempt: ExportAttempt = { format, phase: "preflight" };
    exportAttemptRef.current = attempt;
    return attempt;
  }, []);

  /**
   * 形式切替の準備（外部レビュー R6 / F1 / F2）。
   *
   * 切替は「表示中の所有者を次の形式へ乗っ取る」のではなく、
   * **表示中の要求と確定権限はそのまま**にして、準備だけを別に持つ。
   * - 準備が成功したら `completeExportTransition`: 直前の枠を閉じて新しい要求を載せ、
   *   所有者を新形式の modal へ移す（＝同じ tick の入れ替え。枠が消えるフレームが無い）。
   * - 準備が例外で終わったら `abandonExportTransition`: 準備だけ破棄し、旧画面は確定できるまま。
   * - 利用者のキャンセルは `endExportSession`: セッション全体を失効させるので、
   *   後着した準備は `transitionIsCurrent` が false になり表示されない。
   */
  const beginExportTransition = useCallback(
    (format: ExportFormat, cancelPrevious: () => void) => {
      exportTransitionSeqRef.current += 1;
      exportTransitionRef.current = {
        cancelPrevious,
        format,
        id: exportTransitionSeqRef.current,
      };
      return exportTransitionSeqRef.current;
    },
    [],
  );
  const transitionIsCurrent = useCallback(
    (id: number) => exportTransitionRef.current?.id === id,
    [],
  );
  const abandonExportTransition = useCallback((id: number) => {
    if (exportTransitionRef.current?.id === id) exportTransitionRef.current = null;
  }, []);
  const clearExportTransition = useCallback(() => {
    exportTransitionRef.current = null;
  }, []);
  const completeExportTransition = useCallback((id: number, format: ExportFormat) => {
    const transition = exportTransitionRef.current;
    if (!transition || transition.id !== id || transition.format !== format) return false;
    exportTransitionRef.current = null;
    transition.cancelPrevious();
    exportAttemptRef.current = { format, phase: "modal" };
    return true;
  }, []);

  const consumeExport = useCallback((format: ExportFormat) => {
    const attempt = exportAttemptRef.current;
    if (attempt?.format !== format || attempt.phase !== "modal") return false;
    exportAttemptRef.current = null;
    return true;
  }, []);

  const [htmlExportRequest, setHtmlExportRequest] = useState<HtmlExportRequest | null>(null);
  const htmlExportRequestRef = useRef<HtmlExportRequest | null>(null);
  const cancelHtmlExport = useCallback(() => {
    consumeExport("html");
    // この形式の枠が消えるので、切替の準備は前提が崩れる（F1）。
    clearExportTransition();
    htmlExportRequestRef.current = null;
    setHtmlExportRequest(null);
  }, [clearExportTransition, consumeExport]);
  const exportHtml = useCallback(async (options?: ExportCancelOptions) => {
    const tab = activeTabRef.current;
    if (!tab) { setStatus("No active document to export"); return; }
    const switching =
      Boolean(options?.cancelPrevious) && exportAttemptRef.current?.phase === "modal";
    if (switching) {
      // 形式切替: 表示中の枠を、新しい要求を載せるのと同じ tick で入れ替える
      // （外部レビュー R6。枠が消えるフレームを作らない）。
      const id = beginExportTransition("html", options!.cancelPrevious!);
      if (!completeExportTransition(id, "html")) return;
    } else {
      const attempt = beginExport("html");
      if (!attempt) return;
      attempt.phase = "modal";
    }
    const request = { documentName: tab.name, hasUnsavedChanges: isDirty(tab), tabId: tab.id,
      sessionId: tab.sessionId, workspaceRootPath };
    htmlExportRequestRef.current = request;
    setHtmlExportRequest(request);
  }, [beginExport, beginExportTransition, completeExportTransition, setStatus, workspaceRootPath]);

  const [epubExportRequest, setEpubExportRequest] =
    useState<EpubExportRequest | null>(null);
  const [pdfExportRequest, setPdfExportRequest] =
    useState<PdfExportRequest | null>(null);

  /**
   * 利用者のキャンセル＝**書き出しセッション全体の終了**（外部レビュー F1）。
   * 表示中の要求・切替の準備・（呼び出し側で）草稿を同じ終了口で捨てる。
   * 準備中の切替はここで失効するので、後着した結果は表示されない。
   */
  const endExportSession = useCallback(() => {
    exportTransitionRef.current = null;
    exportAttemptRef.current = null;
    htmlExportRequestRef.current = null;
    setHtmlExportRequest(null);
    setPdfExportRequest(null);
    setEpubExportRequest(null);
  }, []);

  /**
   * 利用者のキャンセル＝**書き出しセッション全体の終了**（外部レビュー F1）。
   * 表示中の要求・切替の準備・（呼び出し側で）草稿を同じ終了口で捨てる。
   * 準備中の切替はここで失効するので、後着した結果は表示されない。
   */
  const buildPreflightByScope = useCallback(async (): Promise<
    Record<DocumentExportScope, ExportPreflightResult>
  > => {
    const currentChapters = bookScopeChaptersRef.current;
    const document: ExportPreflightResult = {
      chapterCount: activeTabRef.current ? 1 : 0,
      hasUnsavedChanges: activeTabRef.current ? isDirty(activeTabRef.current) : false,
      checkedImageCount: 0,
      issues: [],
    };
    if (
      currentChapters.length === 0 &&
      bookScopeUnavailableRef.current.length === 0
    ) {
      return {
        book: { chapterCount: 0, checkedImageCount: 0, issues: [], hasUnsavedChanges: false },
        document,
      };
    }
    const loaders = createExportImageLoaders();
    const preflightTabs = tabsRef.current;
    const loadResult = await loadBookScopeReaderDocuments({
      chapters: currentChapters,
      tabs: preflightTabs,
      openTextFile,
      workspaceRoot: workspaceRootPath,
    });
    const book = await analyzeExportPreflight({
      documents: loadResult.documents.map((chapter) => ({
        markdown: chapter.source,
        name: chapter.name,
        path: chapter.path,
      })),
      loadWorkspaceImage: loaders.loadWorkspaceImage,
      unavailableChapterPaths: [
        ...bookScopeUnavailableRef.current.map((entry) => entry.relativePath),
        ...loadResult.failures.map((entry) => entry.relativePath),
        ...loadResult.skippedForBudget,
      ],
      workspaceRoot: workspaceRootPath,
    });
    // Match the reader's NFC absolute-path / workspace-relative lookup. Use
    // the same tab snapshot as loading so image checks cannot mix buffer states.
    const dirtyByPath = new Map(preflightTabs.filter((tab) => tab.path).map(
      (tab) => [tab.path!.normalize("NFC"), isDirty(tab)] as const,
    ));
    const root = workspaceRootPath?.replace(/\/+$/, "").normalize("NFC");
    book.hasUnsavedChanges = loadResult.documents.some((chapter) =>
      chapter.usesLiveBuffer && (
        dirtyByPath.get(chapter.path.normalize("NFC")) ??
        (root ? dirtyByPath.get(`${root}/${chapter.relativePath.normalize("NFC")}`) : false)
      ),
    );
    return { book, document };
  }, [createExportImageLoaders, workspaceRootPath]);

  const exportPdf = useCallback(async (options?: ExportCancelOptions) => {
    // Match HTML / EPUB: an open tab may be empty (pathless draft or blank
    // file). Only a missing active tab is "no document".
    if (!activeTab || activeContents === undefined) {
      setStatus("No active document to export PDF");
      return;
    }

    // 形式切替（開いている枠があるときだけ）は、表示中の所有者と確定権限を動かさずに
    // 準備だけを進める（外部レビュー F1/F2）。
    const switching =
      Boolean(options?.cancelPrevious) && exportAttemptRef.current?.phase === "modal";
    const transitionId = switching
      ? beginExportTransition("pdf", options!.cancelPrevious!)
      : null;
    let attempt: ExportAttempt | null = null;
    if (transitionId === null) {
      attempt = beginExport("pdf");
      if (!attempt) return;
    }
    // この書き出しがまだ有効か。切替は世代、通常は所有者で判定する。
    const ownsExport = () =>
      transitionId !== null ? transitionIsCurrent(transitionId) : exportAttemptRef.current === attempt;
    // 自分の準備を捨てる。切替なら準備だけ（旧画面と確定権限はそのまま＝F2）。
    const abandonExport = () => {
      if (transitionId !== null) abandonExportTransition(transitionId);
      else exportAttemptRef.current = null;
    };
    const root = workspaceRootRef.current;
    let preflightByScope: Record<DocumentExportScope, ExportPreflightResult>;
    try {
      preflightByScope = await buildPreflightByScope();
    } catch (error) {
      if (!ownsExport()) return;
      abandonExport();
      setStatus("PDF export preflight failed");
      setGlobalError(String(error));
      return;
    }
    if (!ownsExport()) return;
    if (activeTabRef.current?.sessionId !== activeTab.sessionId ||
        activeTabRef.current?.id !== activeTab.id || workspaceRootRef.current !== root) {
      abandonExport();
      setStatus("PDF export stopped; document changed");
      return;
    }
    if (transitionId !== null) {
      // 表示中の枠を閉じて、新しい要求を載せる（同じ tick。外部レビュー R6）。
      if (!completeExportTransition(transitionId, "pdf")) return;
    } else {
      attempt!.phase = "modal";
    }
    setPdfExportRequest({
      bookAvailable: bookScopeChapters.length > 0 || bookScopeUnavailable.length > 0,
      bookChapterRelativePaths: bookScopeChapters.map((chapter) => chapter.relativePath),
      documentName: activeTab.name,
      hasUnsavedChanges: isDirty(activeTab),
      preflightByScope,
      preset: DEFAULT_PDF_MARGIN_PRESET,
      tabId: activeTab.id,
    });
  }, [abandonExportTransition, beginExport, beginExportTransition, buildPreflightByScope, completeExportTransition, transitionIsCurrent, setGlobalError, activeContents, activeTab, bookScopeChapters, bookScopeUnavailable.length, setStatus]);

  const cancelPdfExport = useCallback(() => {
    consumeExport("pdf");
    clearExportTransition();
    setPdfExportRequest(null);
  }, [clearExportTransition, consumeExport]);

  const confirmPdfExport = useCallback(async (
    preset: PdfMarginPreset,
    scope: DocumentExportScope = "document",
  ) => {
    const request = pdfExportRequest;
    if (!request || !consumeExport("pdf")) {
      return;
    }
    // 表示中の形式を確定した＝セッションは進む。切替の準備は破棄する（後から別の面を開かない）。
    clearExportTransition();

    setPdfExportRequest(null);
    const tabForExport = activeTabRef.current;
    if (scope === "document" && (!tabForExport || tabForExport.id !== request.tabId)) {
      setStatus("PDF export stopped; document changed");
      return;
    }

    setStatus(
      scope === "book"
        ? "Preparing whole-book PDF export..."
        : "Preparing PDF export...",
    );
    try {
      let bookDocuments: Awaited<ReturnType<typeof loadBookScopeReaderDocuments>> | null = null;
      if (scope === "book") {
        const currentChapters = bookScopeChaptersRef.current;
        const currentPaths = currentChapters.map((chapter) => chapter.relativePath);
        if (
          bookScopeUnavailableRef.current.length > 0 ||
          currentPaths.join("\0") !== request.bookChapterRelativePaths.join("\0")
        ) {
          setStatus("PDF export stopped; book chapters changed or are unavailable");
          return;
        }
        setStatus("Loading whole-book chapters for PDF...");
        bookDocuments = await loadBookScopeReaderDocuments({
          chapters: currentChapters,
          tabs: tabsRef.current,
          openTextFile,
          workspaceRoot: workspaceRootPath,
        });
        if (
          bookDocuments.documents.length === 0 ||
          bookDocuments.failures.length > 0 ||
          bookDocuments.truncated
        ) {
          setStatus("PDF export stopped; book chapters could not be read completely");
          return;
        }
        setStatus("Writing whole-book PDF...");
      }
      const exportMedia = buildExportMediaAccess();
      let rendered = bookDocuments
        ? bookDocuments.documents
          .map((chapter, index, chapters) => {
            const html = renderMarkdown(stripYamlFrontmatter(chapter.source), {
              documentPath: chapter.path,
              workspaceRoot: workspaceRootPath ?? undefined,
              mediaAccess: exportMedia,
            });
            const isLast = index === chapters.length - 1;
            const className = [
              "book-scope-pdf-chapter",
              index > 0 ? "book-scope-pdf-chapter--next" : "",
              isLast ? "book-scope-pdf-chapter--last" : "",
            ].filter(Boolean).join(" ");
            const tailGuard = isLast
              ? '<p class="pdf-export-tail-guard" aria-hidden="true">&#8203;</p>'
              : "";
            return `<section class="${className}">${html}${tailGuard}</section>`;
          })
          .join("\n")
        : renderMarkdown(stripYamlFrontmatter(activeContentsRef.current), {
          documentPath: tabForExport?.path ?? null,
          workspaceRoot: workspaceRootPath ?? undefined,
          mediaAccess: exportMedia,
        });
      // Theme G M3: materialize resolvable placeholders before PDF embed.
      const inlined = await inlineMarkdownImagesWithResult(
        rendered,
        createExportImageLoaders(),
      );
      rendered = preparePdfExportTables(inlined.html);

      const pdfLayout = pdfScreenPageLayout(preset);
      const coverMaxHeightPx = Math.max(
        320,
        Math.floor(
          PDF_A4_PAGE_HEIGHT_POINTS - pdfLayout.marginBlockPoints * 2 - 24,
        ),
      );
      const imageMaxHeightPx = Math.max(
        200,
        Math.floor(pdfLayout.contentHeightPoints * 0.72),
      );

      // Embed remaining workspace path placeholders as data: URLs, then stamp
      // createPDF-safe sizes. Shared image policy + Theme G mediaAccess.
      const embedResult = await embedAndStampPdfImages(
        rendered,
        async (path) => {
          if (!workspaceRootPath) {
            throw new Error("Workspace image access requires an open workspace");
          }
          const image = await openWorkspaceImage(workspaceRootPath, path);
          return image.dataUrl;
        },
        // The leading cover is split and resized below. Keep every body image
        // within the shortened multicolumn flow so its inline style cannot
        // override the body CSS safety limit.
        { bodyMaxHeightPx: imageMaxHeightPx },
      );
      embedResult.failedPaths = [...new Set([...inlined.failures, ...embedResult.failedPaths])];
      rendered = embedResult.html;
      rendered = preparePdfImagesForCapture(rendered);
      if (embedResult.failedPaths.length > 0) {
        setStatus(
          `PDF: ${embedResult.embeddedCount} image(s) embedded, ${embedResult.failedPaths.length} skipped (access/path)`,
        );
      }

      const { coverHtml, bodyHtml } = extractPdfLeadingCoverHtml(
        rendered,
        coverMaxHeightPx,
      );

      const standaloneHtml = buildPdfExportHtml({
        title: scope === "book"
          ? workspaceLabel(workspaceRootPath)
          : (tabForExport?.name ?? request.documentName),
        scope,
        preset,
        layout: pdfLayout,
        coverHtml,
        bodyHtml,
        coverMaxHeightPx,
        imageMaxHeightPx,
      });

      if (isTauriRuntime()) {
        const destPath = await saveDialog({
          defaultPath:
            scope === "book"
              ? `${workspaceLabel(workspaceRootPath)}.pdf`
              : request.documentName.replace(/\.[^.]+$/, "") + ".pdf",
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (!destPath) {
          setStatus("");
          return;
        }

        const currentTab = activeTabRef.current;
        if (scope === "document" && (!currentTab || currentTab.id !== request.tabId)) {
          setStatus("PDF export stopped; document changed");
          return;
        }

        await exportPdfFile(destPath, standaloneHtml);
        // Keep the destination path visible (HTML/EPUB parity). Do not
        // auto-clear success so the user can still read where the file went.
        // Reveal the finished file so long book exports do not end only as a
        // status path string.
        try {
          await revealPathInFileManager(destPath);
        } catch (revealError) {
          console.warn("Failed to reveal exported PDF in file manager", revealError);
        }
        setStatus(
          embedResult.failedPaths.length > 0
            ? `PDF exported with ${embedResult.failedPaths.length} image warning(s): ${destPath}`
            : `PDF exported: ${destPath}`,
        );
        return;
      }

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setStatus("PDF export unavailable");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(standaloneHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.warn("PDF export failed:", err);
      setGlobalError(`PDF export failed: ${String(err)}`);
      setStatus("PDF export unavailable");
    }
  }, [
    buildExportMediaAccess,
    createExportImageLoaders,
    consumeExport,
    pdfExportRequest,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  ]);

  const confirmHtmlExport = useCallback(async () => {
    const request = htmlExportRequestRef.current;
    if (!request) return;
    cancelHtmlExport();
    const targetIsCurrent = () => activeTabRef.current?.id === request.tabId &&
      activeTabRef.current?.sessionId === request.sessionId && workspaceRootRef.current === request.workspaceRootPath;
    if (!targetIsCurrent()) { setStatus("Export HTML stopped; document changed"); return; }

    try {
      const destPath = await saveDialog({
        defaultPath: request.documentName.replace(/\.[^.]+$/, "") + ".html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (!destPath) return;

      const tabForExport = activeTabRef.current;
      if (!tabForExport || !targetIsCurrent()) {
        setStatus("Export HTML stopped; document changed");
        return;
      }
      const contentsForExport = activeContentsRef.current;

      let bodyHtml = renderMarkdown(contentsForExport, {
        documentPath: tabForExport.path,
        workspaceRoot: workspaceRootPath,
        mediaAccess: buildExportMediaAccess(),
      });
      const inlined = await inlineMarkdownImagesWithResult(
        bodyHtml,
        createExportImageLoaders(),
      );
      const htmlEmbed = await embedAndStampPdfImages(
        inlined.html,
        async (path) => {
          if (!workspaceRootPath) {
            throw new Error("Workspace image access requires an open workspace");
          }
          const image = await openWorkspaceImage(workspaceRootPath, path);
          return image.dataUrl;
        },
        { bodyMaxHeightPx: 1200 },
      );
      htmlEmbed.failedPaths = [...new Set([...inlined.failures, ...htmlEmbed.failedPaths])];
      bodyHtml = htmlEmbed.html;

      const standaloneHtml = buildHtmlExportHtml({
        title: tabForExport.name,
        bodyHtml,
        cssVars: htmlExportCssVars(getComputedStyle(document.documentElement)),
      });

      // HTML currently uses the editable-text writer. Check the completed
      // artifact, including base64 images and CSS, before requesting any write.
      const htmlBytes = new TextEncoder().encode(standaloneHtml).byteLength;
      if (htmlBytes > 10 * 1024 * 1024) {
        throw new Error(`画像・CSSを含むHTML全体が10 MiBの上限を超えています（${(htmlBytes / 1024 / 1024).toFixed(1)} MiB）。画像を縮小するか枚数を減らして、もう一度書き出してください。`);
      }
      await saveTextFileAs(destPath, standaloneHtml, "lf", "utf-8", null);
      try {
        await revealPathInFileManager(destPath);
      } catch (revealError) {
        console.warn("Failed to reveal exported HTML in file manager", revealError);
      }
      setStatus(
        htmlEmbed.failedPaths.length > 0
          ? `Exported HTML with image warnings: ${destPath}`
          : `Exported HTML: ${destPath}`,
      );
    } catch (err) {
      setGlobalError(`Export HTML failed: ${String(err)}`);
      setStatus("Export HTML failed");
    }
  }, [
    cancelHtmlExport,
    buildExportMediaAccess,
    createExportImageLoaders,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  ]);

  const exportEpubBeta = useCallback(async (options?: ExportCancelOptions) => {
    if (!activeTab || activeContents === undefined) {
      setStatus("No active document to export");
      return;
    }

    // 形式切替は表示中の所有者と確定権限を動かさず、準備だけを進める（F1/F2）。
    const switching =
      Boolean(options?.cancelPrevious) && exportAttemptRef.current?.phase === "modal";
    const transitionId = switching
      ? beginExportTransition("epub", options!.cancelPrevious!)
      : null;
    let attempt: ExportAttempt | null = null;
    if (transitionId === null) {
      attempt = beginExport("epub");
      if (!attempt) return;
    }
    const ownsExport = () =>
      transitionId !== null ? transitionIsCurrent(transitionId) : exportAttemptRef.current === attempt;
    const abandonExport = () => {
      if (transitionId !== null) abandonExportTransition(transitionId);
      else exportAttemptRef.current = null;
    };
    const root = workspaceRootRef.current;
    let preflightByScope: Record<DocumentExportScope, ExportPreflightResult>;
    try {
      preflightByScope = await buildPreflightByScope();
    } catch (error) {
      if (!ownsExport()) return;
      abandonExport();
      setStatus("EPUB export preflight failed");
      setGlobalError(String(error));
      return;
    }
    if (!ownsExport()) return;
    if (activeTabRef.current?.sessionId !== activeTab.sessionId ||
        activeTabRef.current?.id !== activeTab.id || workspaceRootRef.current !== root) {
      abandonExport();
      setStatus("EPUB export stopped; document changed");
      return;
    }
    if (transitionId !== null) {
      // 表示中の枠を閉じて、新しい要求を載せる（同じ tick。外部レビュー R6）。
      if (!completeExportTransition(transitionId, "epub")) return;
    } else {
      attempt!.phase = "modal";
    }
    setEpubExportRequest({
      bookAvailable: bookScopeChapters.length > 0 || bookScopeUnavailable.length > 0,
      bookChapterRelativePaths: bookScopeChapters.map((chapter) => chapter.relativePath),
      bookNavigationSignature: JSON.stringify(bookScopeNodes),
      documentName: activeTab.name,
      hasUnsavedChanges: isDirty(activeTab),
      preflightByScope,
      settings: defaultEpubExportSettings({
        documentName: activeTab.name,
        markdown: activeContents,
      }),
      tabId: activeTab.id,
    });
  }, [abandonExportTransition, beginExport, beginExportTransition, buildPreflightByScope, completeExportTransition, transitionIsCurrent, setGlobalError, activeContents, activeTab, bookScopeChapters, bookScopeNodes, bookScopeUnavailable.length, setStatus]);

  const cancelEpubBetaExport = useCallback(() => {
    consumeExport("epub");
    clearExportTransition();
    setEpubExportRequest(null);
  }, [clearExportTransition, consumeExport]);

  const confirmEpubBetaExport = useCallback(async (
    settings: EpubExportSettings,
    scope: DocumentExportScope = "document",
  ) => {
    const request = epubExportRequest;
    if (!request || !consumeExport("epub")) {
      return;
    }
    clearExportTransition();

    setEpubExportRequest(null);

    try {
      setStatus(
        scope === "book"
          ? "Preparing whole-book EPUB export..."
          : "Preparing EPUB export...",
      );
      let bookDocuments: Awaited<ReturnType<typeof loadBookScopeReaderDocuments>> | null = null;
      if (scope === "book") {
        const currentChapters = bookScopeChaptersRef.current;
        const currentPaths = currentChapters.map((chapter) => chapter.relativePath);
        if (
          bookScopeUnavailableRef.current.length > 0 ||
          currentPaths.join("\0") !== request.bookChapterRelativePaths.join("\0") ||
          JSON.stringify(bookScopeNodesRef.current) !== request.bookNavigationSignature
        ) {
          setStatus("Export EPUB beta stopped; book chapters changed or are unavailable");
          return;
        }
        setStatus("Loading whole-book chapters for EPUB...");
        bookDocuments = await loadBookScopeReaderDocuments({
          chapters: currentChapters,
          tabs: tabsRef.current,
          openTextFile,
          workspaceRoot: workspaceRootPath,
        });
        if (
          bookDocuments.documents.length === 0 ||
          bookDocuments.failures.length > 0 ||
          bookDocuments.truncated
        ) {
          setStatus("Export EPUB beta stopped; book chapters could not be read completely");
          return;
        }
        setStatus("Writing whole-book EPUB...");
      }
      const destPath = await saveDialog({
        defaultPath:
          scope === "book"
            ? `${workspaceLabel(workspaceRootPath)}.epub`
            : request.documentName.replace(/\.[^.]+$/, "") + ".epub",
        filters: [{ name: "EPUB", extensions: ["epub"] }],
      });
      if (!destPath) return;

      const tabForExport = activeTabRef.current;
      if (scope === "document" && (!tabForExport || tabForExport.id !== request.tabId)) {
        setStatus("Export EPUB beta stopped; document changed");
        return;
      }

      const exportMedia = buildExportMediaAccess();
      const loaders = createExportImageLoaders();
      const loadApprovedLocalImage = loaders.loadApprovedLocalImage;
      const loadRemoteImage = loaders.loadRemoteImage;
      const coverImage = settings.coverImagePath
        ? await openImageFile(settings.coverImagePath)
        : null;
      const { archive, warnings } = await buildEpubBetaArchiveWithReport({
        bookNavigation: scope === "book" ? bookScopeNodesRef.current : undefined,
        chapters: bookDocuments?.documents.map((chapter) => ({
          documentName: chapter.name,
          documentPath: chapter.path,
          markdown: chapter.source,
        })),
        coverImage: coverImage ? { dataUrl: coverImage.dataUrl } : null,
        documentPath: tabForExport?.path ?? null,
        documentName: scope === "book" ? workspaceLabel(workspaceRootPath) : (tabForExport?.name ?? request.documentName),
        loadApprovedLocalImage: loadApprovedLocalImage
          ? async (path) => ({
              dataUrl: await loadApprovedLocalImage(path),
            })
          : undefined,
        loadRemoteImage: loadRemoteImage
          ? async (url) => ({ dataUrl: await loadRemoteImage(url) })
          : undefined,
        loadWorkspaceImage: async (path) => ({
          dataUrl: await loaders.loadWorkspaceImage(path),
        }),
        mediaAccess: exportMedia,
        metadata: {
          author: settings.author.trim(),
          language: settings.language.trim() || "ja",
          modified: formatEpubModifiedDate(new Date()),
          title: settings.title.trim() || request.settings.title,
        },
        markdown: scope === "book" ? "" : activeContentsRef.current,
        workspaceRoot: workspaceRootPath,
      });
      await saveBinaryFileAs(destPath, archive);
      try {
        await revealPathInFileManager(destPath);
      } catch (revealError) {
        console.warn("Failed to reveal exported EPUB in file manager", revealError);
      }
      setStatus(
        warnings.length > 0
          ? `Exported EPUB with image warnings: ${destPath}`
          : `Exported EPUB: ${destPath}`,
      );
    } catch (err) {
      setGlobalError(`Export EPUB beta failed: ${String(err)}`);
      setStatus("Export EPUB beta failed");
    }
  }, [
    buildExportMediaAccess,
    createExportImageLoaders,
    consumeExport,
    epubExportRequest,
    setGlobalError,
    setStatus,
    workspaceRootPath,
  ]);

  return {
    cancelPdfExport,
    cancelEpubBetaExport,
    confirmPdfExport,
    confirmEpubBetaExport,
    epubExportRequest,
    exportEpubBeta,
    exportHtml,
    htmlExportRequest,
    cancelHtmlExport,
    confirmHtmlExport,
    // 利用者のキャンセル＝セッション全体の終了口（外部レビュー F1）。
    endExportSession,
    exportPdf,
    pdfExportRequest,
  };
}

function formatEpubModifiedDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function workspaceLabel(workspaceRootPath: string | null): string {
  const label = workspaceRootPath
    ?.split(/[\\/]/)
    .filter(Boolean)
    .at(-1)
    ?.trim();
  return label || "book";
}
