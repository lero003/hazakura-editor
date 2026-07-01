import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildTabAgainstDiskChangeReview,
  useCompareExecution,
} from "./useCompareExecution";
import type { EditorTab } from "../../types";

const tauriApi = vi.hoisted(() => ({
  openTextFile: vi.fn(),
}));

vi.mock("../../lib/tauri", () => ({
  openTextFile: tauriApi.openTextFile,
}));

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "draft",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "fingerprint",
    id: "/workspace/a.md",
    sessionId: "/workspace/a.md",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "disk",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "a.md",
    path: "/workspace/a.md",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

describe("buildTabAgainstDiskChangeReview", () => {
  it("returns null when the reviewed tab is gone before disk read completes", async () => {
    const tab = makeTab();
    tauriApi.openTextFile.mockResolvedValueOnce({
      contents: "disk",
    });

    const snapshot = await buildTabAgainstDiskChangeReview(
      tab,
      "en",
      () => null,
    );

    expect(snapshot).toBeNull();
  });

  it("uses the latest tab buffer after disk read completes", async () => {
    const tab = makeTab({ contents: "old draft" });
    const latestTab = makeTab({ contents: "latest draft" });
    tauriApi.openTextFile.mockResolvedValueOnce({
      contents: "disk",
    });

    const snapshot = await buildTabAgainstDiskChangeReview(
      tab,
      "en",
      () => latestTab,
    );

    expect(snapshot?.compareCase.documentPath).toBe("/workspace/a.md");
    expect(snapshot?.compareView.additions).toBeGreaterThan(0);
  });
});

describe("useCompareExecution", () => {
  it("keeps the latest file compare when an older request resolves last", async () => {
    const pendingReads: Array<{
      path: string;
      resolve: (value: { contents: string }) => void;
    }> = [];
    tauriApi.openTextFile.mockImplementation(
      (path: string) =>
        new Promise((resolve) => {
          pendingReads.push({ path, resolve });
        }),
    );
    const setCompareCaseEntry = vi.fn();
    const { result } = renderHook(() =>
      useCompareExecution({
        activeTab: makeTab({
          contents: "left",
          id: "/workspace/left.md",
          name: "left.md",
          path: "/workspace/left.md",
        }),
        clearCompareSource: vi.fn(),
        closeWorkspaceContextMenu: vi.fn(),
        compareAnchor: null,
        compareTarget: null,
        getCurrentTabById: vi.fn(),
        menuLanguage: "en",
        setCompareCaseEntry,
        setCompareSource: vi.fn(),
        setCompareView: vi.fn(),
        setGlobalError: vi.fn(),
        setRightPaneMode: vi.fn(),
        setSidePaneOpen: vi.fn(),
        setStatus: vi.fn(),
      }),
    );

    let olderCompare: Promise<void> = Promise.resolve();
    let latestCompare: Promise<void> = Promise.resolve();
    act(() => {
      olderCompare = result.current.compareWorkspaceFiles({
        name: "old.md",
        path: "/workspace/old.md",
      });
      latestCompare = result.current.compareWorkspaceFiles({
        name: "new.md",
        path: "/workspace/new.md",
      });
    });

    expect(pendingReads.map((read) => read.path)).toEqual([
      "/workspace/old.md",
      "/workspace/new.md",
    ]);

    pendingReads[1].resolve({ contents: "new right" });
    await act(async () => {
      await latestCompare;
    });
    pendingReads[0].resolve({ contents: "old right" });
    await act(async () => {
      await olderCompare;
    });

    expect(setCompareCaseEntry).toHaveBeenCalledTimes(1);
    expect(setCompareCaseEntry.mock.calls[0]?.[0]).toMatchObject({
      rightPath: "/workspace/new.md",
    });
  });
});
