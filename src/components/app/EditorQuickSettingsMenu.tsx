import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { EditorSettings, MenuLanguage } from "../../types";
import { isJapaneseMenuLanguage } from "../../types";
import { clampNumber } from "../../lib/utils";
import { SlidersIcon } from "./Icons";

type EditorQuickSettingsMenuProps = {
  editorSettings: EditorSettings;
  menuLanguage: MenuLanguage;
  onEditorSettingsChange: Dispatch<SetStateAction<EditorSettings>>;
};

export function EditorQuickSettingsMenu({
  editorSettings,
  menuLanguage,
  onEditorSettingsChange,
}: EditorQuickSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const copy = getEditorQuickSettingsCopy(menuLanguage);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const updateSetting = <Key extends keyof EditorSettings>(
    key: Key,
    value: EditorSettings[Key],
  ) => {
    onEditorSettingsChange((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateNumericSetting = (
    key:
      | "editorFontSize"
      | "previewFontSize"
      | "workspaceFontSize"
      | "tabSize",
    value: string,
    min: number,
    max: number,
    fallback: number,
  ) => {
    updateSetting(key, clampNumber(Number(value), min, max, fallback));
  };

  return (
    <div className="editor-quick-settings" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={copy.title}
        className="chrome-icon-button editor-quick-settings-trigger"
        onClick={() => setOpen((current) => !current)}
        title={copy.title}
        type="button"
      >
        <SlidersIcon />
      </button>
      {open ? (
        <div
          aria-label={copy.title}
          className="editor-quick-settings-popover"
          role="menu"
        >
          <section aria-label={copy.display} className="editor-quick-settings-section">
            <span className="editor-quick-settings-heading">
              {copy.display}
            </span>
            <ToggleRow
              checked={editorSettings.wrapLines}
              label={copy.wrapLines}
              onChange={(checked) => updateSetting("wrapLines", checked)}
            />
            <ToggleRow
              checked={editorSettings.showInvisibles}
              label={copy.showInvisibles}
              onChange={(checked) => updateSetting("showInvisibles", checked)}
            />
          </section>
          <section aria-label={copy.textSize} className="editor-quick-settings-section">
            <span className="editor-quick-settings-heading">
              {copy.textSize}
            </span>
            <RangeRow
              label={copy.editorFontSize}
              max={22}
              min={12}
              onChange={(value) =>
                updateNumericSetting("editorFontSize", value, 12, 22, 14)
              }
              value={editorSettings.editorFontSize}
            />
            <RangeRow
              label={copy.previewFontSize}
              max={24}
              min={12}
              onChange={(value) =>
                updateNumericSetting("previewFontSize", value, 12, 24, 15)
              }
              value={editorSettings.previewFontSize}
            />
            <RangeRow
              label={copy.workspaceFontSize}
              max={18}
              min={10}
              onChange={(value) =>
                updateNumericSetting("workspaceFontSize", value, 10, 18, 13)
              }
              value={editorSettings.workspaceFontSize}
            />
          </section>
          <section aria-label={copy.editing} className="editor-quick-settings-section">
            <span className="editor-quick-settings-heading">
              {copy.editing}
            </span>
            <RangeRow
              label={copy.tabSize}
              max={8}
              min={2}
              onChange={(value) =>
                updateNumericSetting("tabSize", value, 2, 8, 2)
              }
              step={2}
              value={editorSettings.tabSize}
            />
            <ToggleRow
              checked={editorSettings.spellcheckEnabled}
              label={copy.spellcheck}
              onChange={(checked) =>
                updateSetting("spellcheckEnabled", checked)
              }
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="editor-quick-settings-toggle">
      <input
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className="editor-quick-settings-switch" />
      <span>{label}</span>
    </label>
  );
}

function RangeRow({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="editor-quick-settings-range">
      <span>{label}</span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(event.currentTarget.value)}
        step={step}
        type="range"
        value={value}
      />
      <output>{value}</output>
    </label>
  );
}

function getEditorQuickSettingsCopy(language: MenuLanguage) {
  if (language === "kana") {
    return {
      display: "みえかた",
      editing: "かく",
      editorFontSize: "えでぃたの もじ",
      previewFontSize: "ぷれびゅーの もじ",
      showInvisibles: "みえない もじ",
      spellcheck: "つづり かくにん",
      tabSize: "たぶ はば",
      textSize: "もじの おおきさ",
      title: "えでぃた せってい",
      workspaceFontSize: "わーくすぺーすの もじ",
      wrapLines: "おりかえし",
    };
  }

  if (isJapaneseMenuLanguage(language)) {
    return {
      display: "表示",
      editing: "編集",
      editorFontSize: "エディタの文字サイズ",
      previewFontSize: "プレビューの文字サイズ",
      showInvisibles: "不可視文字",
      spellcheck: "スペルチェック",
      tabSize: "タブ幅",
      textSize: "文字サイズ",
      title: "エディタ設定",
      workspaceFontSize: "ワークスペースの文字サイズ",
      wrapLines: "折り返し",
    };
  }

  return {
    display: "Display",
    editing: "Editing",
    editorFontSize: "Editor font size",
    previewFontSize: "Preview font size",
    showInvisibles: "Show invisibles",
    spellcheck: "Spellcheck",
    tabSize: "Tab size",
    textSize: "Text size",
    title: "Editor settings",
    workspaceFontSize: "Workspace font size",
    wrapLines: "Wrap lines",
  };
}
