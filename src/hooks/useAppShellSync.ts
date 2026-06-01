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
import { useDraftPersistence } from "./useDraftPersistence";
import { useThemeMenuStateSync } from "./useThemeMenuStateSync";
import { useWindowTitle } from "./useWindowTitle";
import { useWorkspaceStatePersistence } from "./useWorkspaceStatePersistence";

type RefValue<T> = {
  current: T;
};

type UseAppShellSyncOptions = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
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
  zenMode: boolean;
};

export function useAppShellSync({
  activeDirty,
  activeTab,
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
  zenMode,
}: UseAppShellSyncOptions) {
  useWindowTitle({
    activeDirty,
    activeTab,
    selectedImage,
  });

  useAppMenuStateSync({
    activeDirty,
    activeTab,
    editorSettings,
    menuLanguage,
    previewVisible,
    recentFiles,
    recentFolders,
    themePreference,
    zenMode,
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
