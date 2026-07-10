import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isImageReferencePath,
  isPdfReferencePath,
  isReferencePath,
  isSameFileAsActiveEditor,
  isTextReferencePath,
} from "../../features/referenceCompare/referenceCompare";
import type {
  ReferenceCompareState,
  ReferenceFollowMode,
} from "../../features/referenceCompare/types";
import {
  closePdfReference,
  createSecurityScopedBookmark,
  openImageFile,
  openPdfReference,
  openTextFile,
  openWorkspaceImage,
  pickReferenceFile,
} from "../../lib/tauri";
import { fileNameFromPath, isPathInsideDirectory } from "../../lib/utils";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import type { EditorTab, MenuLanguage } from "../../types";

type SetReferenceDocument = (
  reference: ReferenceCompareState["reference"],
  options?: {
    origin?: ReferenceCompareState["origin"];
    linkedEditorSessionId?: string | null;
    followMode?: ReferenceFollowMode;
  },
) => void;

type UseReferenceCompareActionsOptions = {
  activeTab: EditorTab | null;
  clearReferenceCompare: () => void;
  menuLanguage: MenuLanguage;
  referenceCompare: ReferenceCompareState | null;
  requestReviewTabAgainstDisk: (tab: EditorTab) => void;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setReferenceDocument: SetReferenceDocument;
  setReferenceFollowMode: (mode: ReferenceFollowMode) => void;
  setStatus: Dispatch<SetStateAction<string>>;
  workspaceRootPath: string | null;
};

async function releasePdfHandle(
  state: ReferenceCompareState | null,
): Promise<void> {
  if (state?.reference.kind !== "pdf") {
    return;
  }
  await closePdfReference(state.reference.referenceId).catch(() => {
    // Best-effort: stale ids after app restart or double-close are fine.
  });
}

