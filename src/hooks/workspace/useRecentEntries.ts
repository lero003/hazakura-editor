import { useCallback, useState } from "react";
import {
  readStoredRecentFiles,
  readStoredRecentFolders,
  upsertRecentEntry,
} from "../../lib/storage";
import type { RecentEntry } from "../../types";
import { folderLabelFromPath } from "../../lib/utils";
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

  const rememberRecentFile = useCallback((_path: string) => {}, []);

  const rememberRecentFolder = useCallback(
    (path: string, workspaceBookmark?: number[] | null, replacedPath?: string) => {
      setRecentFolders((currentEntries) =>
        upsertRecentEntry(
          replacedPath && replacedPath !== path
            ? currentEntries.filter((entry) => entry.path !== replacedPath)
            : currentEntries,
          path,
          folderLabelFromPath(path),
          workspaceBookmark,
        ),
      );
    },
    [],
  );

  return {
    recentFiles,
    recentFilesRef,
    recentFolders,
    recentFoldersRef,
    rememberRecentFile,
    rememberRecentFolder,
    setRecentFiles,
    setRecentFolders,
  };
}
