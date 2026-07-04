import type { Dispatch, SetStateAction } from "react";
import type { LModeCopy, PreferencesCopy } from "../../lib/locale";
import type {
  EditorSettings,
  MenuLanguage,
  ThemePreference,
} from "../../types";
import { AUTO_BACKUP_USER_CHOICE_STORAGE_KEY as AUTO_BACKUP_CHOICE_KEY } from "../../types";
import { isAppleLocalAssistSurfaceAllowed } from "../../lib/distributionLane";

type SettingsPreferencesPaneProps = {
  copy: PreferencesCopy;
  editorSettings: EditorSettings;
  lModeCopy: LModeCopy;
  menuLanguage: MenuLanguage;
  onEditorSettingsChange: Dispatch<SetStateAction<EditorSettings>>;
  onMenuLanguageChange: (language: MenuLanguage) => void;
  onPreviewVisibleChange: (visible: boolean) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  previewVisible: boolean;
  themePreference: ThemePreference;
};

type AmbientIntensity = "off" | "subtle" | "normal" | "dramatic";

type AmbientOptionLabel =
  | "ambientIntensityOff"
  | "ambientIntensitySubtle"
  | "ambientIntensityNormal"
  | "ambientIntensityDramatic";

const AMBIENT_OPTIONS: {
  value: AmbientIntensity;
  label: AmbientOptionLabel;
}[] = [
  { value: "off", label: "ambientIntensityOff" },
  { value: "subtle", label: "ambientIntensitySubtle" },
  { value: "normal", label: "ambientIntensityNormal" },
  { value: "dramatic", label: "ambientIntensityDramatic" },
];

