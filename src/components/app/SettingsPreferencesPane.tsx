import type { Dispatch, SetStateAction } from "react";
import type { OutsideImagePolicy } from "../../features/editor/mediaImageSettings";
import type { LModeCopy, PreferencesCopy } from "../../lib/locale";
import type {
  EditorSettings,
  MenuLanguage,
  ThemePreference,
} from "../../types";
import { AUTO_BACKUP_USER_CHOICE_STORAGE_KEY as AUTO_BACKUP_CHOICE_KEY } from "../../types";
import { isAppleLocalAssistSurfaceAllowed } from "../../lib/distributionLane";
import { ToggleSwitch } from "../common/ToggleSwitch";

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
        <ToggleSwitch
          checked={editorSettings.wrapLines}
          label={copy.wrapLines}
          onChange={(wrapLines) =>
            onEditorSettingsChange((current) => ({ ...current, wrapLines }))
          }
        />
        <ToggleSwitch
          checked={editorSettings.showInvisibles}
          label={copy.showInvisibles}
          onChange={(showInvisibles) =>
            onEditorSettingsChange((current) => ({
              ...current,
              showInvisibles,
            }))
          }
        />
        <ToggleSwitch
          checked={editorSettings.spellcheckEnabled}
          label={copy.spellcheck}
          onChange={(spellcheckEnabled) =>
            onEditorSettingsChange((current) => ({
              ...current,
              spellcheckEnabled,
            }))
          }
        />
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
      <section className="preference-section" aria-label={copy.mediaAndDisplay}>
        <h3>{copy.mediaAndDisplay}</h3>
        <label className="field-control">
          <span>{copy.outsideImages}</span>
          <select
            aria-label={copy.outsideImages}
            value={editorSettings.outsideImages}
            onChange={(event) =>
              onEditorSettingsChange((current) => ({
                ...current,
                outsideImages: event.target.value as OutsideImagePolicy,
              }))
            }
          >
            <option value="ask">{copy.outsideImagesAsk}</option>
            <option value="allow">{copy.outsideImagesAllow}</option>
          </select>
          <span className="field-hint">{copy.outsideImagesHint}</span>
        </label>
        <ToggleSwitch
          checked={editorSettings.loadRemoteImages}
          hint={copy.loadRemoteImagesHint}
          label={copy.loadRemoteImages}
          onChange={(loadRemoteImages) =>
            onEditorSettingsChange((current) => ({
              ...current,
              loadRemoteImages,
            }))
          }
        />
        <ToggleSwitch
          checked={editorSettings.materializeImagesOnExport}
          hint={copy.materializeImagesOnExportHint}
          label={copy.materializeImagesOnExport}
          onChange={(materializeImagesOnExport) =>
            onEditorSettingsChange((current) => ({
              ...current,
              materializeImagesOnExport,
            }))
          }
        />
      </section>
      <section className="preference-section" aria-label={copy.application}>
        <h3>{copy.application}</h3>
        <ToggleSwitch
          checked={previewVisible}
          label={copy.previewPane}
          onChange={onPreviewVisibleChange}
        />
        <ToggleSwitch
          checked={editorSettings.autoBackupEnabled}
          hint={copy.autoBackupHint}
          label={copy.autoBackup}
          testId="auto-backup-toggle"
          onChange={(autoBackupEnabled) => {
            // autoBackup はユーザーが明示的に選択したことを localStorage に記録し、
            // 初回起動時の「バックアップを有効にするか」プロンプトを二度と出さない。
            // この副作用は ToggleSwitch には持ち込まず、呼び出し側で処理する。
            window.localStorage.setItem(AUTO_BACKUP_CHOICE_KEY, "true");
            onEditorSettingsChange((current) => ({
              ...current,
              autoBackupEnabled,
            }));
          }}
        />
        {appleLocalAssistAllowed ? (
          <ToggleSwitch
            checked={editorSettings.appleAssistDiffInitiallyOpen}
            hint={copy.appleAssistDiffInitiallyOpenHint}
            label={copy.appleAssistDiffInitiallyOpen}
            onChange={(appleAssistDiffInitiallyOpen) =>
              onEditorSettingsChange((current) => ({
                ...current,
                appleAssistDiffInitiallyOpen,
              }))
            }
          />
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
            <option value="edohigan" title={copy.themeHint("edohigan")}>
              {copy.edohigan}
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
          <ToggleSwitch
            checked={editorSettings.lModeEnabled}
            hint={lModeCopy.preferenceHint}
            label={lModeCopy.preferenceLabel}
            onChange={(lModeEnabled) =>
              onEditorSettingsChange((current) => ({
                ...current,
                lModeEnabled,
              }))
            }
          />
          <ToggleSwitch
            checked={editorSettings.lModeTypewriter}
            className={`toggle-switch-nested`}
            disabled={!editorSettings.lModeEnabled}
            hint={lModeCopy.typewriterPreferenceHint}
            label={lModeCopy.typewriterPreferenceLabel}
            onChange={(lModeTypewriter) =>
              onEditorSettingsChange((current) => ({
                ...current,
                lModeTypewriter,
              }))
            }
          />
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
