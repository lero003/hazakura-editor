import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoBackupRestore } from "./useAutoBackupRestore";
import type { AutoBackupEntry } from "../../lib/tauri/autoBackup";

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

  it.each(["success", "failure"])("ignores an older list %s while the new document is still loading", async outcome => {
    let resolveOld!: (entries: AutoBackupEntry[]) => void;
    let rejectOld!: (error: Error) => void;
    let resolveNew!: (entries: AutoBackupEntry[]) => void;
    listAutoBackups.mockReturnValueOnce(new Promise<AutoBackupEntry[]>((res, rej) => { resolveOld = res; rejectOld = rej; }))
      .mockReturnValueOnce(new Promise<AutoBackupEntry[]>(res => { resolveNew = res; }));
    const { result } = renderHook(() => useAutoBackupRestore());
    let oldLoad!: Promise<void>;
    let newLoad!: Promise<void>;
    act(() => { oldLoad = result.current.loadBackups({ workspaceRoot: "/r", filePath: "/r/old.md" }); });
    act(() => { newLoad = result.current.loadBackups({ workspaceRoot: "/r", filePath: "/r/new.md" }); });
    await act(async () => {
      if (outcome === "success") resolveOld([{ name: "old.bak", path: "old.bak", size: 3, modifiedAtMs: 1 }]);
      else rejectOld(new Error("old failure"));
      await oldLoad;
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.backups).toEqual([]);
    expect(result.current.error).toBeNull();
    const latest = [{ name: "new.bak", path: "new.bak", size: 4, modifiedAtMs: 2 }];
    await act(async () => { resolveNew(latest); await newLoad; });
    expect(result.current.backups).toEqual(latest);
    expect(result.current.loading).toBe(false);
  });

  it.each([null, "/other"])("invalidates a pending list when workspace becomes %s", async workspaceRoot => {
    let resolve!: (entries: AutoBackupEntry[]) => void;
    listAutoBackups.mockReturnValueOnce(new Promise<AutoBackupEntry[]>(res => { resolve = res; }));
    const { result } = renderHook(() => useAutoBackupRestore());
    let loading!: Promise<void>;
    act(() => { loading = result.current.loadBackups({ workspaceRoot: "/r", filePath: "/r/note.md" }); });
    await act(async () => { await result.current.loadBackups({ workspaceRoot, filePath: "/r/note.md" }); });
    await act(async () => { resolve([{ name: "old.bak", path: "old.bak", size: 3, modifiedAtMs: 1 }]); await loading; });
    expect(result.current.backups).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("clears the previous document list as soon as a new load starts", async () => {
    listAutoBackups.mockResolvedValueOnce([{ name: "old.bak", path: "old.bak", size: 3, modifiedAtMs: 1 }]);
    const { result } = renderHook(() => useAutoBackupRestore());
    await act(async () => { await result.current.loadBackups({ workspaceRoot: "/r", filePath: "/r/old.md" }); });
    let resolve!: (entries: AutoBackupEntry[]) => void;
    listAutoBackups.mockReturnValueOnce(new Promise<AutoBackupEntry[]>(res => { resolve = res; }));
    let loading!: Promise<void>;
    act(() => { loading = result.current.loadBackups({ workspaceRoot: "/r", filePath: "/r/new.md" }); });
    expect(result.current.backups).toEqual([]);
    await act(async () => { resolve([]); await loading; });
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
