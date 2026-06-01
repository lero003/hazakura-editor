import { useEffect } from "react";
import { updateAppMenuState, type AppMenuRecentItem } from "../tauri";
import type {
  EditorSettings,
  MenuLanguage,
  RecentEntry,
  ThemePreference,
} from "../types";
import { buildRecentDisplayEntries } from "../utils";

type UseAppMenuStateSyncOptions = {
  activeDirty: boolean;
  activeTab: unknown | null;
  editorSettings: Pick<
    EditorSettings,
    "showInvisibles" | "spellcheckEnabled" | "wrapLines"
  >;
  menuLanguage: MenuLanguage;
  previewVisible: boolean;
  recentFiles: RecentEntry[];
  recentFolders: RecentEntry[];
  themePreference: ThemePreference;
  zenMode: boolean;
};

export function useAppMenuStateSync({
  activeDirty,
  activeTab,
  editorSettings,
  menuLanguage,
  previewVisible,
  recentFiles,
  recentFolders,
  themePreference,
  zenMode,
}: UseAppMenuStateSyncOptions) {
  useEffect(() => {
    const menuRecentFiles: AppMenuRecentItem[] = buildRecentDisplayEntries(
      recentFiles,
    ).map((entry) => ({
      label: entry.displayLabel,
    }));
    const menuRecentFolders: AppMenuRecentItem[] = buildRecentDisplayEntries(
      recentFolders,
    ).map((entry) => ({
      label: entry.displayLabel,
    }));

    void updateAppMenuState({
      hasActiveTab: Boolean(activeTab),
      activeDirty,
      previewVisible,
      wrapLines: editorSettings.wrapLines,
      showInvisibles: editorSettings.showInvisibles,
      zenMode,
      spellcheckEnabled: editorSettings.spellcheckEnabled,
      themePreference,
      menuLanguage,
      recentFiles: menuRecentFiles,
      recentFolders: menuRecentFolders,
    }).catch((err) => {
      console.warn("Failed to update app menu state", err);
    });
  }, [
    activeDirty,
    activeTab,
    editorSettings.showInvisibles,
    editorSettings.spellcheckEnabled,
    editorSettings.wrapLines,
    menuLanguage,
    previewVisible,
    recentFiles,
    recentFolders,
    themePreference,
    zenMode,
  ]);
}
