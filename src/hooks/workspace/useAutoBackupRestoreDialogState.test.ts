import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoBackupRestoreDialogState } from "./useAutoBackupRestoreDialogState";

describe("useAutoBackupRestoreDialogState", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useAutoBackupRestoreDialogState());
    expect(result.current.restoreBackupDialogOpen).toBe(false);
  });

  it("opens and closes", () => {
    const { result } = renderHook(() => useAutoBackupRestoreDialogState());

    act(() => {
      result.current.openRestoreBackupDialog();
    });
    expect(result.current.restoreBackupDialogOpen).toBe(true);

    act(() => {
      result.current.closeRestoreBackupDialog();
    });
    expect(result.current.restoreBackupDialogOpen).toBe(false);
  });

  it("re-opening after close re-flips the flag", () => {
    const { result } = renderHook(() => useAutoBackupRestoreDialogState());

    act(() => {
      result.current.openRestoreBackupDialog();
    });
    act(() => {
      result.current.closeRestoreBackupDialog();
    });
    act(() => {
      result.current.openRestoreBackupDialog();
    });
    expect(result.current.restoreBackupDialogOpen).toBe(true);
  });
});
