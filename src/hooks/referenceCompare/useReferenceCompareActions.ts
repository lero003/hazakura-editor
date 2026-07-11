import { useCallback, useRef } from "react";
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
  getReferenceFileMetadata,
  openImageFile,
  openPdfReference,
  openTextFile,
  openWorkspaceImage,
  pickReferenceFile,
} from "../../lib/tauri";
import {
  isTextReferenceWithinBudget,
} from "../../features/referenceCompare/textReferenceBudget";
import { fileNameFromPath, isPathInsideDirectory } from "../../lib/utils";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import type { EditorTab, MenuLanguage } from "../../types";

type SetReferenceDocument = (
  reference: ReferenceCompareState["reference"],
  options?: {
    origin?: ReferenceCompareState["origin"];
    linkedEditorSessionId?: string | null;
    followMode?: ReferenceFollowMode;
    sourceFingerprint?: string | null;
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

/** Fingerprint via regular-file metadata (works for binary PDF/image). */
async function fingerprintForPath(path: string): Promise<string | null> {
  try {
    const meta = await getReferenceFileMetadata(path);
    return meta.fingerprint;
  } catch {
    return null;
  }
}

/**
 * Serialize native PDF opens process-wide.
 * Rust ACTIVE is replaced on every successful open; concurrent open_pdf_reference
 * calls can leave the UI holding a later referenceId while a slower earlier open
 * overwrites ACTIVE and is then closed as stale. Queueing prevents that reorder.
 */
let pdfOpenTail: Promise<unknown> = Promise.resolve();

function enqueuePdfOpen<T>(work: () => Promise<T>): Promise<T> {
  const run = pdfOpenTail.then(work, work);
  pdfOpenTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Test helper: drain the PDF open queue between cases. */
export function __resetPdfOpenQueueForTests(): void {
  pdfOpenTail = Promise.resolve();
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
  /**
   * Operation generation: only the latest open/close/replace may apply state.
   * Close clears immediately; in-flight open that loses the generation must
   * not resurrect a closed or replaced reference.
   */
  const operationGenerationRef = useRef(0);

  const openPathAsReference = useCallback(
    async (
      path: string,
      options: {
        persistFileBookmark?: boolean;
        origin?: ReferenceCompareState["origin"];
        linkedEditorSessionId?: string | null;
        followMode?: ReferenceFollowMode;
      } = {},
    ) => {
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

      const generation = ++operationGenerationRef.current;
      setStatus("Opening reference…");
      // Snapshot previous PDF only after a successful open so a failed replace
      // leaves the existing handle usable.
      const previous = referenceCompare;
      const origin = options.origin ?? "manual";
      const linkedEditorSessionId = options.linkedEditorSessionId ?? null;

      try {
        if (options.persistFileBookmark) {
          await createSecurityScopedBookmark(path).catch(() => null);
        }

        if (isPdfReferencePath(path)) {
          // Serialize native open so a slower earlier call cannot rewrite ACTIVE
          // after a newer open already committed. Generation still drops work that
          // was superseded before it reaches the queue head.
          const opened = await enqueuePdfOpen(async () => {
            if (generation !== operationGenerationRef.current) {
              return null;
            }
            // open_pdf_reference replaces ACTIVE only on full success.
            return openPdfReference(path);
          });
          if (!opened) {
            return false;
          }
          if (generation !== operationGenerationRef.current) {
            // Superseded while fingerprinting / after open (e.g. close).
            await closePdfReference(opened.referenceId).catch(() => undefined);
            return false;
          }
          const fingerprint = await fingerprintForPath(path);
          if (generation !== operationGenerationRef.current) {
            await closePdfReference(opened.referenceId).catch(() => undefined);
            return false;
          }
          setReferenceDocument(
            {
              kind: "pdf",
              path,
              name: opened.name || fileNameFromPath(path),
              pageCount: opened.pageCount,
              referenceId: opened.referenceId,
            },
            {
              origin,
              linkedEditorSessionId,
              followMode: options.followMode,
              sourceFingerprint: fingerprint,
            },
          );
          setStatus(`Reference opened: ${opened.name || fileNameFromPath(path)}`);
          return true;
        }

        if (isImageReferencePath(path)) {
          const image =
            workspaceRootPath && isPathInsideDirectory(path, workspaceRootPath)
              ? await openWorkspaceImage(workspaceRootPath, path)
              : await openImageFile(path);
          if (generation !== operationGenerationRef.current) {
            return false;
          }
          const fingerprint = await fingerprintForPath(image.path);
          if (generation !== operationGenerationRef.current) {
            return false;
          }
          // Release previous PDF only after the new reference is ready.
          await releasePdfHandle(previous);
          if (generation !== operationGenerationRef.current) {
            return false;
          }
          setReferenceDocument(
            {
              kind: "image",
              path: image.path,
              name: image.name || fileNameFromPath(image.path),
              url: image.dataUrl,
              size: image.size,
            },
            {
              origin,
              linkedEditorSessionId,
              followMode: options.followMode ?? "off",
              sourceFingerprint: fingerprint,
            },
          );
          setStatus(
            `Reference opened: ${image.name || fileNameFromPath(image.path)}`,
          );
          return true;
        }

        // Text / Markdown
        const file = await openTextFile(path);
        if (generation !== operationGenerationRef.current) {
          return false;
        }
        if (!isTextReferenceWithinBudget(file.contents)) {
          setGlobalError(copy.textBudgetExceeded);
          setStatus("Reference open failed");
          return false;
        }
        // Prefer openTextFile fingerprint; fall back to regular-file metadata.
        const fingerprint =
          file.fingerprint || (await fingerprintForPath(file.path));
        if (generation !== operationGenerationRef.current) {
          return false;
        }
        await releasePdfHandle(previous);
        if (generation !== operationGenerationRef.current) {
          return false;
        }
        setReferenceDocument(
          {
            kind: "text",
            path: file.path,
            name: file.name || fileNameFromPath(file.path),
            contents: file.contents,
            encoding: file.encoding,
          },
          {
            origin,
            linkedEditorSessionId,
            followMode: options.followMode ?? "off",
            sourceFingerprint: fingerprint,
          },
        );
        setStatus(
          `Reference opened: ${file.name || fileNameFromPath(file.path)}`,
        );
        return true;
      } catch (err) {
        if (generation !== operationGenerationRef.current) {
          return false;
        }
        setGlobalError(String(err));
        setStatus("Reference open failed");
        return false;
      }
    },
    [
      activeTab,
      copy.unsupportedType,
      copy.textBudgetExceeded,
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
    // Bump generation so any in-flight open cannot re-apply state after close.
    operationGenerationRef.current += 1;
    const snapshot = referenceCompare;
    // Clear immediately so async PDF release cannot race a later open's state.
    clearReferenceCompare();
    setStatus("Reference closed");
    void releasePdfHandle(snapshot);
  }, [clearReferenceCompare, referenceCompare, setStatus]);

  /**
   * R3: After Import Assist succeeds, open the source as a linked reference
   * beside the unsaved draft. Link key is editor sessionId.
   */
  const pairImportAssistReference = useCallback(
    async (sourcePath: string, editorSessionId: string) => {
      // Non-pdf/image import sources: skip pairing without failing import.
      if (
        !isPdfReferencePath(sourcePath) &&
        !isImageReferencePath(sourcePath)
      ) {
        return false;
      }

      const ok = await openPathAsReference(sourcePath, {
        persistFileBookmark: true,
        origin: "import-assist",
        linkedEditorSessionId: editorSessionId,
        followMode: isPdfReferencePath(sourcePath) ? "following" : "off",
      });
      if (ok) {
        setStatus(
          `Import paired with reference: ${fileNameFromPath(sourcePath)}`,
        );
      } else {
        // Import draft already exists — surface pairing failure without rollback.
        setStatus("Import draft opened; reference pairing failed");
      }
      return ok;
    },
    [openPathAsReference, setStatus],
  );

  /**
   * Explicit reload after external-change notice. Preserves origin/link.
   */
  const reloadReferenceFromDisk = useCallback(async () => {
    if (!referenceCompare) {
      return false;
    }
    const { reference, origin, linkedEditorSessionId, followMode } =
      referenceCompare;
    return openPathAsReference(reference.path, {
      persistFileBookmark: true,
      origin,
      linkedEditorSessionId,
      followMode: followMode === "paused" ? "paused" : followMode,
    });
  }, [openPathAsReference, referenceCompare]);

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
    reloadReferenceFromDisk,
    resumeReferenceFollow,
  };
}
