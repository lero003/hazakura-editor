import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PreferencesDialog } from "./PreferencesDialog";
import type { PreferencesDialogMode } from "../../types";
afterEach(cleanup);
it("moves between settings and existing Help modes in the same dialog without losing the selector", () => {
  function Host() {
    const [mode, setMode] = useState<PreferencesDialogMode>("settings");
    return <PreferencesDialog mode={mode} title="Settings" closeLabel="Close" onClose={vi.fn()}
      closeButtonRef={{ current: null }} dialogRef={{ current: null }} onChangeMode={setMode}>
      <p>{mode}</p>
    </PreferencesDialog>;
  }
  render(<Host />);
  const select = screen.getByRole("combobox", { name: "Settings / Help" });
  select.focus();
  for (const value of ["about", "privacy", "privacy-policy", "diagnostics", "books-and-knowledge-folders", "open-source-acknowledgements", "settings"]) {
    fireEvent.change(select, { target: { value } });
    expect(document.activeElement).toBe(select);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText(value)).toBeTruthy();
  }
});

it("uses the menu language for navigation and keeps the selector in the header", () => {
  render(<PreferencesDialog mode="settings" title="設定" closeLabel="閉じる" onClose={vi.fn()}
    menuLanguage="ja" closeButtonRef={{ current: null }} dialogRef={{ current: null }} onChangeMode={vi.fn()}>
    <p>本文</p>
  </PreferencesDialog>);
  const select = screen.getByRole("combobox", { name: "設定 / ヘルプ" });
  expect(select.closest(".preferences-header")).toBeTruthy();
  expect(screen.getByRole("option", { name: "設定" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "ローカルデータの説明" })).toBeTruthy();
});

it("reaches the on-device model page from the same selector without closing the dialog", () => {
  function Host() {
    const [mode, setMode] = useState<PreferencesDialogMode>("settings");
    return <PreferencesDialog mode={mode} title="Settings" closeLabel="Close" onClose={vi.fn()}
      modelsLabel="On-device models"
      closeButtonRef={{ current: null }} dialogRef={{ current: null }} onChangeMode={setMode}>
      <p>{mode}</p>
    </PreferencesDialog>;
  }
  render(<Host />);
  const select = screen.getByRole("combobox", { name: "Settings / Help" });
  expect(screen.getByRole("option", { name: "On-device models" })).toBeTruthy();

  fireEvent.change(select, { target: { value: "models" } });

  expect(screen.getByText("models")).toBeTruthy();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  // 設定ページと同じ枠のまま切り替わる（ヘルプ文書の枠へ化けない）。
  expect(screen.getByRole("dialog").className).toContain("settings-dialog");
});