export function useReferenceCompareActions({
  activeTab,
  clearReferenceCompare,
  menuLanguage,
  referenceCompare,
  requestReviewTabAgainstDisk,
  setGlobalError,
  setReferenceDocument,
  setReferenceFollowMode,
  setStatus,
  workspaceRootPath,
}: UseReferenceCompareActionsOptions) {
  const copy = referenceCompareCopy(menuLanguage);

  const openPathAsReference = useCallback(
    async (path: string, options: { persistFileBookmark?: boolean } = {}) => {
      setGlobalError(null);

      if (!isReferencePath(path)) {
        setGlobalError(copy.unsupportedType);
        setStatus("Reference open failed");
        return false;
      }

      if (
        isTextReferencePath(path) &&
        isSameFileAsActiveEditor(path, activeTab?.path)
      ) {
        if (activeTab?.path) {
          requestReviewTabAgainstDisk(activeTab);
          setStatus("Opened buffer vs disk review");
        }
        return false;
      }

      setStatus("Opening reference…");
      try {
        if (options.persistFileBookmark) {
          await createSecurityScopedBookmark(path).catch(() => null);
        }

        if (isPdfReferencePath(path)) {
          // Close any previous PDF handle before opening a new one.
          await releasePdfHandle(referenceCompare);
          const opened = await openPdfReference(path);
          setReferenceDocument(
            {
              kind: "pdf",
              path,
              name: opened.name || fileNameFromPath(path),
              pageCount: opened.pageCount,
              referenceId: opened.referenceId,
            },
            { origin: "manual", linkedEditorSessionId: null },
          );
          setStatus(`Reference opened: ${opened.name || fileNameFromPath(path)}`);
          return true;
        }

        if (isImageReferencePath(path)) {
          await releasePdfHandle(referenceCompare);
          const image =
            workspaceRootPath && isPathInsideDirectory(path, workspaceRootPath)
              ? await openWorkspaceImage(workspaceRootPath, path)
              : await openImageFile(path);
          setReferenceDocument(
            {
              kind: "image",
              path: image.path,
              name: image.name || fileNameFromPath(image.path),
              url: image.dataUrl,
              size: image.size,
            },
            { origin: "manual", linkedEditorSessionId: null },
          );
          setStatus(
            `Reference opened: ${image.name || fileNameFromPath(image.path)}`,
          );
          return true;
        }

        // Text / Markdown
        await releasePdfHandle(referenceCompare);
        const file = await openTextFile(path);
        setReferenceDocument(
          {
            kind: "text",
            path: file.path,
            name: file.name || fileNameFromPath(file.path),
            contents: file.contents,
            encoding: file.encoding,
          },
          { origin: "manual", linkedEditorSessionId: null },
        );
        setStatus(
          `Reference opened: ${file.name || fileNameFromPath(file.path)}`,
        );
        return true;
      } catch (err) {
        setGlobalError(String(err));
        setStatus("Reference open failed");
        return false;
      }
    },
    [
      activeTab,
      copy.unsupportedType,
      referenceCompare,
      requestReviewTabAgainstDisk,
      setGlobalError,
      setReferenceDocument,
      setStatus,
      workspaceRootPath,
    ],
  );

  /** @deprecated Prefer openPathAsReference; kept for call-site compatibility. */
  const openTextPathAsReference = openPathAsReference;

  const openReferenceFile = useCallback(async () => {
    setGlobalError(null);
    setStatus("Choosing reference file…");
    try {
      const path = await pickReferenceFile();
      if (!path) {
        setStatus("Reference open cancelled");
        return;
      }
      await openPathAsReference(path, { persistFileBookmark: true });
    } catch (err) {
      setGlobalError(String(err));
      setStatus("Reference open failed");
    }
  }, [openPathAsReference, setGlobalError, setStatus]);

  const closeReferenceCompare = useCallback(() => {
    void releasePdfHandle(referenceCompare).finally(() => {
      clearReferenceCompare();
      setStatus("Reference closed");
    });
  }, [clearReferenceCompare, referenceCompare, setStatus]);

  /**
   * R3: After Import Assist succeeds, open the source as a linked reference
   * beside the unsaved draft. Link key is editor sessionId.
   */
  const pairImportAssistReference = useCallback(
    async (sourcePath: string, editorSessionId: string) => {
      setGlobalError(null);
      try {
        await createSecurityScopedBookmark(sourcePath).catch(() => null);

        if (isPdfReferencePath(sourcePath)) {
          await releasePdfHandle(referenceCompare);
          const opened = await openPdfReference(sourcePath);
          setReferenceDocument(
            {
              kind: "pdf",
              path: sourcePath,
              name: opened.name || fileNameFromPath(sourcePath),
              pageCount: opened.pageCount,
              referenceId: opened.referenceId,
            },
            {
              origin: "import-assist",
              linkedEditorSessionId: editorSessionId,
              followMode: "following",
            },
          );
          setStatus(
            `Import paired with reference: ${opened.name || fileNameFromPath(sourcePath)}`,
          );
          return true;
        }

        if (isImageReferencePath(sourcePath)) {
          await releasePdfHandle(referenceCompare);
          const image =
            workspaceRootPath &&
            isPathInsideDirectory(sourcePath, workspaceRootPath)
              ? await openWorkspaceImage(workspaceRootPath, sourcePath)
              : await openImageFile(sourcePath);
          setReferenceDocument(
            {
              kind: "image",
              path: image.path,
              name: image.name || fileNameFromPath(image.path),
              url: image.dataUrl,
              size: image.size,
            },
            {
              origin: "import-assist",
              linkedEditorSessionId: editorSessionId,
              followMode: "off",
            },
          );
          setStatus(
            `Import paired with reference: ${image.name || fileNameFromPath(image.path)}`,
          );
          return true;
        }

        // Non-pdf/image import sources: skip pairing without failing import.
        return false;
      } catch (err) {
        // Import draft already exists — surface pairing failure without rollback.
        setGlobalError(String(err));
        setStatus("Import draft opened; reference pairing failed");
        return false;
      }
    },
    [
      referenceCompare,
      setGlobalError,
      setReferenceDocument,
      setStatus,
      workspaceRootPath,
    ],
  );

  const pauseReferenceFollow = useCallback(() => {
    if (referenceCompare?.followMode === "following") {
      setReferenceFollowMode("paused");
    }
  }, [referenceCompare?.followMode, setReferenceFollowMode]);

  const resumeReferenceFollow = useCallback(() => {
    if (
      referenceCompare?.linkedEditorSessionId &&
      referenceCompare.reference.kind === "pdf"
    ) {
      setReferenceFollowMode("following");
    }
  }, [referenceCompare, setReferenceFollowMode]);

  return {
    closeReferenceCompare,
    openPathAsReference,
    openReferenceFile,
    openTextPathAsReference,
    pairImportAssistReference,
    pauseReferenceFollow,
    referenceCopy: copy,
    resumeReferenceFollow,
  };
}
