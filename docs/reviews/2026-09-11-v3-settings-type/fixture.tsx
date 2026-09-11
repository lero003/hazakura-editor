// 実機指摘⑩⑪（エディタ設定の「静かな一ページ」と、文字サイズが1行取る件）の証跡。
// 実コンポーネント（PreferencesDialog + SettingsPreferencesPane）をローカル状態だけで描く。
// ネイティブサービス・永続化は呼ばない。  ?theme=light|dark
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPreferencesPane } from "../../../src/components/app/SettingsPreferencesPane";
import { PreferencesDialog } from "../../../src/components/app/PreferencesDialog";
import { getPreferencesCopy, getLModeCopy } from "../../../src/lib/locale";
import { defaultEditorSettings } from "../../../src/lib/editorSettingsDefaults";
import type { ThemePreference, PreferencesDialogMode } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const theme = (params.get("theme") ?? "light") as ThemePreference;

function Fixture() {
  const [mode, setMode] = useState<PreferencesDialogMode>("settings");
  const [settings, setSettings] = useState(defaultEditorSettings());
  const [preview, setPreview] = useState(true);
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  document.documentElement.dataset.theme = theme;
  if (!open) {
    return <button onClick={() => setOpen(true)}>設定を開く</button>;
  }
  return (
    <PreferencesDialog
      closeButtonRef={closeButtonRef}
      closeLabel="閉じる"
      dialogRef={dialogRef}
      mode={mode}
      onChangeMode={setMode}
      onClose={() => setOpen(false)}
      title="設定"
    >
      <SettingsPreferencesPane
        editorSettings={settings}
        lModeCopy={getLModeCopy("ja")}
        menuLanguage="ja"
        onEditorSettingsChange={setSettings}
        onMenuLanguageChange={() => {}}
        onPreviewVisibleChange={setPreview}
        onThemePreferenceChange={() => {}}
        previewVisible={preview}
        copy={getPreferencesCopy("ja")}
        themePreference={theme}
      />
    </PreferencesDialog>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<Fixture />);
