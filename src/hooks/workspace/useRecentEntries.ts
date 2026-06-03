import { useCallback, useState } from "react";
import {
  pinRecentEntry,
  readStoredRecentFiles,
  readStoredRecentFolders,
  unpinRecentEntry,
  upsertRecentEntry,
} from "../../lib/storage";
import type { RecentEntry } from "../../types";
import { fileNameFromPath, folderLabelFromPath } from "../../lib/utils";
import { useLatestValueRef } from "../app/useLatestValueRef";
import { useRecentEntriesPersistence } from "./useRecentEntriesPersistence";

export function useRecentEntries() {
  const [recentFiles, setRecentFiles] = useState<RecentEntry[]>(() =>
    readStoredRecentFiles(),
  );
  const [recentFolders, setRecentFolders] = useState<RecentEntry[]>(() =>
    readStoredRecentFolders(),
  );
  const recentFilesRef = useLatestValueRef(recentFiles);
  const recentFoldersRef = useLatestValueRef(recentFolders);

  useRecentEntriesPersistence({
    recentFiles,
    recentFolders,
  });

  const rememberRecentFile = useCallback((path: string) => {
    setRecentFiles((currentEntries) =>
      upsertRecentEntry(currentEntries, path, fileNameFromPath(path)),
    );
  }, []);

  const rememberRecentFolder = useCallback((path: string) => {
    setRecentFolders((currentEntries) =>
      upsertRecentEntry(currentEntries, path, folderLabelFromPath(path)),
    );
  }, []);

  // `pinRecentFile` and `unpinRecentFile` are the v0.8 daily-
  // editor affordance: a user can pin a file from the start
  // panel to keep it on top regardless of recency. Pinned
  // entries still count against the recents cap because the
  // cap is a UI memory aid, not a hard quota; in practice
  // users pin one or two daily-driver notes.
  const pinRecentFile = useCallback((path: string) => {
    setRecentFiles((currentEntries) => pinRecentEntry(currentEntries, path));
  }, []);

  const unpinRecentFile = useCallback((path: string) => {
    setRecentFiles((currentEntries) => unpinRecentEntry(currentEntries, path));
  }, []);

  return {
    pinRecentFile,
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
    setRecentFiles,
    setRecentFolders,
    unpinRecentFile,
  };
}
