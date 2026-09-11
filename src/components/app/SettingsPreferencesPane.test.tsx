import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getLModeCopy, getPreferencesCopy } from "../../lib/locale";
import { defaultEditorSettings } from "../../lib/editorSettingsDefaults";
import {
  AUTO_BACKUP_USER_CHOICE_STORAGE_KEY,
  type EditorSettings,
} from "../../types";

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
  window.localStorage.clear();
});

// 本物の state を通してトグル操作の「最終状態」を検証するラッパー。
// 従来は onEditorSettingsChange に渡された updater 関数を取り出して直接実行し、
// その戻り値を assert していた (mock.calls[0][0](current))。これは「コールバックが
// 関数 (updater) を渡すか、値を渡すか」という実装詳細に強く依存し、実装を変更すると
// 即座に壊れる原因になっていた。このラッパーを使えば、ユーザーがトグルを操作した
// 結果として EditorSettings がどう変わるかを、実装の内部形式によらず検証できる。
function renderWithState(initial: EditorSettings) {
  function TestComponent() {
    const [settings, setSettings] = useState<EditorSettings>(initial);
    return (
      <SettingsPreferencesPane
        copy={getPreferencesCopy("en")}
        editorSettings={settings}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={setSettings}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />
    );
  }
  return render(<TestComponent />);
}

