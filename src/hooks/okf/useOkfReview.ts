import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import {
  analyzeDiscoveryResult,
  type OkfReviewResult,
} from "../../features/okf";
import { isDirty } from "../../features/editor/editorTabs";
import { getOkfReviewCopy } from "../../lib/locale/okfReview";
import {
  cancelOkfBundleScan,
  scanOkfBundle,
} from "../../lib/tauri/okf";
import { normalizeAbsolutePath } from "../../lib/utils";
import type { EditorTab, MenuLanguage } from "../../types";

/** Convert a UTF-16 code-unit offset into a 1-based line number. */
export function offsetToOneBasedLine(text: string, offset: number): number {
  if (!Number.isFinite(offset) || offset <= 0) {
    return 1;
  }
  const clamped = Math.min(Math.max(0, Math.trunc(offset)), text.length);
  let line = 1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line += 1;
    }
  }
  return line;
}

export type UseOkfReviewOptions = {
  editorPaneRef?: RefObject<EditorPaneHandle | null>;
  menuLanguage: MenuLanguage;
  openWorkspaceFile: (path: string) => Promise<void>;
  setStatus: (status: string) => void;
  tabs: readonly EditorTab[];
  workspaceRootPath: string | null;
};

export type UseOkfReviewResult = {
  closeOkfReview: () => void;
  isOkfPathDirty: (relativePath: string) => boolean;
  okfBundleRoot: string | null;
  okfCancelRequested: boolean;
  okfReviewError: string | null;
  okfReviewRerunError: string | null;
  okfReviewResult: OkfReviewResult | null;
  okfReviewVisible: boolean;
  okfScanning: boolean;
  openOkfConcept: (relativePath: string, sourceOffset?: number) => void;
  openOkfReview: (bundleRoot?: string | null) => void;
  rerunOkfReview: () => void;
  requestCancelOkfReview: () => void;
  resolveOkfAbsolutePath: (relativePath: string) => string | null;
};

