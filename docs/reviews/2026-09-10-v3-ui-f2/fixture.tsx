// Real settings controls; local state only, no native services or persistence.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPreferencesPane } from "../../../src/components/app/SettingsPreferencesPane";
import { PreferencesDialog } from "../../../src/components/app/PreferencesDialog";
import { getPreferencesCopy, getLModeCopy } from "../../../src/lib/locale";
import { defaultEditorSettings } from "../../../src/lib/editorSettingsDefaults";
import { PrivacyPreferencesPane } from "../../../src/components/app/PrivacyPreferencesPane";
import { helpDocsByMode, isHelpDocumentDialogMode } from "../../../src/components/app/helpDocs";
import type { ThemePreference, PreferencesDialogMode } from "../../../src/types";
import "../../../src/styles/index.css";
function Fixture() {
  const [mode, setMode] = useState<PreferencesDialogMode>("settings");
  const doc = isHelpDocumentDialogMode(mode) ? helpDocsByMode[mode] : null;
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [settings, setSettings] = useState(defaultEditorSettings());
  const [preview, setPreview] = useState(true), [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLElement>(null), closeButtonRef = useRef<HTMLButtonElement>(null);
  document.documentElement.dataset.theme = theme;
  return open ? <PreferencesDialog title={doc?.title ?? "設定"} mode={mode} onChangeMode={setMode} closeLabel="閉じる"
    dialogRef={dialogRef} closeButtonRef={closeButtonRef} onClose={() => setOpen(false)}>
    {doc ? <PrivacyPreferencesPane key={doc.id} doc={doc} /> : <SettingsPreferencesPane copy={getPreferencesCopy("ja")} lModeCopy={getLModeCopy("ja")}
      editorSettings={settings} onEditorSettingsChange={setSettings} menuLanguage="ja"
      onMenuLanguageChange={() => {}} previewVisible={preview} onPreviewVisibleChange={setPreview}
      themePreference={theme} onThemePreferenceChange={setTheme} />}
  </PreferencesDialog> : <button onClick={() => setOpen(true)}>設定を開く</button>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
