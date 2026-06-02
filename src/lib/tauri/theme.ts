import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";

export async function updateThemeMenuState(
  themePreference: string,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("update_theme_menu_state", { themePreference });
}
