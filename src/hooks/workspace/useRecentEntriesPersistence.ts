import { useEffect } from "react";
import type { RecentEntry } from "../../types";
import {
  writeStoredRecentFiles,
  writeStoredRecentFolders,
} from "../../lib/storage";

type UseRecentEntriesPersistenceOptions = {
  recentFiles: RecentEntry[];
  recentFolders: RecentEntry[];
};

export function useRecentEntriesPersistence({
  recentFiles,
  recentFolders,
}: UseRecentEntriesPersistenceOptions) {
  useEffect(() => {
    writeStoredRecentFiles(recentFiles);
  }, [recentFiles]);

  useEffect(() => {
    writeStoredRecentFolders(recentFolders);
  }, [recentFolders]);
}
