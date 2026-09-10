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
