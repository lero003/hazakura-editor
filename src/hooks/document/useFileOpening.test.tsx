import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openTextFile } from "../../lib/tauri";
import { useFileOpening } from "./useFileOpening";

vi.mock("../../lib/tauri", () => ({
  createTextFile: vi.fn(),
  openTextFile: vi.fn(),
  pickMarkdownFile: vi.fn(),
  pickNewMarkdownFilePath: vi.fn(),
}));

function setup() {
  const options: Parameters<typeof useFileOpening>[0] = {
    activeTab: null,
    clearImagePreview: vi.fn(),
    menuLanguage: "en",
    openImagePreview: vi.fn(async () => true),
    refreshWorkspaceTree: vi.fn(async () => {}),
    rememberRecentFile: vi.fn(),
    setActiveTabId: vi.fn(),
    setCompareView: vi.fn(),
    setGlobalError: vi.fn(),
    setPendingDrafts: vi.fn(),
    setStatus: vi.fn(),
    setTabs: vi.fn(),
    tabs: [],
    workspaceRootPath: null,
  };

  return {
    options,
    result: renderHook(() => useFileOpening(options)).result,
  };
}

describe("useFileOpening", () => {
  beforeEach(() => {
    vi.mocked(openTextFile).mockReset();
  });

  it("routes directly opened image files to image preview instead of text open", async () => {
    const { options, result } = setup();

    await act(async () => {
      await result.current.openExternalFilePaths(["/outside/photo.png"]);
    });

    expect(options.openImagePreview).toHaveBeenCalledWith("/outside/photo.png");
    expect(openTextFile).not.toHaveBeenCalled();
  });
});
