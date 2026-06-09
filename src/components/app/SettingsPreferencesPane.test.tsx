import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getLModeCopy, getPreferencesCopy } from "../../lib/locale";
import {
  AUTO_BACKUP_USER_CHOICE_STORAGE_KEY,
  type EditorSettings,
} from "../../types";

afterEach(() => {
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
  it("updates the Apple Local Assist diff default-open preference", () => {
    const onEditorSettingsChange = vi.fn();
    const { container } = render(
      <SettingsPreferencesPane
        copy={getPreferencesCopy("en")}
        editorSettings={editorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={onEditorSettingsChange}
        onMenuLanguageChange={vi.fn()}
        onOpenPrivacyPreferences={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    // The toggle for "Open Apple Local Assist diff automatically" is the
    // third toggle in the application section (after previewPane and
    // autoBackup). The label wraps the checkbox input and its visual
    // slider. Find the label by its text content and click it.
    const labels = container.querySelectorAll('label.toggle-switch');
    let appleAssistLabel: HTMLLabelElement | null = null;
    for (const label of Array.from(labels)) {
      if (label.textContent?.includes("Open Apple Local Assist diff")) {
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
        onOpenPrivacyPreferences={vi.fn()}
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
        onOpenPrivacyPreferences={vi.fn()}
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
          onOpenPrivacyPreferences={vi.fn()}
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
        onOpenPrivacyPreferences={vi.fn()}
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
          onOpenPrivacyPreferences={vi.fn()}
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

  it("renders a Privacy & Local Data link that calls onOpenPrivacyPreferences", () => {
    // v0.16 app-store-quality: privacy-local-data slice.
    // The disclosure route must be reachable from the
    // Application section of the Settings dialog (not just
    // from the command palette) so App Review can find it
    // without using the palette.
    const onOpenPrivacyPreferences = vi.fn();
    const copy = getPreferencesCopy("en");
    const { getByTestId } = render(
      <SettingsPreferencesPane
        copy={copy}
        editorSettings={editorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onOpenPrivacyPreferences={onOpenPrivacyPreferences}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    const link = getByTestId("open-privacy-preferences");
    expect(link.textContent).toBe(copy.privacyOpenLink);

    fireEvent.click(link);
    expect(onOpenPrivacyPreferences).toHaveBeenCalledTimes(1);
  });
});
