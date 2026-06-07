import { describe, expect, it, vi } from "vitest";
import { buildTabAgainstDiskChangeReview } from "./useCompareExecution";
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
