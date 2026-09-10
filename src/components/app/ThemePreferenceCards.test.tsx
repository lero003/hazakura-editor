import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { ThemePreferenceCards } from "./ThemePreferenceCards";
import { getPreferencesCopy } from "../../lib/locale";
import type { MenuLanguage, ThemePreference } from "../../types";
afterEach(cleanup);
it.each(["en", "ja", "kana"] as MenuLanguage[])("preserves all seven theme IDs and actual selection (%s)", (language) => {
  const changed = vi.fn();
  function Host() {
    const [value, setValue] = useState<ThemePreference>("light");
    return <ThemePreferenceCards copy={getPreferencesCopy(language)} language={language}
      value={value} onChange={(next) => { changed(next); setValue(next); }} />;
  }
  render(<Host />);
  const copy = getPreferencesCopy(language);
  expect(screen.getAllByRole("button")).toHaveLength(7);
  for (const id of ["light", "dark", "yakou", "shokou", "edohigan", "shinkai", "crt"] as const) {
    const button = screen.getByRole("button", { name: copy[id] });
    fireEvent.click(button);
    expect(changed).toHaveBeenLastCalledWith(id);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
    expect(screen.getByTestId("theme-hint").textContent).toBe(copy.themeHint(id));
  }
});
