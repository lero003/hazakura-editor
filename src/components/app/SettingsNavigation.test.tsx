import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getPreferencesCopy, getLModeCopy } from "../../lib/locale";
import { defaultEditorSettings } from "../../lib/editorSettingsDefaults";
afterEach(cleanup);
it.each(["en", "ja", "kana"] as const)("category navigation preserves controls and moves focus (%s)", (language) => {
  const copy = getPreferencesCopy(language), update = vi.fn();
  render(<SettingsPreferencesPane copy={copy} lModeCopy={getLModeCopy(language)}
    menuLanguage={language} editorSettings={defaultEditorSettings()}
    themePreference="light" previewVisible onEditorSettingsChange={update}
    onMenuLanguageChange={vi.fn()} onPreviewVisibleChange={vi.fn()} onThemePreferenceChange={vi.fn()} />);
  const original = screen.getByRole("spinbutton", { name: copy.editorFontSize });
  for (const name of [copy.editor, copy.mediaAndDisplay, copy.application, copy.appearanceAndWriting]) {
    fireEvent.click(screen.getByRole("button", { name }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name, level: 3 }));
    expect(screen.getByRole("spinbutton", { name: copy.editorFontSize })).toBe(original);
  }
  expect(update).not.toHaveBeenCalled();
});
