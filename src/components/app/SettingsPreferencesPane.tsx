import { ThemePreferenceCards } from "./ThemePreferenceCards";
import { settingsCategoryOffsets, resolveSettingsCategoryIndex } from "./settingsCategoryRail";
import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { OutsideImagePolicy } from "../../features/editor/mediaImageSettings";
import type { LModeCopy, PreferencesCopy } from "../../lib/locale";
import type {
  EditorSettings,
  MenuLanguage,
  ThemePreference,
} from "../../types";
import { AUTO_BACKUP_USER_CHOICE_STORAGE_KEY as AUTO_BACKUP_CHOICE_KEY } from "../../types";
import type { AppleAssistAvailability } from "../../lib/tauri";
import { isAppleLocalAssistSurfaceAllowed } from "../../lib/distributionLane";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { SparklesIcon } from "./Icons";

type SettingsPreferencesPaneProps = {
  appleAssistAvailability?: AppleAssistAvailability;
  appleAssistAvailabilityProbed?: boolean;
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
  appleAssistAvailability = { kind: "unsupported" },
  appleAssistAvailabilityProbed = false,
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
  const categoryPrefix = useId();
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const categoryHeadings = useRef<(HTMLHeadingElement | null)[]>([]);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const categoryLabels = [copy.editor, copy.mediaAndDisplay, copy.application, copy.appearanceAndWriting];
  const navigationLabel = menuLanguage === "en" ? "Settings categories" : menuLanguage === "kana" ? "せっていの もくじ" : "設定の目次";
  const sizeCopy = menuLanguage === "en" ? { title: "Text sizes" } :
    menuLanguage === "kana" ? { title: "もじの おほきさ" } :
    { title: "文字サイズ" };
  const appleLocalAssistAllowed = isAppleLocalAssistSurfaceAllowed();
  const appleAssistStatus = appleAssistStatusText(
    copy,
    appleAssistAvailability,
    appleAssistAvailabilityProbed,
  );

  // 現在地は本文スクロールから導出する。マウント時は先頭カテゴリのままとし、
  // 実際に本文が動いたときだけ更新する（測定できない環境で先頭以外を主張しない）。
  useEffect(() => {
    const scroller = settingsScrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const syncActiveCategory = () => {
      cancelAnimationFrame(frame);
      // scroll 直後の rect は位置が確定していないことがあるため、次のフレームで測る。
      // 押下時の移動は見出しを16px手前に置くので、下の threshold の内側に収まる。
      frame = requestAnimationFrame(() => {
        setActiveCategoryIndex(
          resolveSettingsCategoryIndex(
            settingsCategoryOffsets(scroller, categoryHeadings.current),
            scroller.scrollTop,
            undefined,
            {
              clientHeight: scroller.clientHeight,
              scrollHeight: scroller.scrollHeight,
            },
          ),
        );
      });
    };
    scroller.addEventListener("scroll", syncActiveCategory, { passive: true });
    window.addEventListener("resize", syncActiveCategory);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", syncActiveCategory);
      window.removeEventListener("resize", syncActiveCategory);
    };
  }, []);

  return (
    <div className="settings-layout">
      <nav className="settings-category-nav" aria-label={navigationLabel}>
        {categoryLabels.map((label, index) => <button key={index} type="button"
          aria-controls={categoryPrefix + index}
          aria-current={index === activeCategoryIndex ? "true" : undefined}
          onClick={() => {
            const heading = categoryHeadings.current[index];
            const scroller = settingsScrollRef.current;
            if (heading && scroller) {
              scroller.scrollTop += heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
            }
            setActiveCategoryIndex(index);
            heading?.focus({ preventScroll: true });
          }}>{label}</button>)}
      </nav>
      <div className="preferences-sections settings-preferences" ref={settingsScrollRef}>
      <section className="preference-section" aria-label={copy.editorDisplay}>
        <h3 id={categoryPrefix + 0} tabIndex={-1} ref={(node) => { categoryHeadings.current[0] = node; }}>{copy.editor}</h3>
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
        <fieldset className="settings-text-sizes"><legend>{sizeCopy.title}</legend>
        {/* 実機指摘⑩⑪: 行ごとの見本（「静かな一ページ」）は、すぐ下の
            「この設定での見え方」（モック16）と役割が重複していたので外した。
            代わりに同じ値・同じ値域へ接続した slider を各行へ足す（モック16の指示3:
            「数値入力を残し、必要なら同じ値・値域に接続した slider を補助追加する」）。 */}
        <FontSizeControl
          fallback={14}
          label={copy.editorFontSize}
          max={22}
          min={12}
          onChange={(editorFontSize) =>
            onEditorSettingsChange((current) => ({ ...current, editorFontSize }))
          }
          value={editorSettings.editorFontSize}
        />
        <FontSizeControl
          fallback={15}
          label={copy.previewFontSize}
          max={24}
          min={12}
          onChange={(previewFontSize) =>
            onEditorSettingsChange((current) => ({ ...current, previewFontSize }))
          }
          value={editorSettings.previewFontSize}
        />
        <FontSizeControl
          fallback={13}
          label={copy.workspaceFontSize}
          max={18}
          min={10}
          onChange={(workspaceFontSize) =>
            onEditorSettingsChange((current) => ({ ...current, workspaceFontSize }))
          }
          value={editorSettings.workspaceFontSize}
        />
        <FontSizeControl
          fallback={15}
          label={copy.lModeFontSize}
          max={24}
          min={12}
          onChange={(lModeFontSize) =>
            onEditorSettingsChange((current) => ({ ...current, lModeFontSize }))
          }
          value={editorSettings.lModeFontSize}
        />
        </fieldset>
        {/* 4つの設定の結果を1箇所で確かめられる面（モック16のLIVE PREVIEW）。
            保存済みの値だけを使い、ここから本文を書き換えない。 */}
        <div className="settings-type-preview">
          <span className="settings-type-preview-caption">{copy.typePreviewCaption}</span>
          {/* 4つの文字サイズ設定の結果を、それぞれの大きさで1箇所に並べる（モック16）。
              本文に写すのは previewFontSize だけでは足りない（エディタ・ワークスペース・
              えるモードの設定が反映されないため）。ここは各行が実データから描く。 */}
          {[
            { key: "editor", label: copy.editorFontSize, size: editorSettings.editorFontSize },
            { key: "preview", label: copy.previewFontSize, size: editorSettings.previewFontSize },
            { key: "workspace", label: copy.workspaceFontSize, size: editorSettings.workspaceFontSize },
            { key: "lmode", label: copy.lModeFontSize, size: editorSettings.lModeFontSize },
          ].map((row) => (
            <div className="settings-type-preview-row" key={row.key}>
              <span className="settings-type-preview-row-label">
                {row.label} · {row.size}px
              </span>
              <span
                className="settings-type-preview-row-sample"
                style={{
                  fontSize: row.size,
                  // 行間はまだ独立した設定が無い（D06）。プレビュー既定の1.9を使う。
                  lineHeight: 1.9,
                }}
              >
                {copy.typePreviewSample}
              </span>
            </div>
          ))}
        </div>
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
        <h3 id={categoryPrefix + 1} tabIndex={-1} ref={(node) => { categoryHeadings.current[1] = node; }}>{copy.mediaAndDisplay}</h3>
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
        <h3 id={categoryPrefix + 2} tabIndex={-1} ref={(node) => { categoryHeadings.current[2] = node; }}>{copy.application}</h3>
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
          <>
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
            {/* 生成元と「しないこと」を設定の中に置く（モック17）。
                可用性は既存の appleAssistStatus をそのまま読み、新しい状態機械は作らない。 */}
            <div className="assist-capability" data-availability={appleAssistAvailability.kind}>
              <span className="assist-capability-icon" aria-hidden="true"><SparklesIcon /></span>
              <div className="assist-capability-body">
                {/* 見出しタグは設定のカテゴリ見出し（h3）だけにする。ここは本文の一部。 */}
                <p className="assist-capability-title">{copy.appleAssistStatusLabel}</p>
                <p className="field-hint" role="status" aria-label={copy.appleAssistStatusLabel}>{appleAssistStatus}</p>
                <p className="field-hint">{copy.assistCapabilityDevice}</p>
              </div>
            </div>
            <div className="assist-boundary-grid">
              {copy.assistBoundaries.map((boundary) => (
                <div className="assist-boundary" key={boundary.title}>
                  <p className="assist-boundary-title">{boundary.title}</p>
                  <p className="field-hint">{boundary.body}</p>
                </div>
              ))}
            </div>
            <p className="field-hint">{copy.assistNotice}</p>
          </>
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
        <h3 id={categoryPrefix + 3} tabIndex={-1} ref={(node) => { categoryHeadings.current[3] = node; }}>{copy.appearanceAndWriting}</h3>
        <ThemePreferenceCards copy={copy} language={menuLanguage}
          value={themePreference} onChange={onThemePreferenceChange} />
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
    </div>
  );
}

