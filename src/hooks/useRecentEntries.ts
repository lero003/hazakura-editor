import { useCallback, useState } from "react";
import {
  readStoredRecentFiles,
  readStoredRecentFolders,
  upsertRecentEntry,
} from "../storage";
import type { RecentEntry } from "../types";
import { fileNameFromPath, folderLabelFromPath } from "../utils";
import { useLatestValueRef } from "./useLatestValueRef";
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

  return {
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
  };
}
