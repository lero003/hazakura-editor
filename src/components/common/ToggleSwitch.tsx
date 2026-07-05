// 設定ペイン等で使うトグルスイッチの共通コンポーネント。
//
// 従来 SettingsPreferencesPane / AgentWorkbenchPreferencesPane では
// <label className="toggle-switch"><input .../><span className="slider"/>
// <span>{label}</span></label> を各箇所で直接書いており、onChange の形が
// event.target.checked を読むパターンとクロージャ反転 (!value) のパターンで
// 分裂していた。jsdom の fireEvent.click は checkbox の checked を確実には
// 反転させないため、クロージャ反転パターンだけがテストを通すワークアラウンド
// になっていた (今回 spellcheck トグル追加時に実際にこの罠でテストが壊れた)。
//
// このコンポーネントで onChange: (checked: boolean) => void に統一し、
// 内部で input の event.currentTarget.checked を渡す。呼び出し側は boolean の
// みを扱うので実装パターンの分裂が起きない。副作用 (localStorage 書き込み等) は
// 呼び出し側の onChange 内で処理し、このコンポーネントには持ち込まない。
//
// 既存の .toggle-switch / .toggle-switch-nested / .toggle-switch-disabled の
// CSS クラスと DOM 構造をそのまま維持するため、視覚的な回帰は生じない。

type ToggleSwitchProps = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  // 入れ子トグル (親が無効のときに薄く表示する等) のときに付与する追加クラス。
  // toggle-switch-nested / toggle-switch-disabled を想定。
  className?: string;
  // ラベル下に表示する補足説明。autoBackup や appleAssist のヒント等で使用。
  hint?: string;
  // テストで getByTestId で拾うための任意の testId。
  testId?: string;
};

export function ToggleSwitch({
  checked,
  label,
  onChange,
  disabled = false,
  className,
  hint,
  testId,
}: ToggleSwitchProps) {
  const labelClassName =
    "toggle-switch" + (className ? ` ${className}` : "") +
    (disabled && !className?.includes("toggle-switch-disabled")
      ? " toggle-switch-disabled"
      : "");
  return (
    <label className={labelClassName}>
      <input
        checked={checked}
        data-testid={testId}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span className="slider"></span>
      <span>{label}</span>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
