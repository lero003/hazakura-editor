import { useEffect, useState } from "react";
import { setCurrentWindowBackgroundColor, setCurrentWindowTheme } from "../tauri";
import type { AmbientIntensity } from "../types";
import { clampNumber } from "../utils";
import {
  EDITOR_SETTINGS_STORAGE_KEY,
  MENU_LANGUAGE_STORAGE_KEY,
  PREVIEW_VISIBLE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type BaseTheme,
  type EditorSettings,
  type MenuLanguage,
  type ThemePreference,
} from "../types";

export function useAppPreferences() {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readStoredThemePreference(),
  );
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() =>
    readStoredEditorSettings(),
  );
  const [previewVisible, setPreviewVisible] = useState(() =>
    readStoredPreviewVisible(),
  );
  const [menuLanguage, setMenuLanguage] = useState<MenuLanguage>(() =>
    readStoredMenuLanguage(),
  );

  const resolvedTheme = themePreference;
  const editorTheme: BaseTheme =
    resolvedTheme === "dark" || resolvedTheme === "yakou" ? "dark" : "light";

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    const windowTheme: BaseTheme =
      themePreference === "dark" || themePreference === "yakou"
        ? "dark"
        : "light";

    void setCurrentWindowTheme(windowTheme).catch((err) => {
      console.warn("Failed to update window theme", err);
    });
    void setCurrentWindowBackgroundColor(
      windowBackgroundColorForTheme(themePreference),
    ).catch((err) => {
      console.warn("Failed to update window background color", err);
    });
  }, [themePreference]);

  useEffect(() => {
    window.localStorage.setItem(
      PREVIEW_VISIBLE_STORAGE_KEY,
      previewVisible ? "true" : "false",
    );
  }, [previewVisible]);

  useEffect(() => {
    window.localStorage.setItem(
      EDITOR_SETTINGS_STORAGE_KEY,
      JSON.stringify(editorSettings),
    );
  }, [editorSettings]);

  useEffect(() => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, menuLanguage);
  }, [menuLanguage]);

  return {
    editorSettings,
    editorTheme,
    menuLanguage,
    previewVisible,
    resolvedTheme,
    setEditorSettings,
    setMenuLanguage,
    setPreviewVisible,
    setThemePreference,
    themePreference,
  };
}

function readStoredThemePreference(): ThemePreference {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (
    value === "light" ||
    value === "dark" ||
    value === "sakura" ||
    value === "yakou" ||
    value === "shokou" ||
    value === "kouyou"
  ) {
    return value;
  }

  return readSystemTheme();
}

function windowBackgroundColorForTheme(theme: ThemePreference): string {
  switch (theme) {
    case "dark":
      return "#0f1412";
    case "sakura":
      return "#f8f1f3";
    case "yakou":
      return "#0d0d12";
    case "shokou":
      return "#eef7ff";
    case "kouyou":
      return "#f7efe4";
    case "light":
    default:
      return "#f3f6f4";
  }
}

function readStoredMenuLanguage(): MenuLanguage {
  const value = window.localStorage.getItem(MENU_LANGUAGE_STORAGE_KEY);

  return value === "ja" || value === "kana" ? value : "en";
}

function readStoredPreviewVisible(): boolean {
  return window.localStorage.getItem(PREVIEW_VISIBLE_STORAGE_KEY) !== "false";
}

function readStoredEditorSettings(): EditorSettings {
  const defaults: EditorSettings = {
    wrapLines: true,
    showInvisibles: false,
    fontSize: 14,
    tabSize: 2,
    spellcheckEnabled: true,
    autoBackupEnabled: true,
    ambientIntensity: "normal",
  };
  const value = window.localStorage.getItem(EDITOR_SETTINGS_STORAGE_KEY);

  if (!value) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(value) as Partial<EditorSettings>;

    return {
      wrapLines:
        typeof parsed.wrapLines === "boolean"
          ? parsed.wrapLines
          : defaults.wrapLines,
      showInvisibles:
        typeof parsed.showInvisibles === "boolean"
          ? parsed.showInvisibles
          : defaults.showInvisibles,
      fontSize: clampNumber(parsed.fontSize, 12, 22, defaults.fontSize),
      tabSize: [2, 4, 8].includes(Number(parsed.tabSize))
        ? Number(parsed.tabSize)
        : defaults.tabSize,
      spellcheckEnabled:
        typeof parsed.spellcheckEnabled === "boolean"
          ? parsed.spellcheckEnabled
          : defaults.spellcheckEnabled,
      autoBackupEnabled:
        typeof parsed.autoBackupEnabled === "boolean"
          ? parsed.autoBackupEnabled
          : defaults.autoBackupEnabled,
      ambientIntensity: isAmbientIntensity(parsed.ambientIntensity)
        ? parsed.ambientIntensity
        : defaults.ambientIntensity,
    };
  } catch {
    return defaults;
  }
}

function isAmbientIntensity(value: unknown): value is AmbientIntensity {
  return (
    value === "off" ||
    value === "subtle" ||
    value === "normal" ||
    value === "dramatic"
  );
}

function readSystemTheme(): BaseTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
