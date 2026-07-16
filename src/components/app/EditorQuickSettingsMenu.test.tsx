import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorQuickSettingsMenu } from "./EditorQuickSettingsMenu";
import type { EditorSettings } from "../../types";

const settings: EditorSettings = {
  ambientIntensity: "subtle",
  appleAssistDiffInitiallyOpen: true,
  outsideImages: "ask",
  loadRemoteImages: false,
  materializeImagesOnExport: true,
  autoBackupEnabled: true,
  editorFontSize: 14,
  lModeEnabled: false,
  lModeFontSize: 15,
  lModeTypewriter: false,
  previewFontSize: 15,
  showInvisibles: false,
  spellcheckEnabled: false,
  tabSize: 2,
  workspaceFontSize: 13,
  wrapLines: true,
};

afterEach(() => {
  cleanup();
});

describe("EditorQuickSettingsMenu", () => {
  it("uses dialog semantics instead of menu for mixed controls", () => {
    render(
      <EditorQuickSettingsMenu
        editorSettings={settings}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Editor settings" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Editor settings" })).toBeTruthy();
    expect(screen.getByLabelText("Wrap lines")).toBeTruthy();
    expect(screen.getByLabelText("Editor font size")).toBeTruthy();
  });

  it("returns focus to the trigger on Escape", () => {
    render(
      <EditorQuickSettingsMenu
        editorSettings={settings}
        menuLanguage="en"
        onEditorSettingsChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Editor settings" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
