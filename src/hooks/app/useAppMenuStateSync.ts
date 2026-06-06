import { useEffect, useRef } from "react";
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
    "lModeEnabled" | "showInvisibles" | "spellcheckEnabled" | "wrapLines"
  >;
  menuLanguage: MenuLanguage;
  /**
   * Optional status callback. Used to surface the IPC
   * `updateAppMenuState` failure through the existing
   * status bar instead of dropping it into the console
   * only. The status string goes through
   * `localizeStatusMessage`, so callers should pass the
   * raw English key.
   */
  onStatus?: (message: string) => void;
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
  onStatus,
  previewVisible,
  recentFiles,
  recentFolders,
  themePreference,
}: UseAppMenuStateSyncOptions) {
  // Keep the latest `onStatus` callback in a ref so the
  // menu-sync effect does not have to re-run every time the
  // caller passes a fresh function reference.
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

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
      lModeEnabled: editorSettings.lModeEnabled,
      themePreference,
      menuLanguage,
      recentFiles: menuRecentFiles,
      recentFolders: menuRecentFolders,
      agentWorkbenchActive,
      agentWorkbenchConsent,
    }).catch((err) => {
      console.warn("Failed to update app menu state", err);
      onStatusRef.current?.("Failed to update app menu state");
    });
  }, [
    activeDirty,
    activeTab,
    agentWorkbenchActive,
    agentWorkbenchConsent,
    editorSettings.lModeEnabled,
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