describe("SettingsPreferencesPane", () => {
  it("offers only per-document approval or explicit allow-all for outside images", () => {
    const copy = getPreferencesCopy("en");
    renderWithState(defaultEditorSettings());

    const select = screen.getByRole("combobox", {
      name: copy.outsideImages,
    }) as HTMLSelectElement;
    expect(Array.from(select.options, (option) => option.value)).toEqual([
      "ask",
      "allow",
    ]);
    expect(screen.queryByText(/Remember approved folders/i)).toBeNull();
  });

  it("toggles the Hazakura Local Assist diff default-open preference", () => {
    // appleAssistDiffInitiallyOpen トグルをクリックした結果、最終状態の
    // editorSettings が反転していることを本物の state を通して検証する。
    // クラス名 (label.toggle-switch) や DOM 階層に依存せず、アクセシブルな
    // ロール + 名前でトグルを取得する。
    const initial = defaultEditorSettings({ appleAssistDiffInitiallyOpen: true });
    renderWithState(initial);

    const toggle = screen.getByRole("checkbox", {
      name: /Open Hazakura Local Assist diff/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);

    // クリック後、本物の useState 経由で appleAssistDiffInitiallyOpen が
    // true -> false に反転していることを最終状態で検証する。
    // result 経由ではなく、再レンダリング後の checkbox の checked を見る。
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });

  it("keeps the Hazakura Local Assist diff preference in the App Store distribution lane", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");
    render(
      <SettingsPreferencesPane
        copy={getPreferencesCopy("en")}
        editorSettings={defaultEditorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    // App Store レーンでも Local Assist diff 設定が表示されていることを固定。
    // "Hazakura Local Assist" は複数箇所に出現しうるため、diff 設定の具体的な
    // ラベル文字列で存在を確認する。
    expect(
      screen.getByText("Open Hazakura Local Assist diff automatically"),
    ).toBeTruthy();
  });

  it("shows Hazakura Local Assist unavailability in Preferences", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");
    render(
      <SettingsPreferencesPane
        appleAssistAvailabilityProbed={true}
        appleAssistAvailability={{
          kind: "unavailable",
          reason: "Foundation Models unavailable",
        }}
        copy={getPreferencesCopy("en")}
        editorSettings={defaultEditorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    expect(screen.getByText("Hazakura Local Assist status")).toBeTruthy();
    expect(
      screen.getByText("Currently unavailable: Foundation Models unavailable"),
    ).toBeTruthy();
  });

  it("records an explicit user choice when toggling auto-backup", () => {
    // autoBackup トグルをクリックすると localStorage にユーザー選択が記録され、
    // editorSettings.autoBackupEnabled が反転することを本物の state で検証する。
    const initial = defaultEditorSettings({ autoBackupEnabled: false });
    renderWithState(initial);

    const toggle = screen.getByTestId(
      "auto-backup-toggle",
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    // クリック直後に localStorage への書き込みが起きていること。
    expect(
      window.localStorage.getItem(AUTO_BACKUP_USER_CHOICE_STORAGE_KEY),
    ).toBe("true");
    // トグル操作の結果、checkbox の checked が true に反転していること。
    expect(toggle.checked).toBe(true);
  });

  it("renders theme cards with visible hint for the selected theme", () => {
    const copy = getPreferencesCopy("en");
    render(
      <SettingsPreferencesPane
        copy={copy}
        editorSettings={defaultEditorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="edohigan"
      />,
    );

    // testid は実装側に明示的に埋められているのでクラス名より安定だが、
    // screen.getByTestId を使うことでクエリも簡潔にする。
    const hint = screen.getByTestId("theme-hint");
    expect(hint.textContent).toBe(copy.themeHint("edohigan"));
  });

  it("renders theme cards for all three languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getPreferencesCopy(lang);
      render(
        <SettingsPreferencesPane
          copy={copy}
          editorSettings={defaultEditorSettings()}
          lModeCopy={getLModeCopy(lang)}
          menuLanguage={lang}
          onEditorSettingsChange={vi.fn()}
          onMenuLanguageChange={vi.fn()}
          onPreviewVisibleChange={vi.fn()}
          onThemePreferenceChange={vi.fn()}
          previewVisible={true}
          themePreference="yakou"
        />,
      );

      const hint = screen.getByTestId("theme-hint");
      expect(hint.textContent).toBe(copy.themeHint("yakou"));
      cleanup();
    }
  });

  it("renders the menu language hint below the menu language select", () => {
    const copy = getPreferencesCopy("en");
    render(
      <SettingsPreferencesPane
        copy={copy}
        editorSettings={defaultEditorSettings()}
        lModeCopy={getLModeCopy("en")}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
        onMenuLanguageChange={vi.fn()}
        onPreviewVisibleChange={vi.fn()}
        onThemePreferenceChange={vi.fn()}
        previewVisible={true}
        themePreference="light"
      />,
    );

    const hint = screen.getByTestId("menu-language-hint");
    expect(hint.textContent).toBe(copy.menuLanguageHint);
  });

  it("renders the menu language hint in all three languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getPreferencesCopy(lang);
      render(
        <SettingsPreferencesPane
          copy={copy}
          editorSettings={defaultEditorSettings()}
          lModeCopy={getLModeCopy(lang)}
          menuLanguage={lang}
          onEditorSettingsChange={vi.fn()}
          onMenuLanguageChange={vi.fn()}
          onPreviewVisibleChange={vi.fn()}
          onThemePreferenceChange={vi.fn()}
          previewVisible={true}
          themePreference="light"
        />,
      );

      const hint = screen.getByTestId("menu-language-hint");
      expect(hint.textContent).toBe(copy.menuLanguageHint);
      cleanup();
    }
  });

  it("toggles spellcheckEnabled from the preferences pane", () => {
    // Spellcheck はエディタ Quick Settings だけでなく設定ペインからも切り替えられる。
    // 表示/編集系の設定が一箇所に集約されていることを、アクセシブルな名前で
    // 取得した checkbox の最終状態で検証する。
    const initial = defaultEditorSettings({ spellcheckEnabled: true });
    renderWithState(initial);

    const toggle = screen.getByRole("checkbox", {
      name: /Spellcheck/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);

    // クリック後、本物の useState 経由で spellcheckEnabled が
    // true -> false に反転していることを最終状態で検証する。
    expect(toggle.checked).toBe(false);
  });

});

it.each([
  ["editorFontSize", 12, 22],
  ["previewFontSize", 12, 24],
  ["workspaceFontSize", 10, 18],
  ["lModeFontSize", 12, 24],
] as const)("clamps %s to its range on commit, leaving other rows alone", (key, min, max) => {
  const copy = getPreferencesCopy("en");
  renderWithState(defaultEditorSettings());
  const keys = ["editorFontSize", "previewFontSize", "workspaceFontSize", "lModeFontSize"] as const;
  const originals = Object.fromEntries(keys.map((name) => [name, (screen.getByRole("spinbutton", { name: copy[name] }) as HTMLInputElement).value]));
  const input = screen.getByRole("spinbutton", { name: copy[key] }) as HTMLInputElement;
  // R4: 確定は blur / Enter。入力中は打った文字列がそのまま見える。
  fireEvent.change(input, { target: { value: "999" } });
  expect(input.value).toBe("999");
  fireEvent.blur(input);
  expect(input.value).toBe(String(max));
  fireEvent.change(input, { target: { value: "1" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.value).toBe(String(min));
  for (const other of keys.filter((name) => name !== key)) {
    expect((screen.getByRole("spinbutton", { name: copy[other] }) as HTMLInputElement).value).toBe(originals[other]);
  }
});

it.each([
  ["editorFontSize", 12, 22],
  ["previewFontSize", 12, 24],
  ["lModeFontSize", 12, 24],
] as const)("lets %s be typed as two digits, one key at a time (R4)", (key, _min, max) => {
  // 外部レビュー R4: 即時 clamp のため「20」を打つと "2"→12、"120"→22 になっていた。
  // 実際のキー入力の並びで、完成値がそのまま通ることを固定する。
  const copy = getPreferencesCopy("en");
  renderWithState(defaultEditorSettings());
  const input = screen.getByRole("spinbutton", { name: copy[key] }) as HTMLInputElement;
  // workspaceFontSize(10〜18) は2桁の20を取れないので、この並びは20以上を取れる行で見る。
  expect(max).toBeGreaterThanOrEqual(20);

  fireEvent.change(input, { target: { value: "2" } });
  expect(input.value).toBe("2");
  fireEvent.change(input, { target: { value: "20" } });
  fireEvent.blur(input);
  expect(input.value).toBe("20");
  expect(input.value).not.toBe(String(max));

  // 全消しで確定したときは勝手に下限へ飛ばさず、元の値へ戻す。
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.blur(input);
  expect(input.value).toBe("20");
  // Escape は入力を取り消す。
  fireEvent.change(input, { target: { value: "19" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input.value).toBe("20");
});

it.each([
  ["editorFontSize", 12, 22],
  ["previewFontSize", 12, 24],
  ["workspaceFontSize", 10, 18],
  ["lModeFontSize", 12, 24],
] as const)("drives %s from its paired slider inside the same range", (key, min, max) => {
  // 実機指摘⑪: 数値入力だけの行に、同じ値・値域へ接続した slider を足した。
  const copy = getPreferencesCopy("en");
  renderWithState(defaultEditorSettings());

  const slider = screen.getByRole("slider", { name: copy[key] }) as HTMLInputElement;
  expect(slider.min).toBe(String(min));
  expect(slider.max).toBe(String(max));

  fireEvent.change(slider, { target: { value: String(max) } });
  expect(slider.value).toBe(String(max));
  // 同じ設定を触るので、数値入力側も追随する（どちらか一方だけが動く状態にしない）。
  expect(
    (screen.getByRole("spinbutton", { name: copy[key] }) as HTMLInputElement).value,
  ).toBe(String(max));
});

it("keeps one type sample instead of one per size row", () => {
  // 実機指摘⑩: 行ごとの「静かな一ページ」は「この設定での見え方」と重複していた。
  renderWithState(defaultEditorSettings());

  expect(document.querySelector(".settings-font-sample")).toBeNull();
  expect(document.querySelectorAll(".settings-type-preview-row")).toHaveLength(4);
});
