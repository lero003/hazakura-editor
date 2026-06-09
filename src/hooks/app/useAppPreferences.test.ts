import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_BACKUP_USER_CHOICE_STORAGE_KEY,
  EDITOR_SETTINGS_STORAGE_KEY,
} from "../../types";
import { useAppPreferences } from "./useAppPreferences";

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
}

describe("useAppPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("keeps auto-backup off by default", () => {
    const { result } = renderHook(() => useAppPreferences());

    expect(result.current.editorSettings.autoBackupEnabled).toBe(false);
  });

  it("treats legacy stored true as off until the user explicitly chooses it", () => {
    window.localStorage.setItem(
      EDITOR_SETTINGS_STORAGE_KEY,
      JSON.stringify({ autoBackupEnabled: true }),
    );

    const { result } = renderHook(() => useAppPreferences());

    expect(result.current.editorSettings.autoBackupEnabled).toBe(false);
  });

  it("preserves explicit auto-backup choice after the user opts in", () => {
    window.localStorage.setItem(AUTO_BACKUP_USER_CHOICE_STORAGE_KEY, "true");
    window.localStorage.setItem(
      EDITOR_SETTINGS_STORAGE_KEY,
      JSON.stringify({ autoBackupEnabled: true }),
    );

    const { result } = renderHook(() => useAppPreferences());

    expect(result.current.editorSettings.autoBackupEnabled).toBe(true);

    act(() => {
      result.current.setEditorSettings((current) => ({
        ...current,
        autoBackupEnabled: false,
      }));
    });

    expect(result.current.editorSettings.autoBackupEnabled).toBe(false);
  });
});
