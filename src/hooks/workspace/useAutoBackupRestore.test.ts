import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoBackupRestore } from "./useAutoBackupRestore";

const listAutoBackups = vi.fn();
const readAutoBackup = vi.fn();

vi.mock("../../lib/tauri/autoBackup", () => ({
  listAutoBackups: (...args: unknown[]) => listAutoBackups(...args),
  readAutoBackup: (...args: unknown[]) => readAutoBackup(...args),
}));

describe("useAutoBackupRestore", () => {
  beforeEach(() => {
    listAutoBackups.mockReset();
    readAutoBackup.mockReset();
  });

  it("loads backups for the given workspace + file", async () => {
    listAutoBackups.mockResolvedValue([
      {
        path: "/r/.hazakura/backups/note.md/20240101_120000_note.md.bak",
        name: "20240101_120000_note.md.bak",
        modifiedAtMs: 1,
        size: 4,
      },
    ]);

    const { result } = renderHook(() => useAutoBackupRestore());

    await act(async () => {
      await result.current.loadBackups({
        workspaceRoot: "/r",
        filePath: "/r/note.md",
      });
    });

    expect(listAutoBackups).toHaveBeenCalledWith("/r", "note.md");
    expect(result.current.backups).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("records the error string when loadBackups throws", async () => {
    listAutoBackups.mockRejectedValue(new Error("disk gone"));

    const { result } = renderHook(() => useAutoBackupRestore());

    await act(async () => {
      await result.current.loadBackups({
        workspaceRoot: "/r",
        filePath: "/r/note.md",
      });
    });

    expect(result.current.error).toContain("disk gone");
    expect(result.current.backups).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("clears the list when the file is not inside the workspace", async () => {
    const { result } = renderHook(() => useAutoBackupRestore());

    await act(async () => {
      await result.current.loadBackups({
        workspaceRoot: "/r",
        filePath: "/elsewhere/note.md",
      });
    });

    expect(listAutoBackups).not.toHaveBeenCalled();
    expect(result.current.backups).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it("reads a backup by name and forwards the workspace + relative path", async () => {
    readAutoBackup.mockResolvedValue("body");

    const { result } = renderHook(() => useAutoBackupRestore());

    const contents = await result.current.readBackup(
      { workspaceRoot: "/r", filePath: "/r/note.md" },
      "20240101_120000_note.md.bak",
    );

    expect(readAutoBackup).toHaveBeenCalledWith(
      "/r",
      "note.md",
      "20240101_120000_note.md.bak",
    );
    expect(contents).toBe("body");
  });

  it("refuses to read a backup when the file is outside the workspace", async () => {
    const { result } = renderHook(() => useAutoBackupRestore());

    await expect(
      result.current.readBackup(
        { workspaceRoot: "/r", filePath: "/elsewhere/note.md" },
        "name",
      ),
    ).rejects.toThrow();
    expect(readAutoBackup).not.toHaveBeenCalled();
  });
});
