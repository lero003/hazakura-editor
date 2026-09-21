import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnDeviceModelsPane } from "./OnDeviceModelsPane";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getLModeCopy, getPreferencesCopy } from "../../lib/locale";
import { defaultEditorSettings } from "../../lib/editorSettingsDefaults";

afterEach(cleanup);

describe("OnDeviceModelsPane", () => {
  // jsdom は Tauri ではないため、一覧は catalog を持たない状態へ正直に縮退する。
  // ここで見るのはページの構成で、配布状態の判定そのものは Rust 側のテストが持つ。

  it("is one page: heading, storage explanation, model list, and the recorded settings", async () => {
    render(<OnDeviceModelsPane copy={getPreferencesCopy("ja")} language="ja" />);

    expect(screen.getByRole("heading", { name: "オンデバイスモデル" })).toBeTruthy();
    expect(screen.getByText(/保存先は選べません/)).toBeTruthy();
    expect(await screen.findByText("Apple Intelligence")).toBeTruthy();
    expect(await screen.findByText(/まだ Core AI の生成を記録していません/)).toBeTruthy();
  });

  it("starts nothing on open: no download button and no model work without an explicit action", async () => {
    render(<OnDeviceModelsPane copy={getPreferencesCopy("en")} language="en" />);

    expect(await screen.findByText(/No Core AI model has been published/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("keeps the storage explanation out of a user-chosen folder", () => {
    // 保存先は Apple-hosted asset pack がプロセス単位で決めるため、選ばせる UI を作らない。
    render(<OnDeviceModelsPane copy={getPreferencesCopy("en")} language="en" />);

    expect(screen.getByText(/You cannot choose the location/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Choose|Browse|Save to/i })).toBeNull();
  });

  it("takes focus to the page heading when the Settings body entry opens it", async () => {
    // 入口のボタンは切替で消えるため、放っておくとフォーカスが行き先を失う。
    const copy = getPreferencesCopy("ja");
    function Host() {
      const [page, setPage] = useState<"settings" | "models">("settings");
      return page === "models" ? <OnDeviceModelsPane copy={copy} language="ja" /> : (
        <SettingsPreferencesPane
          copy={copy}
          editorSettings={defaultEditorSettings()}
          lModeCopy={getLModeCopy("ja")}
          menuLanguage="ja"
          onEditorSettingsChange={vi.fn()}
          onMenuLanguageChange={vi.fn()}
          onOpenOnDeviceModels={() => setPage("models")}
          onPreviewVisibleChange={vi.fn()}
          onThemePreferenceChange={vi.fn()}
          previewVisible={true}
          themePreference="light"
        />
      );
    }
    render(<Host />);

    const entry = screen.getByRole("button", { name: copy.openOnDeviceModels });
    act(() => entry.focus());
    expect(document.activeElement).toBe(entry);

    fireEvent.click(entry);

    const heading = await screen.findByRole("heading", { name: copy.onDeviceModels });
    expect(document.activeElement).toBe(heading);
  });

  it("leaves focus on the header selector when the page was switched from there", async () => {
    // ヘッダーの選択で来た場合は、選択したままの操作位置を保つ。
    const copy = getPreferencesCopy("en");
    function Host() {
      const [page, setPage] = useState<"settings" | "models">("settings");
      return <>
        <div className="preferences-header">
          <select
            aria-label="Page"
            value={page}
            onChange={(event) => setPage(event.target.value === "models" ? "models" : "settings")}
          >
            <option value="settings">settings</option>
            <option value="models">models</option>
          </select>
        </div>
        {page === "models" ? <OnDeviceModelsPane copy={copy} language="en" /> : null}
      </>;
    }
    render(<Host />);

    const select = screen.getByRole("combobox", { name: "Page" });
    act(() => select.focus());
    fireEvent.change(select, { target: { value: "models" } });

    await screen.findByRole("heading", { name: copy.onDeviceModels });
    expect(document.activeElement).toBe(select);
  });
});
