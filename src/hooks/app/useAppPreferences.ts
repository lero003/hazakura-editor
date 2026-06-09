import { useEffect, useRef, useState } from "react";
import {
  setAgentWindowTheme,
  setCurrentWindowBackgroundColor,
  setCurrentWindowTheme,
} from "../../lib/tauri";
import { isExternalCliAssistSurfaceAllowed } from "../../lib/distributionLane";
import themeBackgroundColorJson from "../../lib/theme-palette.json";
import type { AmbientIntensity } from "../../types";
import { clampNumber } from "../../lib/utils";
import { LMODE_SETTINGS_DEFAULTS, parseLModeSettings } from "../../features/editor/lMode/settings";
import {
  EDITOR_SETTINGS_STORAGE_KEY,
  AUTO_BACKUP_USER_CHOICE_STORAGE_KEY,
  MENU_LANGUAGE_STORAGE_KEY,
  PREVIEW_VISIBLE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type BaseTheme,
  type EditorSettings,
  type MenuLanguage,
  type ThemePreference,
} from "../../types";

export type UseAppPreferencesOptions = {
  /**
   * Optional status callback. Used to surface theme-related
   * IPC failures (window theme / background color / agent
   * window theme) through the existing status bar instead
   * of dropping them into the console only. The status
   * string goes through `localizeStatusMessage`, so callers
   * should pass the raw English key.
   */
  onStatus?: (message: string) => void;
};

export function useAppPreferences(options: UseAppPreferencesOptions = {}) {
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

  // Keep the latest `onStatus` callback in a ref so the
  // theme-sync effect does not have to re-run every time the
  // caller passes a fresh function reference.
  const onStatusRef = useRef(options.onStatus);
  useEffect(() => {
    onStatusRef.current = options.onStatus;
  }, [options.onStatus]);

  const resolvedTheme = themePreference;
  const editorTheme: BaseTheme =
    resolvedTheme === "dark" || resolvedTheme === "yakou" ? "dark" : "light";

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    document.documentElement.dataset.lMode = editorSettings.lModeEnabled
      ? "on"
      : "off";
  }, [editorSettings.lModeEnabled]);

  // Mirror the per-surface font sizes onto `:root` CSS
  // custom properties. Each surface (preview, workspace,
  // L Mode) reads its own variable so the user can tune
  // them independently from the editor pane. The editor
  // pane itself is sized through the CodeMirror theme
  // function in `EditorPane`, but the variable is also
  // written for consistency and to let other surfaces
  // compose against it if needed.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--editor-font-size",
      `${editorSettings.editorFontSize}px`,
    );
    root.style.setProperty(
      "--preview-font-size",
      `${editorSettings.previewFontSize}px`,
    );
    root.style.setProperty(
      "--workspace-font-size",
      `${editorSettings.workspaceFontSize}px`,
    );
    root.style.setProperty(
      "--lmode-font-size",
      `${editorSettings.lModeFontSize}px`,
    );
  }, [
    editorSettings.editorFontSize,
    editorSettings.previewFontSize,
    editorSettings.workspaceFontSize,
    editorSettings.lModeFontSize,
  ]);

  useEffect(() => {
    const windowTheme: BaseTheme =
      themePreference === "dark" || themePreference === "yakou"
        ? "dark"
        : "light";

    void setCurrentWindowTheme(windowTheme).catch((err) => {
      console.warn("Failed to update window theme", err);
      onStatusRef.current?.("Failed to update window theme");
    });
    void setCurrentWindowBackgroundColor(
      windowBackgroundColorForTheme(themePreference),
    ).catch((err) => {
      console.warn("Failed to update window background color", err);
      onStatusRef.current?.("Failed to update window background color");
    });
    if (isExternalCliAssistSurfaceAllowed()) {
      // Push the new theme to the agent window (if it is open).
      // App Store lane omits the Agent Workbench surface, so it
      // also skips this Agent-only IPC.
      //
      // v0.15 status-feedback scope: `setAgentWindowTheme`
      // swallows the IPC error internally (logs to
      // `console.warn` and resolves with `void`), so the
      // outer `.catch` does not fire in practice and a
      // status-bar message routed through here would never
      // reach the user. We deliberately do not surface a
      // status message from this site; the window-theme and
      // background-color paths above remain the canonical
      // status-feedback coverage for theme IPC failures.
      void setAgentWindowTheme(themePreference).catch((err) => {
        console.warn("Failed to update Agent window theme", err);
      });
    }
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
    value === "shokou"
  ) {
    return value;
  }

  return readSystemTheme();
}

function windowBackgroundColorForTheme(theme: ThemePreference): string {
  return (
    themeBackgroundColorJson[theme] ??
    themeBackgroundColorJson.dark
  );
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
    editorFontSize: 14,
    previewFontSize: 15,
    workspaceFontSize: 13,
    lModeFontSize: 15,
    tabSize: 2,
    spellcheckEnabled: true,
    autoBackupEnabled: false,
    ambientIntensity: "normal",
    appleAssistDiffInitiallyOpen: true,
    // L Mode defaults are spread in below — keeping the
    // defaults in one place (lMode/settings.ts) so adding a
    // new L Mode toggle is a one-file change.
    ...LMODE_SETTINGS_DEFAULTS,
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
      // Backwards compatibility: v0.15 and earlier stored a
      // single `fontSize` value for the editor pane. v0.16+
      // stores four per-surface values. If the legacy key is
      // present and the new `editorFontSize` is missing,
      // promote the legacy value into the editor slot and
      // fall back to the per-surface defaults for the other
      // three.
      editorFontSize: clampNumber(
        parsed.editorFontSize ??
          (parsed as { fontSize?: unknown }).fontSize,
        12,
        22,
        defaults.editorFontSize,
      ),
      previewFontSize: clampNumber(
        parsed.previewFontSize,
        12,
        24,
        defaults.previewFontSize,
      ),
      workspaceFontSize: clampNumber(
        parsed.workspaceFontSize,
        10,
        18,
        defaults.workspaceFontSize,
      ),
      lModeFontSize: clampNumber(
        parsed.lModeFontSize,
        12,
        24,
        defaults.lModeFontSize,
      ),
      tabSize: [2, 4, 8].includes(Number(parsed.tabSize))
        ? Number(parsed.tabSize)
        : defaults.tabSize,
      spellcheckEnabled:
        typeof parsed.spellcheckEnabled === "boolean"
          ? parsed.spellcheckEnabled
          : defaults.spellcheckEnabled,
      autoBackupEnabled:
        window.localStorage.getItem(AUTO_BACKUP_USER_CHOICE_STORAGE_KEY) === "true" &&
        typeof parsed.autoBackupEnabled === "boolean"
          ? parsed.autoBackupEnabled
          : defaults.autoBackupEnabled,
      ambientIntensity: isAmbientIntensity(parsed.ambientIntensity)
        ? parsed.ambientIntensity
        : defaults.ambientIntensity,
      appleAssistDiffInitiallyOpen:
        typeof parsed.appleAssistDiffInitiallyOpen === "boolean"
          ? parsed.appleAssistDiffInitiallyOpen
          : defaults.appleAssistDiffInitiallyOpen,
      ...parseLModeSettings(parsed),
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
