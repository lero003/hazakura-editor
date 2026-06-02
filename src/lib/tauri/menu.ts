import { invoke } from "@tauri-apps/api/core";
import type { MenuLanguage, ThemePreference } from "../../types";
import { isTauriRuntime } from "./_runtime";

export type AppMenuRecentItem = {
  label: string;
};

export type AppMenuState = {
  hasActiveTab: boolean;
  activeDirty: boolean;
  previewVisible: boolean;
  wrapLines: boolean;
  showInvisibles: boolean;
  spellcheckEnabled: boolean;
  themePreference: ThemePreference;
  menuLanguage: MenuLanguage;
  recentFiles: AppMenuRecentItem[];
  recentFolders: AppMenuRecentItem[];
  agentWorkbenchActive: boolean;
  agentWorkbenchConsent: boolean;
};

export async function updateAppMenuState(state: AppMenuState): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("update_app_menu_state", { state });
}
