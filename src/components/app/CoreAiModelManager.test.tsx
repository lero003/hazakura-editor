import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoreAiModelManager } from "./CoreAiModelManager";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  select: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  listen: vi.fn(),
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
  listenCoreAiModelStateChanges: mocks.listen,
}));

beforeEach(() => {
  mocks.listen.mockImplementation(async (listener: (catalog: unknown) => void) => {
    mocks.listener = listener;
    return () => { mocks.listener = null; };
  });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.listener = null; });

describe("CoreAiModelManager", () => {
  it("reports startup storage errors and disables model management only", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available", selectedModelId: "apple:foundation-models:system-default",
      managementError: "Failed to prepare Core AI app data: permission denied",
      models: [{ id: "apple:core-ai:future", displayName: "Future", kind: "core_ai", status: "not_downloaded", selected: false }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
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
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    expect(await screen.findByText(/Core AI モデルはまだ配布されていません/)).toBeTruthy();
    expect(screen.getByText("Apple Intelligence")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ダウンロード" })).toBeNull();
  });

  it("shows a detected app-managed local model without Apple-hosted actions", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        {
          id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
          kind: "system", source: "apple_hosted", status: "ready", selected: true,
        },
        {
          id: "local:app-managed:MyQwen", displayName: "My Qwen 3",
          kind: "core_ai", source: "app_managed_local", status: "detected", selected: false,
        },
      ],
    });

    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText("My Qwen 3 · ローカル")).toBeTruthy();
    expect(screen.getByText("検出済み（生成はまだ利用できません）")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "使う" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ダウンロード" })).toBeNull();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });

  it("localizes a broken local bundle reason and does not offer retry", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        {
          id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
          kind: "system", source: "apple_hosted", status: "ready", selected: true,
        },
        {
          id: "local:app-managed:Broken", displayName: "Broken",
          kind: "core_ai", source: "app_managed_local", status: "failed", selected: false,
          errorCode: "missing-tokenizer",
        },
      ],
    });

    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText("Broken · ローカル")).toBeTruthy();
    expect(screen.getByText("実行に必要なTokenizerが見つかりません。")).toBeTruthy();
    expect(screen.queryByText("missing-tokenizer")).toBeNull();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });

  it("explains the Developer override without offering to replace it with System", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published", selectedModelId: "apple:core-ai:qwen3-0.6b-test",
      selectionLocked: true,
      models: [{ id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: false }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
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
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "ダウンロード" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("apple:core-ai:writing-primary"));
  });

  it("tracks progress events and supports cancel then resume", async () => {
    const downloading = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        {
          id: "apple:core-ai:e4b", displayName: "Gemma 4 E4B", kind: "core_ai",
          status: "downloading", selected: false, progress: 0.42, installedSizeBytes: 6_807_926_119,
        },
      ],
    };
    mocks.list.mockResolvedValue(downloading);
    mocks.cancel.mockResolvedValue(true);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    expect(await screen.findByText("ダウンロード中 · 42%")).toBeTruthy();
    expect(screen.getByText("インストール後 約6.8 GB")).toBeTruthy();
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

  it("shows model requirements and requires confirmation below the recommended memory", async () => {
    const catalog = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      deviceMemoryGb: 16,
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        {
          id: "apple:core-ai:gemma-4-12b-it-int8-v1", displayName: "Gemma 4 12B",
          kind: "core_ai", status: "not_downloaded", selected: false,
          downloadSizeBytes: 9_148_924_300, installedSizeBytes: 14_698_433_203,
          recommendedMemoryGb: 32, license: "Apache-2.0", hasUpstreamConversionNotice: true,
        },
      ],
    };
    mocks.list.mockResolvedValue(catalog);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText(/推奨メモリ 32 GB/)).toBeTruthy();
    expect(screen.getByText(/このMacは16 GB/)).toBeTruthy();
    expect(screen.getByText(/Apache-2.0.*変換元のライセンス文書/)).toBeTruthy();
    expect(screen.getByText(/インストール後 約14.7 GB/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ダウンロード" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(mocks.download).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("subscribes before reading the initial catalog", async () => {
    let resolveListen: ((stop: () => void) => void) | undefined;
    mocks.listen.mockImplementation(
      () => new Promise<() => void>((resolve) => { resolveListen = resolve; }),
    );
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published",
      selectedModelId: "apple:foundation-models:system-default",
      models: [],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    await waitFor(() => expect(mocks.listen).toHaveBeenCalledTimes(1));
    expect(mocks.list).not.toHaveBeenCalled();
    act(() => resolveListen?.(() => undefined));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
  });

  it("does not replace a newer progress event with a late stale snapshot", async () => {
    const stale = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [{
        id: "apple:core-ai:gemma-4-12b-it-int8-v1", displayName: "Gemma 4 12B",
        kind: "core_ai", status: "not_downloaded", selected: false,
      }],
    };
    const newer = {
      ...stale,
      models: stale.models.map((model) => ({ ...model, status: "downloading", progress: 0.64 })),
    };
    let resolveList: ((value: unknown) => void) | undefined;
    mocks.list.mockImplementation(() => new Promise((resolve) => { resolveList = resolve; }));
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    act(() => { mocks.listener?.(newer); });
    expect(screen.getByText("ダウンロード中 · 64%")).toBeTruthy();
    act(() => resolveList?.(stale));

    await waitFor(() => expect(screen.queryByText("未ダウンロード")).toBeNull());
    expect(screen.getByText("ダウンロード中 · 64%")).toBeTruthy();
  });

  it("does not replace a newer event with a late stale action response", async () => {
    const ready = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        { id: "apple:core-ai:e4b", displayName: "Gemma 4 E4B", kind: "core_ai", status: "not_downloaded", selected: false },
      ],
    };
    const staleAction = {
      ...ready,
      models: ready.models.map((model) => model.kind === "core_ai"
        ? { ...model, status: "downloading", progress: 0 }
        : model),
    };
    const newerEvent = {
      ...ready,
      models: ready.models.map((model) => model.kind === "core_ai"
        ? { ...model, status: "downloading", progress: 0.71 }
        : model),
    };
    let resolveDownload: ((value: unknown) => void) | undefined;
    mocks.list.mockResolvedValue(ready);
    mocks.download.mockImplementation(() => new Promise((resolve) => { resolveDownload = resolve; }));
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    fireEvent.click(await screen.findByRole("button", { name: "ダウンロード" }));
    act(() => { mocks.listener?.(newerEvent); });
    expect(screen.getByText("ダウンロード中 · 71%")).toBeTruthy();
    act(() => resolveDownload?.(staleAction));

    await waitFor(() => expect(screen.getByText("ダウンロード中 · 71%")).toBeTruthy());
    expect(screen.queryByText("ダウンロード中 · 0%")).toBeNull();
  });

  it("falls back to a snapshot when event subscription fails", async () => {
    mocks.listen.mockRejectedValue(new Error("listener unavailable"));
    mocks.list.mockResolvedValue({
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      deviceMemoryGb: 24,
      models: [{
        id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
        kind: "system", status: "ready", selected: true,
      }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    expect(await screen.findByText(/現在のモデル.*Apple Intelligence/)).toBeTruthy();
    expect(screen.getByText(/このMacのメモリ.*24 GB/)).toBeTruthy();
  });

  it("confirms deletion with size, redownload, and selected-model fallback", async () => {
    const catalog = {
      distributionStatus: "available",
      selectedModelId: "apple:core-ai:e4b",
      models: [{
        id: "apple:core-ai:e4b", displayName: "Gemma 4 E4B", kind: "core_ai",
        status: "ready", selected: true, installedSizeBytes: 6_807_926_119,
      }],
    };
    mocks.list.mockResolvedValue(catalog);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "削除" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(
      /Gemma 4 E4B.*約6.8 GB.*再ダウンロード.*Apple Intelligence/,
    ));
    expect(mocks.remove).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
