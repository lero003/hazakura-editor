import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGlobalSearch } from "./useGlobalSearch";
import { searchWorkspaceFiles } from "../../lib/tauri/workspace";
vi.mock("../../lib/tauri/workspace", () => ({ searchWorkspaceFiles: vi.fn() }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
const response = (text: string) => ({
  files: [{
    path: "/book/a.md",
    relativePath: "a.md",
    truncated: false,
    matches: [{
      line: 1,
      column: 1,
      text,
      snippetStart: 1,
      matchLength: Array.from(text).length,
      lineLength: Array.from(text).length,
    }],
  }],
  totalMatches: 1,
  totalFilesScanned: 3,
  totalFilesMatched: 1,
  truncated: true,
});
it("invalidates rows and summary immediately, including equal-sized successive results", async () => {
  vi.useFakeTimers();
  vi.mocked(searchWorkspaceFiles).mockResolvedValue(response("apple"));
  const { result } = renderHook(() => useGlobalSearch({ workspaceRoot: "/book", onOpenMatch: vi.fn() }));
  act(() => result.current.openGlobalSearch());
  act(() => result.current.setQuery("apple"));
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(result.current.rows).toHaveLength(1);
  act(() => result.current.setActiveIndex(1));
  act(() => result.current.setQuery("banana"));
  expect(result.current.rows).toEqual([]);
  expect(result.current.summary).toBeNull();
  expect(result.current.activeIndex).toBe(0);
  vi.mocked(searchWorkspaceFiles).mockResolvedValue(response("banana"));
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  expect(result.current.rows[0].match.text).toBe("banana");
  expect(result.current.activeIndex).toBe(0);
});
it.each(["close", "empty", "workspace"])("rejects an in-flight response after %s", async (ending) => {
  vi.useFakeTimers();
  let resolve!: (value: ReturnType<typeof response>) => void;
  vi.mocked(searchWorkspaceFiles).mockReturnValue(new Promise((r) => { resolve = r; }));
  const { result, rerender } = renderHook(({ root }) => useGlobalSearch({ workspaceRoot: root, onOpenMatch: vi.fn() }), { initialProps: { root: "/book" as string | null } });
  act(() => result.current.openGlobalSearch());
  act(() => result.current.setQuery("apple"));
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
  act(() => { if (ending === "close") result.current.closeGlobalSearch(); else if (ending === "empty") result.current.setQuery(""); else rerender({ root: null }); });
  await act(async () => resolve(response("late apple")));
  expect(result.current.rows).toEqual([]);
  expect(result.current.summary).toBeNull();
  expect(result.current.searching).toBe(false);
});
