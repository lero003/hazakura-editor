import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isImageReferencePath,
  isPdfReferencePath,
  isReferencePath,
  isSameFileAsActiveEditor,
  isTextReferencePath,
} from "../../features/referenceCompare/referenceCompare";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";
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

type UseReferenceCompareActionsOptions = {
  activeTab: EditorTab | null;
  clearReferenceCompare: () => void;
  menuLanguage: MenuLanguage;
  referenceCompare: ReferenceCompareState | null;
  requestReviewTabAgainstDisk: (tab: EditorTab) => void;
  setGlobalError: Dispatch<SetStateAction<string | null>>;
  setReferenceDocument: (
    reference: ReferenceCompareState["reference"],
    options?: {
      origin?: ReferenceCompareState["origin"];
      linkedEditorSessionId?: string | null;
    },
  ) => void;
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

  return {
    closeReferenceCompare,
    openPathAsReference,
    openReferenceFile,
    openTextPathAsReference,
    referenceCopy: copy,
  };
}
