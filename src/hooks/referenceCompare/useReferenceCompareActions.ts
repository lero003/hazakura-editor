import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isSameFileAsActiveEditor,
  isTextReferencePath,
} from "../../features/referenceCompare/referenceCompare";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";
import { createSecurityScopedBookmark, openTextFile, pickMarkdownFile } from "../../lib/tauri";
import { fileNameFromPath } from "../../lib/utils";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import type { EditorTab, MenuLanguage } from "../../types";

type UseReferenceCompareActionsOptions = {
  activeTab: EditorTab | null;
  clearReferenceCompare: () => void;
  menuLanguage: MenuLanguage;
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
};

export function useReferenceCompareActions({
  activeTab,
  clearReferenceCompare,
  menuLanguage,
  requestReviewTabAgainstDisk,
  setGlobalError,
  setReferenceDocument,
  setStatus,
}: UseReferenceCompareActionsOptions) {
  const copy = referenceCompareCopy(menuLanguage);

  const openTextPathAsReference = useCallback(
    async (path: string, options: { persistFileBookmark?: boolean } = {}) => {
      setGlobalError(null);

      if (!isTextReferencePath(path)) {
        setGlobalError(copy.unsupportedType);
        setStatus("Reference open failed");
        return false;
      }

      if (isSameFileAsActiveEditor(path, activeTab?.path)) {
        if (activeTab?.path) {
          requestReviewTabAgainstDisk(activeTab);
          setStatus("Opened buffer vs disk review");
        }
        return false;
      }

      setStatus("Opening reference…");
      try {
        const file = await openTextFile(path);
        if (options.persistFileBookmark) {
          await createSecurityScopedBookmark(path).catch(() => null);
        }
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
        setStatus(`Reference opened: ${file.name || fileNameFromPath(file.path)}`);
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
      requestReviewTabAgainstDisk,
      setGlobalError,
      setReferenceDocument,
      setStatus,
    ],
  );

  const openReferenceFile = useCallback(async () => {
    setGlobalError(null);
    setStatus("Choosing reference file…");
    try {
      const path = await pickMarkdownFile();
      if (!path) {
        setStatus("Reference open cancelled");
        return;
      }
      await openTextPathAsReference(path, { persistFileBookmark: true });
    } catch (err) {
      setGlobalError(String(err));
      setStatus("Reference open failed");
    }
  }, [openTextPathAsReference, setGlobalError, setStatus]);

  const closeReferenceCompare = useCallback(() => {
    clearReferenceCompare();
    setStatus("Reference closed");
  }, [clearReferenceCompare, setStatus]);

  return {
    closeReferenceCompare,
    openReferenceFile,
    openTextPathAsReference,
    referenceCopy: copy,
  };
}
