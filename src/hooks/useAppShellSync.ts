import type {
  DraftRecord,
  EditorSettings,
  EditorTab,
  ImagePreviewState,
  MenuLanguage,
  RecentEntry,
  ThemePreference,
} from "../types";
import { useAppMenuStateSync } from "./useAppMenuStateSync";
import { useDraftPersistence } from "./document/useDraftPersistence";
import { useThemeMenuStateSync } from "./useThemeMenuStateSync";
import { useWindowTitle } from "./useWindowTitle";
import { useWorkspaceStatePersistence } from "./workspace/useWorkspaceStatePersistence";

type RefValue<T> = {
  current: T;
};

type UseAppShellSyncOptions = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  discardingWindowCloseRef: RefValue<boolean>;
  editorSettings: EditorSettings;
  menuLanguage: MenuLanguage;
  pendingDrafts: DraftRecord[];
  previewVisible: boolean;
  recentFiles: RecentEntry[];
  recentFolders: RecentEntry[];
  restoreComplete: boolean;
  selectedImage: ImagePreviewState | null;
  tabs: EditorTab[];
  themePreference: ThemePreference;
  workspaceRootPath: string | null;
};

export function useAppShellSync({
  activeDirty,
  activeTab,
  agentWorkbenchActive,
  agentWorkbenchConsent,
  discardingWindowCloseRef,
  editorSettings,
  menuLanguage,
  pendingDrafts,
  previewVisible,
  recentFiles,
  recentFolders,
  restoreComplete,
  selectedImage,
  tabs,
  themePreference,
  workspaceRootPath,
}: UseAppShellSyncOptions) {
  useWindowTitle({
    activeDirty,
    activeTab,
    selectedImage,
  });

  useAppMenuStateSync({
    activeDirty,
    activeTab,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    editorSettings,
    menuLanguage,
    previewVisible,
    recentFiles,
    recentFolders,
    themePreference,
  });

  useThemeMenuStateSync(themePreference);

  useWorkspaceStatePersistence({
    activeTab,
    restoreComplete,
    tabs,
    workspaceRootPath,
  });

  useDraftPersistence({
    discardingWindowCloseRef,
    pendingDrafts,
    restoreComplete,
    tabs,
  });
}
