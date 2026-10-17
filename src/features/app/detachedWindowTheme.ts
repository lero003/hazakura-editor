import { THEME_STORAGE_KEY, type ThemePreference } from "../../types";

/**
 * Initial theme for a detached window (Agent / Hazakura Local Assist).
 *
 * Detached windows read the shared localStorage theme directly, applying the
 * same v1.5 "sakura" → v1.6 "edohigan" read-time migration as the main window.
 * The main window later overwrites the stored value, but until it does the
 * detached window must not flash the pre-migration theme.
 */
export function readInitialDetachedWindowTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  const migrated = stored === "sakura" ? "edohigan" : stored;
  return (migrated as ThemePreference) ?? "dark";
}

/**
 * Applies a theme to this window's document element so the CSS variable
 * surface matches the main window. The OS-level window theme is pushed
 * separately (`setAgentWindowTheme` / `setAppleAssistWindowTheme`).
 */
export function applyDetachedWindowThemeToDocument(
  theme: ThemePreference,
): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
}
