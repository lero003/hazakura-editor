import { useId } from "react";
import type { MenuLanguage, ThemePreference } from "../../types";
import type { PreferencesCopy } from "../../lib/locale";

export function ThemePreferenceCards({ copy, language, value, onChange }: {
  copy: PreferencesCopy;
  language: MenuLanguage;
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}) {
  const descriptionId = useId();
  const labels = language === "en"
    ? { daily: "Everyday themes", ambient: "Atmospheric themes", sample: "A quiet page" }
    : language === "kana"
      ? { daily: "いつもの テーマ", ambient: "えんしゅつの ある テーマ", sample: "しづかな いちページ" }
      : { daily: "日常のテーマ", ambient: "演出のあるテーマ", sample: "静かな一ページ" };
  const groups: { label: string; themes: ThemePreference[] }[] = [
    { label: labels.daily, themes: ["light", "dark", "yakou", "shokou"] },
    { label: labels.ambient, themes: ["edohigan", "shinkai", "crt"] },
  ];
  return <div className="theme-preference-cards">
    {groups.map((group) => <div role="group" aria-label={group.label} key={group.label}>
      <h4>{group.label}</h4>
      <div className="theme-preference-grid">
        {group.themes.map((theme) => <button type="button" key={theme}
          className="theme-preference-card" data-theme-preview={theme}
          aria-label={copy[theme]} aria-pressed={theme === value}
          aria-describedby={descriptionId + theme}
          title={copy.themeHint(theme)} onClick={() => onChange(theme)}>
          <span id={descriptionId + theme} className="sr-only">{copy.themeHint(theme)}</span>
          <span className="theme-preference-paper" aria-hidden="true">
            <span>{labels.sample}</span><i /><i /><i />
          </span>
          <span className="theme-preference-name">{copy[theme]}
            <span aria-hidden="true">{theme === value ? "✓" : ""}</span>
          </span>
        </button>)}
      </div>
    </div>)}
    <p className="field-hint" data-testid="theme-hint">{copy.themeHint(value)}</p>
  </div>;
}