export function useOkfReview({
  editorPaneRef,
  menuLanguage,
  openWorkspaceFile,
  setStatus,
  tabs,
  workspaceRootPath,
}: UseOkfReviewOptions): UseOkfReviewResult {
  const [okfReviewVisible, setOkfReviewVisible] = useState(false);
  const [okfScanning, setOkfScanning] = useState(false);
  const [okfCancelRequested, setOkfCancelRequested] = useState(false);
  const [okfReviewResult, setOkfReviewResult] = useState<OkfReviewResult | null>(
    null,
  );
  const [okfReviewError, setOkfReviewError] = useState<string | null>(null);
  const [okfReviewRerunError, setOkfReviewRerunError] = useState<string | null>(
    null,
  );
  /** Last requested root (set on open/rerun even if the scan fails). */
  const [okfBundleRoot, setOkfBundleRoot] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const resultRef = useRef<OkfReviewResult | null>(null);
  const scanWorkspaceRootRef = useRef<string | null>(null);
  const jumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  resultRef.current = okfReviewResult;

  const copy = getOkfReviewCopy(menuLanguage);

  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current != null) {
        clearTimeout(jumpTimeoutRef.current);
        jumpTimeoutRef.current = null;
      }
    };
  }, []);

  const runScan = useCallback(
    async (workspaceRoot: string, bundleRoot: string) => {
      const seq = ++requestSeqRef.current;
      setOkfScanning(true);
      setOkfCancelRequested(false);
      setOkfReviewError(null);
      setOkfReviewRerunError(null);
      setOkfBundleRoot(bundleRoot);
      setStatus(copy.statusStarted);

      try {
        const discovery = await scanOkfBundle(workspaceRoot, bundleRoot);
        if (requestSeqRef.current !== seq) {
          return;
        }
        const analyzed = analyzeDiscoveryResult(discovery, {
          bundleRootLabel: discovery.bundleRoot || bundleRoot,
        });
        setOkfReviewResult(analyzed);
        // Prefer the canonical path returned by discovery.
        if (discovery.bundleRoot) {
          setOkfBundleRoot(discovery.bundleRoot);
        }
        setStatus(copy.statusDone);
      } catch (error: unknown) {
        if (requestSeqRef.current !== seq) {
          return;
        }
        const message = String(error);
        if (resultRef.current) {
          // Keep the previous usable result visible on a failed rerun.
          setOkfReviewRerunError(message);
        } else {
          setOkfReviewError(message);
        }
        setStatus(copy.statusFailed);
      } finally {
        if (requestSeqRef.current === seq) {
          setOkfScanning(false);
          setOkfCancelRequested(false);
        }
      }
    },
    [copy.statusDone, copy.statusFailed, copy.statusStarted, setStatus],
  );

  const openOkfReview = useCallback(
    (bundleRoot?: string | null) => {
      if (!workspaceRootPath) {
        setStatus(copy.statusNoWorkspace);
        return;
      }
      if (okfReviewVisible) {
        // Palette activation can overlap the already-open panel. Keep its
        // current root/result (and any active backend scan) instead of starting
        // a second review with mismatched root and stale visible results.
        return;
      }
      const root = (bundleRoot && bundleRoot.trim()) || workspaceRootPath;
      scanWorkspaceRootRef.current = normalizeAbsolutePath(workspaceRootPath);
      setOkfReviewVisible(true);
      void runScan(workspaceRootPath, root);
    },
    [
      copy.statusNoWorkspace,
      okfReviewVisible,
      runScan,
      setStatus,
      workspaceRootPath,
    ],
  );

  const closeOkfReview = useCallback(() => {
    requestSeqRef.current += 1;
    if (jumpTimeoutRef.current != null) {
      clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = null;
    }
    setOkfReviewVisible(false);
    setOkfReviewResult(null);
    setOkfReviewError(null);
    setOkfReviewRerunError(null);
    setOkfBundleRoot(null);
    setOkfScanning(false);
    setOkfCancelRequested(false);
    scanWorkspaceRootRef.current = null;
    void cancelOkfBundleScan().catch(() => {
      // Ignore cancel errors when nothing is running.
    });
  }, []);

  useEffect(() => {
    if (!scanWorkspaceRootRef.current) {
      return;
    }
    const currentWorkspace = workspaceRootPath
      ? normalizeAbsolutePath(workspaceRootPath)
      : null;
    if (currentWorkspace !== scanWorkspaceRootRef.current) {
      closeOkfReview();
    }
  }, [closeOkfReview, workspaceRootPath]);

  const requestCancelOkfReview = useCallback(() => {
    setOkfCancelRequested(true);
    void cancelOkfBundleScan().catch(() => {
      // Best-effort cancel.
    });
  }, []);

  const rerunOkfReview = useCallback(() => {
    if (!workspaceRootPath || !okfBundleRoot || okfScanning) {
      return;
    }
    void runScan(workspaceRootPath, okfBundleRoot);
  }, [okfBundleRoot, okfScanning, runScan, workspaceRootPath]);

  const resolveOkfAbsolutePath = useCallback(
    (relativePath: string): string | null => {
      if (!okfBundleRoot) {
        return null;
      }
      const trimmed = relativePath.replace(/^\/+/, "");
      const joined = trimmed
        ? `${okfBundleRoot.replace(/\/$/, "")}/${trimmed}`
        : okfBundleRoot;
      return normalizeAbsolutePath(joined);
    },
    [okfBundleRoot],
  );

  const isOkfPathDirty = useCallback(
    (relativePath: string): boolean => {
      const absolute = resolveOkfAbsolutePath(relativePath);
      if (!absolute) {
        return false;
      }
      return tabs.some(
        (tab) =>
          Boolean(tab.path) &&
          isDirty(tab) &&
          normalizeAbsolutePath(tab.path) === absolute,
      );
    },
    [resolveOkfAbsolutePath, tabs],
  );

  const openOkfConcept = useCallback(
    (relativePath: string, sourceOffset?: number) => {
      const absolute = resolveOkfAbsolutePath(relativePath);
      if (!absolute) {
        return;
      }
      void openWorkspaceFile(absolute)
        .then(() => {
          // Keep the result in memory, but move the modal out of the editing
          // path. Invoking the review again performs a fresh disk scan.
          setOkfReviewVisible(false);
          setStatus(copy.statusOpenedForEdit);

          if (
            sourceOffset == null ||
            !Number.isFinite(sourceOffset) ||
            !editorPaneRef
          ) {
            return;
          }

          if (jumpTimeoutRef.current != null) {
            clearTimeout(jumpTimeoutRef.current);
          }
          // Match Global Search: wait a tick so the newly focused tab's
          // CodeMirror view is mounted before jumping.
          jumpTimeoutRef.current = setTimeout(() => {
            jumpTimeoutRef.current = null;
            const doc = editorPaneRef.current?.getActiveDocument();
            if (!doc) {
              return;
            }
            const line = offsetToOneBasedLine(doc.text, sourceOffset);
            editorPaneRef.current?.goToLine(line);
          }, 50);
        })
        .catch(() => {
          // Leave the modal up if the file could not be opened.
        });
    },
    [
      copy.statusOpenedForEdit,
      editorPaneRef,
      openWorkspaceFile,
      resolveOkfAbsolutePath,
      setStatus,
    ],
  );

  return {
    closeOkfReview,
    isOkfPathDirty,
    okfBundleRoot,
    okfCancelRequested,
    okfReviewError,
    okfReviewRerunError,
    okfReviewResult,
    okfReviewVisible,
    okfScanning,
    openOkfConcept,
    openOkfReview,
    rerunOkfReview,
    requestCancelOkfReview,
    resolveOkfAbsolutePath,
  };
}
