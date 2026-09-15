import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateAppMenuState } from "../../lib/tauri";
import { useAppMenuStateSync } from "./useAppMenuStateSync";

vi.mock("../../lib/tauri", () => ({
  updateAppMenuState: vi.fn(),
}));

describe("useAppMenuStateSync", () => {
  beforeEach(() => {
    vi.mocked(updateAppMenuState).mockReset();
    vi.mocked(updateAppMenuState).mockResolvedValue(undefined);
  });

  it("does not rebuild the native menu when only the active tab's buffer changes", async () => {
    const base = {
      activeDirty: false,
      agentWorkbenchActive: false,
      agentWorkbenchConsent: false,
      assistSurfaceActive: "none" as const,
      editorSettings: {
        lModeEnabled: false,
        showInvisibles: false,
        spellcheckEnabled: false,
        wrapLines: false,
      },
      menuLanguage: "ja" as const,
      previewVisible: false,
      recentFiles: [],
      recentFolders: [],
      themePreference: "light" as const,
    };
    const initial = renderHook(
      ({ activeTab }: { activeTab: { id: string } | null }) =>
        useAppMenuStateSync({ activeTab, ...base }),
      {
        initialProps: {
          activeTab: { id: "doc-one" } as { id: string } | null,
        },
      },
    );

    await waitFor(() => {
      expect(updateAppMenuState).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateAppMenuState).mock.calls.at(-1)?.[0])
      .toMatchObject({ hasActiveTab: true });

    // Live editor updates replace the tab object on every character, but
    // menu state only depends on whether an active tab exists.
    initial.rerender({ activeTab: { id: "doc-two" } });
    expect(updateAppMenuState).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the menu when activeTab disappears", async () => {
    const base = {
      activeDirty: false,
      agentWorkbenchActive: false,
      agentWorkbenchConsent: false,
      assistSurfaceActive: "none" as const,
      editorSettings: {
        lModeEnabled: false,
        showInvisibles: false,
        spellcheckEnabled: false,
        wrapLines: false,
      },
      menuLanguage: "ja" as const,
      previewVisible: false,
      recentFiles: [],
      recentFolders: [],
      themePreference: "light" as const,
    };
    const initial = renderHook(
      ({ activeTab }: { activeTab: { id: string } | null }) =>
        useAppMenuStateSync({ activeTab, ...base }),
      {
        initialProps: {
          activeTab: { id: "doc-one" } as { id: string } | null,
        },
      },
    );

    await waitFor(() => {
      expect(updateAppMenuState).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateAppMenuState).mock.calls.at(-1)?.[0])
      .toMatchObject({ hasActiveTab: true });

    initial.rerender({ activeTab: null });
    await waitFor(() => {
      expect(updateAppMenuState).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(updateAppMenuState).mock.calls.at(-1)?.[0])
      .toMatchObject({ hasActiveTab: false });
  });

  it("surfaces menu state sync failures through the status channel", async () => {
    vi.mocked(updateAppMenuState).mockRejectedValue(new Error("ipc failed"));
    const onStatus = vi.fn();

    renderHook(() =>
      useAppMenuStateSync({
        activeTab: null,
        activeDirty: false,
        agentWorkbenchActive: false,
        agentWorkbenchConsent: false,
        assistSurfaceActive: "none",
        editorSettings: {
          lModeEnabled: false,
          showInvisibles: false,
          spellcheckEnabled: false,
          wrapLines: false,
        },
        menuLanguage: "ja",
        onStatus,
        previewVisible: false,
        recentFiles: [],
        recentFolders: [],
        themePreference: "light",
      }),
    );

    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(
        "Failed to update app menu state",
      );
    });
  });
});
