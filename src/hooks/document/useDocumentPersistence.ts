import type { MediaImageAccessOptions } from "../../features/editor/imagePolicy";
import type { EditorTab } from "../../types";
import type {
  BookScopeChapter,
  BookScopeUnavailableEntry,
} from "../../lib/tauri/bookScope";
import { useAutoBackup } from "../workspace/useAutoBackup";
import { useDocumentExport } from "./useDocumentExport";

type UseDocumentPersistenceOptions = {
  activeContents: string;
  activeTab: EditorTab | null;
  autoBackupEnabled: boolean;
  setGlobalError: (message: string | null) => void;
  setStatus: (message: string) => void;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
  materializeImagesOnExport?: boolean;
  mediaAccess?: MediaImageAccessOptions | null;
  bookScopeChapters?: readonly BookScopeChapter[];
  bookScopeUnavailable?: readonly BookScopeUnavailableEntry[];
};

export function useDocumentPersistence({
  activeContents,
  activeTab,
  autoBackupEnabled,
  setGlobalError,
  setStatus,
  tabs,
  workspaceRootPath,
  materializeImagesOnExport,
  mediaAccess,
  bookScopeChapters,
  bookScopeUnavailable,
}: UseDocumentPersistenceOptions) {
  const exportActions = useDocumentExport({
    activeContents,
    activeTab,
    setGlobalError,
    setStatus,
    workspaceRootPath,
    materializeImagesOnExport,
    mediaAccess,
    bookScopeChapters,
    bookScopeUnavailable,
    tabs,
  });

  useAutoBackup({
    enabled: autoBackupEnabled,
    tabs,
    workspaceRootPath,
  });

  return exportActions;
}
