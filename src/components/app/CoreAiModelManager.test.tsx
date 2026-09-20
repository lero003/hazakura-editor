import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreAiModelManager } from "./CoreAiModelManager";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  select: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  listener: null as null | ((catalog: unknown) => void),
}));

vi.mock("../../lib/tauri/coreAiModels", () => ({
  unavailableCoreAiModelCatalog: () => ({
    distributionStatus: "not_published",
    selectedModelId: "apple:foundation-models:system-default",
    models: [{
      id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
      kind: "system", status: "ready", selected: true,
    }],
  }),
  listCoreAiModels: mocks.list,
  selectLocalAssistModel: mocks.select,
  startCoreAiModelDownload: mocks.download,
  cancelCoreAiModelDownload: mocks.cancel,
  deleteCoreAiModel: mocks.remove,
  listenCoreAiModelStateChanges: vi.fn(async (listener: (catalog: unknown) => void) => {
    mocks.listener = listener;
    return () => { mocks.listener = null; };
  }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.listener = null; });

describe("CoreAiModelManager", () => {
  it("reports startup storage errors and disables model management only", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available", selectedModelId: "apple:foundation-models:system-default",
      managementError: "Failed to prepare Core AI app data: permission denied",
      models: [{ id: "apple:core-ai:future", displayName: "Future", kind: "core_ai", status: "not_downloaded", selected: false }],
    });
    render(<CoreAiModelManager language="ja" />);
    expect((await screen.findByRole("alert")).textContent).toContain("permission denied");
    expect(screen.getByRole("alert").textContent).toContain("文書の編集は続けられます");
    expect(screen.getByRole("button", { name: "ダウンロード" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows the honest pre-CDN state without a placeholder production model", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published",
      selectedModelId: "apple:foundation-models:system-default",
      models: [{
        id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
        kind: "system", status: "ready", selected: true,
      }],
    });
    render(<CoreAiModelManager language="ja" />);
    expect(await screen.findByText(/Core AI モデルはまだ配布されていません/)).toBeTruthy();
    expect(screen.getByText("Apple Intelligence")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ダウンロード" })).toBeNull();
  });

  it("explains the Developer override without offering to replace it with System", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published", selectedModelId: "apple:core-ai:qwen3-0.6b-test",
      selectionLocked: true,
      models: [{ id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: false }],
    });
    render(<CoreAiModelManager language="ja" />);
    expect(await screen.findByText(/Developer用のテストモデル指定が有効/)).toBeTruthy();
    const select = screen.getByRole("button", { name: "使う" });
    expect(select.hasAttribute("disabled")).toBe(true);
    fireEvent.click(select);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(screen.queryByText("選択中")).toBeNull();
  });

  it("offers download only for a catalog model marked not downloaded", async () => {
    const catalog = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        { id: "apple:core-ai:writing-primary", displayName: "Hazakura Core AI", kind: "core_ai", status: "not_downloaded", selected: false },
      ],
    };
    mocks.list.mockResolvedValue(catalog);
    mocks.download.mockResolvedValue({
      ...catalog,
      models: catalog.models.map((model) => model.kind === "core_ai"
        ? { ...model, status: "downloading", progress: 0 }
        : model),
    });
    render(<CoreAiModelManager language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "ダウンロード" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("apple:core-ai:writing-primary"));
  });

  it("tracks progress events and supports cancel then resume", async () => {
    const downloading = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        { id: "apple:core-ai:e4b", displayName: "Gemma 4 E4B", kind: "core_ai", status: "downloading", selected: false, progress: 0.42 },
      ],
    };
    mocks.list.mockResolvedValue(downloading);
    mocks.cancel.mockResolvedValue(true);
    render(<CoreAiModelManager language="ja" />);
    expect(await screen.findByText("ダウンロード中 · 42%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith("apple:core-ai:e4b"));

    act(() => {
      mocks.listener?.({
        ...downloading,
        models: downloading.models.map((model) => model.kind === "core_ai"
          ? { ...model, status: "paused", progress: null }
          : model),
      });
    });
    expect(await screen.findByRole("button", { name: "再開" })).toBeTruthy();
  });
});
