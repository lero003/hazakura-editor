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
  await act(async () => resolve({ kind: "unsupported" }));
  expect(screen.getByRole("status", { name: copy.appleAssistStatusLabel }).textContent).toContain(copy.appleAssistStatusUnsupported);
});
