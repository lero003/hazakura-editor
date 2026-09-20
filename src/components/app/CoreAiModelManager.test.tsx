import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreAiModelManager } from "./CoreAiModelManager";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  select: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
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
  deleteCoreAiModel: mocks.remove,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CoreAiModelManager", () => {
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
    mocks.download.mockResolvedValue(undefined);
    render(<CoreAiModelManager language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "ダウンロード" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("apple:core-ai:writing-primary"));
  });
});
