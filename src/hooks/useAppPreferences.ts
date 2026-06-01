import { useEffect, useState } from "react";
import type { AgentWorkbenchProvider } from "../tauri";
import type { AmbientIntensity } from "../types";
import { clampNumber } from "../utils";
import {
  AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
  AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
  AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
  EDITOR_SETTINGS_STORAGE_KEY,
  MENU_LANGUAGE_STORAGE_KEY,
  PREVIEW_VISIBLE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type BaseTheme,
  type EditorSettings,
  type MenuLanguage,
  type ResolvedTheme,
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
  const [systemTheme, setSystemTheme] = useState<BaseTheme>(() =>
    readSystemTheme(),
  );
  const [agentWorkbenchActive] = useState(() =>
    readStoredAgentWorkbenchEnabled(),
  );
  const [agentWorkbenchPreference, setAgentWorkbenchPreference] = useState(() =>
    readStoredAgentWorkbenchEnabled(),
  );
  const [agentWorkbenchConsent, setAgentWorkbenchConsent] = useState(() =>
    readStoredAgentWorkbenchConsent(),
  );
  const [agentWorkbenchProvider, setAgentWorkbenchProvider] =
    useState<AgentWorkbenchProvider>(() => readStoredAgentWorkbenchProvider());

  const resolvedTheme: ResolvedTheme =
    themePreference === "system" ? systemTheme : themePreference;
  const editorTheme: BaseTheme =
    resolvedTheme === "dark" || resolvedTheme === "yakou" ? "dark" : "light";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

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

  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_ENABLED_STORAGE_KEY,
      agentWorkbenchPreference ? "true" : "false",
    );
  }, [agentWorkbenchPreference]);

  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_CONSENT_STORAGE_KEY,
      agentWorkbenchConsent ? "true" : "false",
    );
  }, [agentWorkbenchConsent]);

  useEffect(() => {
    window.localStorage.setItem(
      AGENT_WORKBENCH_PROVIDER_STORAGE_KEY,
      agentWorkbenchProvider,
    );
  }, [agentWorkbenchProvider]);

  return {
    agentWorkbenchActive,
    agentWorkbenchConsent,
    agentWorkbenchPreference,
    agentWorkbenchProvider,
    editorSettings,
    editorTheme,
    menuLanguage,
    previewVisible,
    resolvedTheme,
    setAgentWorkbenchConsent,
    setAgentWorkbenchPreference,
    setAgentWorkbenchProvider,
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
    value === "system" ||
    value === "sakura" ||
    value === "yakou" ||
    value === "shokou" ||
    value === "kouyou"
  ) {
    return value;
  }

  return "system";
}

function readStoredMenuLanguage(): MenuLanguage {
  return window.localStorage.getItem(MENU_LANGUAGE_STORAGE_KEY) === "ja"
    ? "ja"
    : "en";
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

function readStoredAgentWorkbenchEnabled(): boolean {
  return (
    window.localStorage.getItem(AGENT_WORKBENCH_ENABLED_STORAGE_KEY) === "true"
  );
}

function readStoredAgentWorkbenchConsent(): boolean {
  return (
    window.localStorage.getItem(AGENT_WORKBENCH_CONSENT_STORAGE_KEY) === "true"
  );
}

function readStoredAgentWorkbenchProvider(): AgentWorkbenchProvider {
  const value = window.localStorage.getItem(AGENT_WORKBENCH_PROVIDER_STORAGE_KEY);

  return value === "opencode" || value === "pi" ? value : "codex";
}

function readSystemTheme(): BaseTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
