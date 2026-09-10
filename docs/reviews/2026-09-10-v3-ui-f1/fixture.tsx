// Real settings controls; local state only, no native services or persistence.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPreferencesPane } from "../../../src/components/app/SettingsPreferencesPane";
import { PreferencesDialog } from "../../../src/components/app/PreferencesDialog";
import { getPreferencesCopy, getLModeCopy } from "../../../src/lib/locale";
import { defaultEditorSettings } from "../../../src/lib/editorSettingsDefaults";
import type { ThemePreference } from "../../../src/types";
import "../../../src/styles/index.css";
function Fixture() {
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [settings, setSettings] = useState(defaultEditorSettings());
  const [preview, setPreview] = useState(true), [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLElement>(null), closeButtonRef = useRef<HTMLButtonElement>(null);
  document.documentElement.dataset.theme = theme;
  return open ? <PreferencesDialog title="設定" mode="settings" closeLabel="閉じる"
    dialogRef={dialogRef} closeButtonRef={closeButtonRef} onClose={() => setOpen(false)}>
    <SettingsPreferencesPane copy={getPreferencesCopy("ja")} lModeCopy={getLModeCopy("ja")}
      editorSettings={settings} onEditorSettingsChange={setSettings} menuLanguage="ja"
      onMenuLanguageChange={() => {}} previewVisible={preview} onPreviewVisibleChange={setPreview}
      themePreference={theme} onThemePreferenceChange={setTheme} />
  </PreferencesDialog> : <button onClick={() => setOpen(true)}>設定を開く</button>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
