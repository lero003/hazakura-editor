import type { MediaImageAccessOptions } from "../../features/editor/imagePolicy";
import type { EditorTab } from "../../types";
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
}: UseDocumentPersistenceOptions) {
  const exportActions = useDocumentExport({
    activeContents,
    activeTab,
    setGlobalError,
    setStatus,
    workspaceRootPath,
    materializeImagesOnExport,
    mediaAccess,
  });

  useAutoBackup({
    enabled: autoBackupEnabled,
    tabs,
    workspaceRootPath,
  });

  return exportActions;
}
