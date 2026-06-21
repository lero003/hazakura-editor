import type {
  DraftRecord,
  EditorSettings,
  EditorTab,
  AssistSurfacePreference,
  ImagePreviewState,
  MenuLanguage,
  RecentEntry,
  ThemePreference,
} from "../../types";
import { useAppMenuStateSync } from "./useAppMenuStateSync";
import { useDraftPersistence } from "../document/useDraftPersistence";
import { useThemeMenuStateSync } from "./useThemeMenuStateSync";
import { useWindowTitle } from "./useWindowTitle";
import { useWorkspaceStatePersistence } from "../workspace/useWorkspaceStatePersistence";

type RefValue<T> = {
  current: T;
};

type UseAppShellSyncOptions = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  discardingWindowCloseRef: RefValue<boolean>;
  editorSettings: EditorSettings;
  menuLanguage: MenuLanguage;
  onStatus?: (message: string) => void;
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
  assistSurfaceActive,
  discardingWindowCloseRef,
  editorSettings,
  menuLanguage,
  onStatus,
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
    onStatus,
  });

  useAppMenuStateSync({
    activeDirty,
    activeTab,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    assistSurfaceActive,
    editorSettings,
    menuLanguage,
    onStatus,
    previewVisible,
    recentFiles,
    recentFolders,
    themePreference,
  });

  useThemeMenuStateSync(themePreference, { onStatus });

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