/**
 * 文字サイズの1行。数値入力と、**同じ値・同じ値域**へ接続した slider を並べる
 * （モック16の指示3）。どちらもアクセシブルな名前は同じ項目名で、role
 * （spinbutton / slider）で区別できる。行ごとの見本は外した（実機指摘⑩）。
 */
function FontSizeControl({
  fallback,
  label,
  max,
  min,
  onChange,
  value,
}: {
  fallback: number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const apply = (raw: string) =>
    onChange(clampNumber(Number(raw), min, max, fallback));

  return (
    <div className="field-control settings-font-size">
      <span>{label}</span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => apply(event.currentTarget.value)}
        step="1"
        type="number"
        value={value}
      />
      <input
        aria-label={label}
        className="settings-font-range"
        max={max}
        min={min}
        onChange={(event) => apply(event.currentTarget.value)}
        step="1"
        type="range"
        value={value}
      />
    </div>
  );
}

function appleAssistStatusText(
  copy: PreferencesCopy,
  availability: AppleAssistAvailability,
  probed: boolean,
): string {
  if (!probed) return copy.appleAssistStatusUnprobed;
  if (availability.kind === "available") {
    return copy.appleAssistStatusAvailable;
  }
  if (availability.kind === "unavailable") {
    return copy.appleAssistStatusUnavailable(availability.reason);
  }
  if (availability.kind === "disabled") {
    return copy.appleAssistStatusDisabled;
  }
  return copy.appleAssistStatusUnsupported;
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
