import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getLModeCopy, getPreferencesCopy } from "../../lib/locale";
import type { EditorSettings } from "../../types";

function editorSettings(
  overrides: Partial<EditorSettings> = {},
): EditorSettings {
  return {
    wrapLines: true,
    showInvisibles: false,
    fontSize: 14,
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
  it("updates the Apple Assist diff default-open preference", () => {
    const onEditorSettingsChange = vi.fn();
    render(
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

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Open Apple Assist diff automatically/,
      }),
    );

    expect(onEditorSettingsChange).toHaveBeenCalledTimes(1);
    const updater = onEditorSettingsChange.mock.calls[0][0];
    expect(updater(editorSettings())).toEqual(
      editorSettings({ appleAssistDiffInitiallyOpen: false }),
    );
  });
});
