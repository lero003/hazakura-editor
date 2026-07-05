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

  it("renders theme select with visible hint for the selected theme", () => {
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
        themePreference="sakura"
      />,
    );

    // testid は実装側に明示的に埋められているのでクラス名より安定だが、
    // screen.getByTestId を使うことでクエリも簡潔にする。
    const hint = screen.getByTestId("theme-hint");
    expect(hint.textContent).toBe(copy.themeHint("sakura"));
  });

  it("renders theme select for all three languages", () => {
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
