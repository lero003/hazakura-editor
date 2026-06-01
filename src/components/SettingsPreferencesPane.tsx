import type { Dispatch, SetStateAction } from "react";
import type { PreferencesCopy } from "../locale";
import type {
  EditorSettings,
  MenuLanguage,
  ThemePreference,
} from "../types";

type SettingsPreferencesPaneProps = {
  copy: PreferencesCopy;
  editorSettings: EditorSettings;
  menuLanguage: MenuLanguage;
  onEditorSettingsChange: Dispatch<SetStateAction<EditorSettings>>;
  onMenuLanguageChange: (language: MenuLanguage) => void;
  onPreviewVisibleChange: (visible: boolean) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  previewVisible: boolean;
  themePreference: ThemePreference;
};

type AmbientIntensity = "off" | "subtle" | "normal" | "dramatic";

const AMBIENT_OPTIONS: { value: AmbientIntensity; label: keyof PreferencesCopy }[] = [
  { value: "off", label: "ambientIntensityOff" },
  { value: "subtle", label: "ambientIntensitySubtle" },
  { value: "normal", label: "ambientIntensityNormal" },
  { value: "dramatic", label: "ambientIntensityDramatic" },
];

export function SettingsPreferencesPane({
  copy,
  editorSettings,
  menuLanguage,
  onEditorSettingsChange,
  onMenuLanguageChange,
  onPreviewVisibleChange,
  onThemePreferenceChange,
  previewVisible,
  themePreference,
}: SettingsPreferencesPaneProps) {
  return (
    <div className="preferences-sections">
      <section className="preference-section" aria-label={copy.editorDisplay}>
        <h3>{copy.editor}</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={editorSettings.wrapLines}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                wrapLines: event.target.checked,
              }))
            }
          />
          <span className="slider"></span>
          <span>{copy.wrapLines}</span>
        </label>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={editorSettings.showInvisibles}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                showInvisibles: event.target.checked,
              }))
            }
          />
          <span className="slider"></span>
          <span>{copy.showInvisibles}</span>
        </label>
        <label className="field-control">
          <span>{copy.fontSize}</span>
          <input
            aria-label={copy.fontSizeControl}
            type="number"
            min="12"
            max="22"
            value={editorSettings.fontSize}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                fontSize: clampNumber(Number(event.target.value), 12, 22, 14),
              }))
            }
          />
        </label>
        <label className="field-control">
          <span>{copy.tabSize}</span>
          <select
            aria-label={copy.tabSize}
            value={editorSettings.tabSize}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                tabSize: clampNumber(Number(event.target.value), 2, 8, 2),
              }))
            }
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </label>
      </section>
      <section className="preference-section" aria-label={copy.application}>
        <h3>{copy.application}</h3>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={previewVisible}
            onChange={(event) => onPreviewVisibleChange(event.target.checked)}
          />
          <span className="slider"></span>
          <span>{copy.previewPane}</span>
        </label>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={editorSettings.autoBackupEnabled}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                autoBackupEnabled: event.target.checked,
              }))
            }
          />
          <span className="slider"></span>
          <span>{copy.autoBackup}</span>
        </label>
        <label className="field-control">
          <span>{copy.theme}</span>
          <select
            aria-label={copy.theme}
            value={themePreference}
            onChange={(event) =>
              onThemePreferenceChange(event.target.value as ThemePreference)
            }
          >
            <option value="light">{copy.light}</option>
            <option value="dark">{copy.dark}</option>
            <option value="sakura">{copy.sakura}</option>
            <option value="yakou">{copy.yakou}</option>
            <option value="shokou">{copy.shokou}</option>
            <option value="kouyou">{copy.kouyou}</option>
          </select>
        </label>
        <label className="field-control">
          <span>{copy.ambientIntensity}</span>
          <select
            aria-label={copy.ambientIntensity}
            value={editorSettings.ambientIntensity}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                ambientIntensity: event.target.value as AmbientIntensity,
              }))
            }
          >
            {AMBIENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {copy[opt.label]}
              </option>
            ))}
          </select>
          <span className="field-hint">{copy.ambientIntensityHint}</span>
        </label>
        <label className="field-control">
          <span>{copy.menuLanguage}</span>
          <select
            aria-label={copy.menuLanguage}
            value={menuLanguage}
            onChange={(event) =>
              onMenuLanguageChange(event.target.value as MenuLanguage)
            }
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="kana">かなふみ</option>
          </select>
        </label>
      </section>
    </div>
  );
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(numberValue), min), max);
}