export function SettingsPreferencesPane({
  copy,
  editorSettings,
  lModeCopy,
  menuLanguage,
  onEditorSettingsChange,
  onMenuLanguageChange,
  onPreviewVisibleChange,
  onThemePreferenceChange,
  previewVisible,
  themePreference,
}: SettingsPreferencesPaneProps) {
  const appleLocalAssistAllowed = isAppleLocalAssistSurfaceAllowed();

  return (
    <div className="preferences-sections settings-preferences">
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
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={editorSettings.spellcheckEnabled}
            onChange={() => {
              const spellcheckEnabled = !editorSettings.spellcheckEnabled;
              onEditorSettingsChange((current) => ({
                ...current,
                spellcheckEnabled,
              }));
            }}
          />
          <span className="slider"></span>
          <span>{copy.spellcheck}</span>
        </label>
        <label className="field-control">
          <span>{copy.editorFontSize}</span>
          <input
            aria-label={copy.editorFontSize}
            type="number"
            min="12"
            max="22"
            step="1"
            value={editorSettings.editorFontSize}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                editorFontSize: clampNumber(
                  Number(event.target.value),
                  12,
                  22,
                  14,
                ),
              }))
            }
          />
        </label>
        <label className="field-control">
          <span>{copy.previewFontSize}</span>
          <input
            aria-label={copy.previewFontSize}
            type="number"
            min="12"
            max="24"
            step="1"
            value={editorSettings.previewFontSize}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                previewFontSize: clampNumber(
                  Number(event.target.value),
                  12,
                  24,
                  15,
                ),
              }))
            }
          />
        </label>
        <label className="field-control">
          <span>{copy.workspaceFontSize}</span>
          <input
            aria-label={copy.workspaceFontSize}
            type="number"
            min="10"
            max="18"
            step="1"
            value={editorSettings.workspaceFontSize}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                workspaceFontSize: clampNumber(
                  Number(event.target.value),
                  10,
                  18,
                  13,
                ),
              }))
            }
          />
        </label>
        <label className="field-control">
          <span>{copy.lModeFontSize}</span>
          <input
            aria-label={copy.lModeFontSize}
            type="number"
            min="12"
            max="24"
            step="1"
            value={editorSettings.lModeFontSize}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                lModeFontSize: clampNumber(
                  Number(event.target.value),
                  12,
                  24,
                  15,
                ),
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
            data-testid="auto-backup-toggle"
            type="checkbox"
            checked={editorSettings.autoBackupEnabled}
            onChange={() => {
              const autoBackupEnabled = !editorSettings.autoBackupEnabled;
              window.localStorage.setItem(AUTO_BACKUP_CHOICE_KEY, "true");
              onEditorSettingsChange((current) => ({
                ...current,
                autoBackupEnabled,
              }));
            }}
          />
          <span className="slider"></span>
          <span>{copy.autoBackup}</span>
          <span className="field-hint">{copy.autoBackupHint}</span>
        </label>
        {appleLocalAssistAllowed ? (
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={editorSettings.appleAssistDiffInitiallyOpen}
              onChange={(event) => {
                const appleAssistDiffInitiallyOpen = event.currentTarget.checked;
                onEditorSettingsChange((current) => ({
                  ...current,
                  appleAssistDiffInitiallyOpen,
                }));
              }}
            />
            <span className="slider"></span>
            <span>{copy.appleAssistDiffInitiallyOpen}</span>
            <span className="field-hint">
              {copy.appleAssistDiffInitiallyOpenHint}
            </span>
          </label>
        ) : null}
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
          <span className="field-hint" data-testid="menu-language-hint">
            {copy.menuLanguageHint}
          </span>
        </label>
      </section>
      <section
        className="preference-section"
        aria-label={copy.appearanceAndWriting}
      >
        <h3>{copy.appearanceAndWriting}</h3>
        <label className="field-control">
          <span>{copy.theme}</span>
          <select
            aria-label={copy.theme}
            value={themePreference}
            onChange={(event) =>
              onThemePreferenceChange(event.target.value as ThemePreference)
            }
          >
            <option value="light" title={copy.themeHint("light")}>
              {copy.light}
            </option>
            <option value="dark" title={copy.themeHint("dark")}>
              {copy.dark}
            </option>
            <option value="sakura" title={copy.themeHint("sakura")}>
              {copy.sakura}
            </option>
            <option value="yakou" title={copy.themeHint("yakou")}>
              {copy.yakou}
            </option>
            <option value="shokou" title={copy.themeHint("shokou")}>
              {copy.shokou}
            </option>
            <option value="crt" title={copy.themeHint("crt")}>
              {copy.crt}
            </option>
            <option value="shinkai" title={copy.themeHint("shinkai")}>
              {copy.shinkai}
            </option>
          </select>
          <span className="field-hint" data-testid="theme-hint">
            {copy.themeHint(themePreference)}
          </span>
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
        <div className="preference-feature">
          <p className="preference-feature-lede">
            <span className="preference-feature-label">
              {lModeCopy.preferenceLabel}
            </span>
            <span className="preference-feature-description">
              {lModeCopy.featureDescription}
            </span>
          </p>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={editorSettings.lModeEnabled}
              onChange={(event) =>
                onEditorSettingsChange((current) => ({
                  ...current,
                  lModeEnabled: event.target.checked,
                }))
              }
            />
            <span className="slider"></span>
            <span>{lModeCopy.preferenceLabel}</span>
            <span className="field-hint">{lModeCopy.preferenceHint}</span>
          </label>
          <label
            className={`toggle-switch toggle-switch-nested${
              editorSettings.lModeEnabled ? "" : " toggle-switch-disabled"
            }`}
          >
            <input
              type="checkbox"
              disabled={!editorSettings.lModeEnabled}
              checked={editorSettings.lModeTypewriter}
              onChange={(event) =>
                onEditorSettingsChange((current) => ({
                  ...current,
                  lModeTypewriter: event.target.checked,
                }))
              }
            />
            <span className="slider"></span>
            <span>{lModeCopy.typewriterPreferenceLabel}</span>
            <span className="field-hint">
              {lModeCopy.typewriterPreferenceHint}
            </span>
          </label>
        </div>
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
