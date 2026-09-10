import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getPreferencesCopy, getLModeCopy } from "../../lib/locale";
import { defaultEditorSettings } from "../../lib/editorSettingsDefaults";
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
const probe = vi.hoisted(() => vi.fn());
vi.mock("../../lib/tauri", () => ({ probeAppleAssistAvailability: probe }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["en", "ja", "kana"] as const)("does not call an unprobed environment unsupported (%s)", async (language) => {
  let resolve!: (value: {kind: "unsupported"}) => void;
  probe.mockReturnValue(new Promise((done) => { resolve = done; }));
  const copy = getPreferencesCopy(language);
  function Host() {
    const { availability, probed } = useAppleAssistAvailability(true);
    return <SettingsPreferencesPane copy={copy} lModeCopy={getLModeCopy(language)}
      menuLanguage={language} editorSettings={defaultEditorSettings()}
      appleAssistAvailability={availability} appleAssistAvailabilityProbed={probed}
      themePreference="light" previewVisible onEditorSettingsChange={vi.fn()}
      onMenuLanguageChange={vi.fn()} onPreviewVisibleChange={vi.fn()} onThemePreferenceChange={vi.fn()} />;
  }
  render(<Host />);
  expect(screen.getByRole("status", { name: copy.appleAssistStatusLabel }).textContent).not.toContain(copy.appleAssistStatusUnsupported);
  expect(screen.getByRole("status", { name: copy.appleAssistStatusLabel }).textContent).toContain(copy.appleAssistStatusUnprobed);
  await act(async () => resolve({ kind: "unsupported" }));
  expect(screen.getByRole("status", { name: copy.appleAssistStatusLabel }).textContent).toContain(copy.appleAssistStatusUnsupported);
});

it("states what Local Assist never does, next to the availability card (ja)", () => {
  probe.mockResolvedValue({ kind: "available" });
  const copy = getPreferencesCopy("ja");
  render(<SettingsPreferencesPane copy={copy} lModeCopy={getLModeCopy("ja")} menuLanguage="ja"
    editorSettings={defaultEditorSettings()} appleAssistAvailability={{ kind: "available" }}
    appleAssistAvailabilityProbed themePreference="light" previewVisible onEditorSettingsChange={vi.fn()}
    onMenuLanguageChange={vi.fn()} onPreviewVisibleChange={vi.fn()} onThemePreferenceChange={vi.fn()} />);

  // 「しないこと」が実際の文言で並ぶ（モック17の境界説明）。
  expect(screen.getByText("外部AIへ送信しない")).toBeTruthy();
  expect(screen.getByText("反映するのは、自分で")).toBeTruthy();
  expect(screen.getByText("勝手に保存しない")).toBeTruthy();
  expect(screen.getByText("対象は、選んだ文章")).toBeTruthy();
  // 状態はカードの中に1つだけ（同じ文言を二度出さない）。
  expect(screen.getAllByRole("status", { name: copy.appleAssistStatusLabel })).toHaveLength(1);
});

it("shows one preview surface for the type-size settings (モック16)", () => {
  probe.mockResolvedValue({ kind: "available" });
  const copy = getPreferencesCopy("ja");
  render(<SettingsPreferencesPane copy={copy} lModeCopy={getLModeCopy("ja")} menuLanguage="ja"
    editorSettings={defaultEditorSettings()} appleAssistAvailability={{ kind: "available" }}
    appleAssistAvailabilityProbed themePreference="light" previewVisible onEditorSettingsChange={vi.fn()}
    onMenuLanguageChange={vi.fn()} onPreviewVisibleChange={vi.fn()} onThemePreferenceChange={vi.fn()} />);

  expect(screen.getByText(copy.typePreviewCaption)).toBeTruthy();
  // 4つの文字サイズ設定すべてが、それぞれの大きさで1箇所に並ぶ（FB: 中央面が
  // エディタ・えるモードの設定を映していなかった）。
  const settings = defaultEditorSettings();
  const labels = [...document.querySelectorAll(".settings-type-preview-row-label")].map(
    (node) => node.textContent ?? "",
  );
  expect(labels).toHaveLength(4);
  expect(labels[0]).toContain(copy.editorFontSize);
  expect(labels[1]).toContain(copy.previewFontSize);
  expect(labels[2]).toContain(copy.workspaceFontSize);
  expect(labels[3]).toContain(copy.lModeFontSize);
  // 行ごとに実際の設定値が入る（見本と設定値が食い違わない）。
  expect(labels[1]).toContain(String(settings.previewFontSize));
  const rows = [...document.querySelectorAll<HTMLElement>(".settings-type-preview-row-sample")];
  expect(rows.map((row) => row.style.fontSize)).toEqual([
    `${settings.editorFontSize}px`,
    `${settings.previewFontSize}px`,
    `${settings.workspaceFontSize}px`,
    `${settings.lModeFontSize}px`,
  ]);
});
