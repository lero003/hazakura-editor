// テストと実装で共有する EditorSettings の既定ファクトリ。
//
// 従来は SettingsPreferencesPane.test.tsx (editorSettings()) と
// AppTopChrome.test.tsx (defaultEditorSettings()) でローカルに重複定義
// されており、autoBackupEnabled の既定値が true / false と食い違っていた。
// 新しい EditorSettings フィールドを追加するたびに両方のファクトリを
// 手動で更新する必要があり、デフォルト値の不整合リスクもあった。
//
// このファクトリはアプリ本体の既定値
// (src/hooks/app/useAppPreferences.ts の readStoredEditorSettings 内 defaults)
// と一致させる。L Mode の2フィールドは LMODE_SETTINGS_DEFAULTS を経由して
// src/features/editor/lMode/settings.ts の単一ソースから反映する。

import type { EditorSettings } from "../types";
import { LMODE_SETTINGS_DEFAULTS } from "../features/editor/lMode/settings";

export function defaultEditorSettings(
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
    autoBackupEnabled: false,
    ambientIntensity: "normal",
    appleAssistDiffInitiallyOpen: true,
    ...LMODE_SETTINGS_DEFAULTS,
    ...overrides,
  };
}
