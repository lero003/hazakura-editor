import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorTab } from "../../types";
import { useAutoBackup } from "./useAutoBackup";

const tauriApi = vi.hoisted(() => ({
  pruneAutoBackups: vi.fn(),
  saveAutoBackup: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  pruneAutoBackups: tauriApi.pruneAutoBackups,
  saveAutoBackup: tauriApi.saveAutoBackup,
}));

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "saved",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/note.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "saved",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "note.md",
    path: "/workspace/note.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

async function tickAutoBackupInterval() {
  await act(async () => {
    vi.advanceTimersByTime(30000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useAutoBackup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tauriApi.pruneAutoBackups.mockReset();
    tauriApi.saveAutoBackup.mockReset();
    tauriApi.saveAutoBackup.mockResolvedValue("/backup");
    tauriApi.pruneAutoBackups.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not write or prune backups when every tab is clean", async () => {
    renderHook(() =>
      useAutoBackup({
        enabled: true,
        tabs: [makeTab()],
        workspaceRootPath: "/workspace",
      }),
    );

    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).not.toHaveBeenCalled();
    expect(tauriApi.pruneAutoBackups).not.toHaveBeenCalled();
  });

  it("backs up and prunes only dirty workspace tabs", async () => {
    renderHook(() =>
      useAutoBackup({
        enabled: true,
        tabs: [
          makeTab({ contents: "draft" }),
          makeTab({
            id: "/workspace/clean.md",
            name: "clean.md",
            path: "/workspace/clean.md",
          }),
        ],
        workspaceRootPath: "/workspace",
      }),
    );

    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).toHaveBeenCalledTimes(1);
    expect(tauriApi.saveAutoBackup).toHaveBeenCalledWith(
      "/workspace",
      "note.md",
      "draft",
    );
    expect(tauriApi.pruneAutoBackups).toHaveBeenCalledWith(
      "/workspace",
      "note.md",
      30,
    );
  });

  it("does not create repeated backups when dirty content has not changed", async () => {
    renderHook(() =>
      useAutoBackup({
        enabled: true,
        tabs: [makeTab({ contents: "draft" })],
        workspaceRootPath: "/workspace",
      }),
    );

    await tickAutoBackupInterval();
    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).toHaveBeenCalledTimes(1);
    expect(tauriApi.pruneAutoBackups).toHaveBeenCalledTimes(1);
  });

  it("creates another backup after dirty content changes", async () => {
    const { rerender } = renderHook(
      ({ tabs }) =>
        useAutoBackup({
          enabled: true,
          tabs,
          workspaceRootPath: "/workspace",
        }),
      {
        initialProps: {
          tabs: [makeTab({ contents: "draft" })],
        },
      },
    );

    await tickAutoBackupInterval();
    rerender({ tabs: [makeTab({ contents: "draft\nmore" })] });
    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).toHaveBeenCalledTimes(2);
    expect(tauriApi.saveAutoBackup).toHaveBeenLastCalledWith(
      "/workspace",
      "note.md",
      "draft\nmore",
    );
  });

  // v0.18 UX polish — encoding-only dirty indication.
  // The shared `isDirty()` covers encoding, so the
  // auto-backup loop must pick up encoding-only dirty
  // tabs and treat an encoding change as a new backup
  // signature. Repeated ticks must not pile up backups
  // for the same unchanged encoding-only state.

  it("backs up and prunes encoding-only dirty tabs", async () => {
    renderHook(() =>
      useAutoBackup({
        enabled: true,
        tabs: [
          // contents / line ending match the saved baseline,
          // but encoding was flipped (the user picked a new
          // encoding in the selector — the actual byte
          // rewrite happens on the next save).
          makeTab({ encoding: "shift-jis" }),
        ],
        workspaceRootPath: "/workspace",
      }),
    );

    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).toHaveBeenCalledTimes(1);
    expect(tauriApi.saveAutoBackup).toHaveBeenCalledWith(
      "/workspace",
      "note.md",
      "saved",
    );
    expect(tauriApi.pruneAutoBackups).toHaveBeenCalledWith(
      "/workspace",
      "note.md",
      30,
    );
  });

  it("does not create repeated backups for an unchanged encoding-only dirty tab", async () => {
    renderHook(() =>
      useAutoBackup({
        enabled: true,
        tabs: [makeTab({ encoding: "shift-jis" })],
        workspaceRootPath: "/workspace",
      }),
    );

    await tickAutoBackupInterval();
    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).toHaveBeenCalledTimes(1);
    expect(tauriApi.pruneAutoBackups).toHaveBeenCalledTimes(1);
  });

  it("creates another backup when only the encoding changes", async () => {
    const { rerender } = renderHook(
      ({ tabs }) =>
        useAutoBackup({
          enabled: true,
          tabs,
          workspaceRootPath: "/workspace",
        }),
      {
        initialProps: {
          tabs: [makeTab({ encoding: "shift-jis" })],
        },
      },
    );

    await tickAutoBackupInterval();
    // Same contents, same line ending — only the encoding
    // changes. Because encoding is part of the backup
    // signature, this must produce a fresh backup.
    rerender({ tabs: [makeTab({ encoding: "euc-jp" })] });
    await tickAutoBackupInterval();

    expect(tauriApi.saveAutoBackup).toHaveBeenCalledTimes(2);
    expect(tauriApi.saveAutoBackup).toHaveBeenLastCalledWith(
      "/workspace",
      "note.md",
      "saved",
    );
  });
});
