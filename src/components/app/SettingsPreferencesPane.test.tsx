import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getLModeCopy, getPreferencesCopy } from "../../lib/locale";
import {
  AUTO_BACKUP_USER_CHOICE_STORAGE_KEY,
  type EditorSettings,
} from "../../types";

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
  window.localStorage.clear();
});

function editorSettings(
  overrides: Partial<EditorSettings> = {},
): EditorSettings {
  return {
    wrapLines: true,
    showInvisibles: false,
    editorFontSize: 14,
    previewFontSize: 15,
    workspaceFontSize: 13,
    lModeFontSize: 15,
    tabSize: 2,
    spellcheckEnabled: true,
    autoBackupEnabled: true,
    ambientIntensity: "normal",
    appleAssistDiffInitiallyOpen: true,
    lModeEnabled: false,
    lModeTypewriter: false,
    ...overrides,
  };
}

describe("SettingsPreferencesPane", () => {
  it("updates the Hazakura Local Assist diff default-open preference", () => {
    const onEditorSettingsChange = vi.fn();
    const { container } = render(
      <SettingsPreferencesPane
        copy={getPreferencesCopy("en")}
        editorSettings={editorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={onEditorSettingsChange}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    // The toggle for "Open Hazakura Local Assist diff automatically" is the
    // third toggle in the application section (after previewPane and
    // autoBackup). The label wraps the checkbox input and its visual
    // slider. Find the label by its text content and click it.
    const labels = container.querySelectorAll('label.toggle-switch');
    let appleAssistLabel: HTMLLabelElement | null = null;
    for (const label of Array.from(labels)) {
      if (label.textContent?.includes("Open Hazakura Local Assist diff")) {
        appleAssistLabel = label as HTMLLabelElement;
        break;
      }
    }
    expect(appleAssistLabel).not.toBeNull();
    fireEvent.click(appleAssistLabel!);

    expect(onEditorSettingsChange).toHaveBeenCalledTimes(1);
    const updater = onEditorSettingsChange.mock.calls[0][0];
    expect(updater(editorSettings())).toEqual(
      editorSettings({ appleAssistDiffInitiallyOpen: false }),
    );
  });

  it("keeps the Hazakura Local Assist diff preference in the App Store distribution lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");
    const { container } = render(
      <SettingsPreferencesPane
        copy={getPreferencesCopy("en")}
        editorSettings={editorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    expect(container.textContent).toContain("Hazakura Local Assist");
    expect(container.textContent).toContain(
      "Open Hazakura Local Assist diff automatically",
    );
  });

  it("records an explicit user choice when toggling auto-backup", () => {
    const onEditorSettingsChange = vi.fn();
    const copy = getPreferencesCopy("en");
    const { getByTestId } = render(
      <SettingsPreferencesPane
        copy={copy}
        editorSettings={editorSettings({ autoBackupEnabled: false })}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={onEditorSettingsChange}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    const autoBackupInput = getByTestId("auto-backup-toggle") as HTMLInputElement;
    expect(autoBackupInput.checked).toBe(false);

    fireEvent.click(autoBackupInput);

    expect(window.localStorage.getItem(AUTO_BACKUP_USER_CHOICE_STORAGE_KEY)).toBe("true");
    const updater = onEditorSettingsChange.mock.calls[0][0];
    expect(updater(editorSettings({ autoBackupEnabled: false }))).toEqual(
      editorSettings({ autoBackupEnabled: true }),
    );
  });

  it("renders theme select with visible hint for the selected theme", () => {
    const copy = getPreferencesCopy("en");
    const { container } = render(
      <SettingsPreferencesPane
        copy={copy}
        editorSettings={editorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="sakura"
      />,
    );

    const hint = container.querySelector('[data-testid="theme-hint"]');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe(copy.themeHint("sakura"));
  });

  it("renders theme select for all three languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getPreferencesCopy(lang);
      const { container } = render(
        <SettingsPreferencesPane
          copy={copy}
          editorSettings={editorSettings()}
          lModeCopy={getLModeCopy(lang)}
          menuLanguage={lang}
          onEditorSettingsChange={vi.fn()}
          onMenuLanguageChange={vi.fn()}
          onPreviewVisibleChange={vi.fn()}
          onThemePreferenceChange={vi.fn()}
          previewVisible={true}
          themePreference="yakou"
        />,
      );

      const hint = container.querySelector('[data-testid="theme-hint"]');
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toBe(copy.themeHint("yakou"));
    }
  });

  it("renders the menu language hint below the menu language select", () => {
    const copy = getPreferencesCopy("en");
    const { container } = render(
      <SettingsPreferencesPane
        copy={copy}
        editorSettings={editorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    const hint = container.querySelector('[data-testid="menu-language-hint"]');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe(copy.menuLanguageHint);
  });

  it("renders the menu language hint in all three languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getPreferencesCopy(lang);
      const { container } = render(
        <SettingsPreferencesPane
          copy={copy}
          editorSettings={editorSettings()}
          lModeCopy={getLModeCopy(lang)}
          menuLanguage={lang}
          onEditorSettingsChange={vi.fn()}
          onMenuLanguageChange={vi.fn()}
          onPreviewVisibleChange={vi.fn()}
          onThemePreferenceChange={vi.fn()}
          previewVisible={true}
          themePreference="light"
        />,
      );

      const hint = container.querySelector('[data-testid="menu-language-hint"]');
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toBe(copy.menuLanguageHint);
    }
  });

  it("toggles spellcheckEnabled from the preferences pane", () => {
    // Spellcheck はエディタ Quick Settings だけでなく設定ペインからも切り替えられる。
    // 表示/編集系の設定が一箇所に集約されていることを固定する。
    const onEditorSettingsChange = vi.fn();
    const { container } = render(
      <SettingsPreferencesPane
        copy={getPreferencesCopy("en")}
        editorSettings={editorSettings({ spellcheckEnabled: true })}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={onEditorSettingsChange}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    const labels = container.querySelectorAll("label.toggle-switch");
    let spellcheckLabel: HTMLLabelElement | null = null;
    for (const label of Array.from(labels)) {
      if (label.textContent?.includes("Spellcheck")) {
        spellcheckLabel = label as HTMLLabelElement;
        break;
      }
    }
    expect(spellcheckLabel).not.toBeNull();
    const input = spellcheckLabel!.querySelector(
      "input[type=checkbox]",
    ) as HTMLInputElement;
    expect(input.checked).toBe(true);

    // spellcheck の onChange は現在の editorSettings.spellcheckEnabled を
    // 反転させる (autoBackup トグルと同じ実装)。input を直接 click する。
    fireEvent.click(input);

    expect(onEditorSettingsChange).toHaveBeenCalledTimes(1);
    const updater = onEditorSettingsChange.mock.calls[0][0];
    // 現在 spellcheckEnabled: true → トグルで false に反転する
    expect(updater(editorSettings({ spellcheckEnabled: true }))).toEqual(
      editorSettings({ spellcheckEnabled: false }),
    );
  });

});
