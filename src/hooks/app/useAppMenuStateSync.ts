import { useEffect } from "react";
import { updateAppMenuState, type AppMenuRecentItem } from "../../lib/tauri";
import type {
  EditorSettings,
  MenuLanguage,
  RecentEntry,
  ThemePreference,
} from "../../types";
import { buildRecentDisplayEntries } from "../../lib/utils";

type UseAppMenuStateSyncOptions = {
  activeDirty: boolean;
  activeTab: unknown | null;
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
  editorSettings: Pick<
    EditorSettings,
    "showInvisibles" | "spellcheckEnabled" | "wrapLines"
  >;
  menuLanguage: MenuLanguage;
  previewVisible: boolean;
  recentFiles: RecentEntry[];
  recentFolders: RecentEntry[];
  themePreference: ThemePreference;
};

export function useAppMenuStateSync({
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
      spellcheckEnabled: editorSettings.spellcheckEnabled,
      themePreference,
      menuLanguage,
      recentFiles: menuRecentFiles,
      recentFolders: menuRecentFolders,
      agentWorkbenchActive,
      agentWorkbenchConsent,
    }).catch((err) => {
      console.warn("Failed to update app menu state", err);
    });
  }, [
    activeDirty,
    activeTab,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    editorSettings.showInvisibles,
    editorSettings.spellcheckEnabled,
    editorSettings.wrapLines,
    menuLanguage,
    previewVisible,
    recentFiles,
    recentFolders,
    themePreference,
  ]);
}
