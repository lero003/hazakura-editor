import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoreAiModelManager } from "./CoreAiModelManager";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  select: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  pickFolder: vi.fn(),
  generateCandidate: vi.fn(),
  prepareGeneration: vi.fn(),
  finishGeneration: vi.fn(),
  stopGeneration: vi.fn(),
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
  registerExternalCoreAiModel: mocks.register,
  unregisterExternalCoreAiModel: mocks.unregister,
  listenCoreAiModelStateChanges: mocks.listen,
}));

vi.mock("../../lib/tauri/dialog", () => ({ pickCoreAiModelFolder: mocks.pickFolder }));
vi.mock("../../lib/tauri/appleAssist", () => ({
  generateAppleAssistCandidate: mocks.generateCandidate,
  prepareAppleAssistGeneration: mocks.prepareGeneration,
  finishAppleAssistGeneration: mocks.finishGeneration,
  stopAppleAssistGeneration: mocks.stopGeneration,
}));

beforeEach(() => {
  mocks.generateCandidate.mockReset();
  mocks.prepareGeneration.mockReset();
  mocks.finishGeneration.mockReset();
  mocks.stopGeneration.mockReset();
  mocks.prepareGeneration.mockResolvedValue(undefined);
  mocks.finishGeneration.mockResolvedValue(undefined);
  mocks.stopGeneration.mockResolvedValue(true);
  mocks.listen.mockImplementation(async (listener: (catalog: unknown) => void) => {
    mocks.listener = listener;
    return () => { mocks.listener = null; };
  });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.listener = null; });

describe("CoreAiModelManager", () => {
  it("runs an explicit normal generation check for the selected external model without document text", async () => {
    const externalId = "local:external:1";
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published",
      selectedModelId: externalId,
      models: [{ id: externalId, displayName: "My Model", kind: "core_ai",
        source: "external_local", status: "detected", selected: true }],
    });
    mocks.generateCandidate.mockResolvedValue({
      operation: "rephrase", candidateText: "春風が心地よいです。", modelId: externalId, latencyMs: 100,
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "短い例文で試す" }));
    await waitFor(() => expect(mocks.generateCandidate).toHaveBeenCalledWith(
      { operation: "rephrase", selectedText: "春の風が心地よいです。" },
      expect.stringMatching(/^model-check-/),
    ));
    expect(mocks.prepareGeneration).toHaveBeenCalledWith(expect.stringMatching(/^model-check-/));
    expect(await screen.findByText("このモデルで生成できました。文書は変更していません。")).toBeTruthy();
    expect(screen.getByText("春風が心地よいです。")).toBeTruthy();
    await waitFor(() => expect(mocks.finishGeneration).toHaveBeenCalledWith(expect.stringMatching(/^model-check-/)));
    expect(mocks.stopGeneration).not.toHaveBeenCalled();
  });

  it("stops a model check before dispatch without starting normal generation", async () => {
    const externalId = "local:external:1";
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published", selectedModelId: externalId,
      models: [{ id: externalId, displayName: "My Model", kind: "core_ai",
        source: "external_local", status: "detected", selected: true }],
    });
    let completePrepare!: () => void;
    mocks.prepareGeneration.mockImplementation(() => new Promise<void>((resolve) => { completePrepare = resolve; }));
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "短い例文で試す" }));
    fireEvent.click(await screen.findByRole("button", { name: "確認を中止" }));
    await act(async () => completePrepare());
    await waitFor(() => expect(mocks.finishGeneration).toHaveBeenCalledWith(expect.stringMatching(/^model-check-/)));
    expect(mocks.generateCandidate).not.toHaveBeenCalled();
    expect(await screen.findByText("確認を中止しました。文書は変更していません。")).toBeTruthy();
  });

  it("stops an in-flight normal model check by its request id", async () => {
    const externalId = "local:external:1";
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published", selectedModelId: externalId,
      models: [{ id: externalId, displayName: "My Model", kind: "core_ai",
        source: "external_local", status: "detected", selected: true }],
    });
    let rejectGeneration!: (reason: Error) => void;
    mocks.generateCandidate.mockImplementation(() => new Promise((_resolve, reject) => { rejectGeneration = reject; }));
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "短い例文で試す" }));
    await waitFor(() => expect(mocks.generateCandidate).toHaveBeenCalledOnce());
    const requestId = mocks.generateCandidate.mock.calls[0]?.[1] as string;
    fireEvent.click(screen.getByRole("button", { name: "確認を中止" }));
    await waitFor(() => expect(mocks.stopGeneration).toHaveBeenCalledWith(requestId));
    await act(async () => rejectGeneration(new Error("Hazakura Local Assist generation cancelled by user.")));
    expect(await screen.findByText("確認を中止しました。文書は変更していません。")).toBeTruthy();
    await waitFor(() => expect(mocks.finishGeneration).toHaveBeenCalledWith(requestId));
    expect(screen.queryByText("このモデルで生成できました。文書は変更していません。")).toBeNull();
  });

  it("does not report success when generation came from a different selected model", async () => {
    const externalId = "local:external:1";
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published", selectedModelId: externalId,
      models: [{ id: externalId, displayName: "My Model", kind: "core_ai",
        source: "external_local", status: "detected", selected: true }],
    });
    mocks.generateCandidate.mockResolvedValue({
      operation: "rephrase", candidateText: "春風が心地よいです。", modelId: "local:external:other", latencyMs: 100,
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "短い例文で試す" }));
    expect(await screen.findByText("このモデルで生成できませんでした。文書は変更していません。")).toBeTruthy();
    expect(screen.queryByText("このモデルで生成できました。文書は変更していません。")).toBeNull();
  });

  it("clears an old check result after switching models and back", async () => {
    const externalId = "local:external:1";
    const systemId = "apple:foundation-models:system-default";
    const models = [
      { id: externalId, displayName: "My Model", kind: "core_ai",
        source: "external_local", status: "detected" },
      { id: systemId, displayName: "Apple Intelligence", kind: "system",
        source: "apple_hosted", status: "ready" },
    ];
    const catalogFor = (selectedModelId: string) => ({
      distributionStatus: "not_published", selectedModelId,
      models: models.map((model) => ({ ...model, selected: model.id === selectedModelId })),
    });
    mocks.list.mockResolvedValue(catalogFor(externalId));
    mocks.generateCandidate.mockResolvedValue({
      operation: "rephrase", candidateText: "春風が心地よいです。", modelId: externalId, latencyMs: 100,
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "短い例文で試す" }));
    expect(await screen.findByText("このモデルで生成できました。文書は変更していません。")).toBeTruthy();
    await act(async () => mocks.listener?.(catalogFor(systemId)));
    await act(async () => mocks.listener?.(catalogFor(externalId)));
    expect(screen.queryByText("このモデルで生成できました。文書は変更していません。")).toBeNull();
  });

  it("cancels an in-flight check when the model manager closes", async () => {
    const externalId = "local:external:1";
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published", selectedModelId: externalId,
      models: [{ id: externalId, displayName: "My Model", kind: "core_ai",
        source: "external_local", status: "detected", selected: true }],
    });
    let rejectGeneration!: (reason: Error) => void;
    mocks.generateCandidate.mockImplementation(() => new Promise((_resolve, reject) => { rejectGeneration = reject; }));
    const view = render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(await screen.findByRole("button", { name: "短い例文で試す" }));
    await waitFor(() => expect(mocks.generateCandidate).toHaveBeenCalledOnce());
    const requestId = mocks.generateCandidate.mock.calls[0]?.[1] as string;
    view.unmount();
    await waitFor(() => expect(mocks.stopGeneration).toHaveBeenCalledWith(requestId));
    await act(async () => rejectGeneration(new Error("Hazakura Local Assist generation cancelled by user.")));
    await waitFor(() => expect(mocks.finishGeneration).toHaveBeenCalledWith(requestId));
  });

  it("explains that Apple-hosted downloads need TestFlight in a local preview", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [{
        id: "apple:core-ai:gemma4-e4b", displayName: "Gemma 4 E4B",
        kind: "core_ai", source: "apple_hosted", status: "unsupported",
        errorCode: "local-preview", selected: false,
      }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    const row = await screen.findByRole("group", { name: "Gemma 4 E4B" });
    expect(row.textContent).toContain("このプレビューでは取得できません");
    expect(row.textContent).toContain("TestFlight版");
    expect(row.textContent).not.toContain("macOS 27以降が必要");
    expect(screen.queryByRole("button", { name: "ダウンロード" })).toBeNull();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });

  it("registers, selects, and unregisters an external folder without deleting its files", async () => {
    const system = { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
      kind: "system", source: "apple_hosted", status: "ready", selected: true };
    const external = { id: "local:external:1", displayName: "My Model", kind: "core_ai",
      source: "external_local", status: "detected", selected: false };
    const initial = { distributionStatus: "not_published", selectedModelId: system.id, models: [system] };
    const added = { ...initial, models: [system, external] };
    mocks.list.mockResolvedValue(initial);
    mocks.pickFolder.mockResolvedValue("/chosen/model");
    mocks.register.mockResolvedValue(added);
    mocks.select.mockResolvedValue({
      ...added,
      selectedModelId: external.id,
      models: [{ ...system, selected: false }, { ...external, selected: true }],
    });
    mocks.unregister.mockResolvedValue(initial);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    await screen.findByText("Apple Intelligence");
    fireEvent.click(screen.getByRole("button", { name: "モデルフォルダを追加…" }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith("/chosen/model"));
    expect(await screen.findByRole("group", { name: "My Model" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "My Model" }).textContent).toContain("検出済み（選択できます）");
    fireEvent.click(screen.getByRole("button", { name: "使う" }));
    await waitFor(() => expect(mocks.select).toHaveBeenCalledWith(external.id));
    expect(await screen.findByText("現在のモデル：My Model")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "一覧から外す" }));
    await waitFor(() => expect(mocks.unregister).toHaveBeenCalledWith(external.id));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("元のファイルは削除しません"));
    confirm.mockRestore();
  });

  it("explains a folder missing its tokenizer without exposing the native error first", async () => {
    mocks.list.mockResolvedValue({ distributionStatus: "not_published",
      selectedModelId: "apple:foundation-models:system-default", models: [] });
    mocks.pickFolder.mockResolvedValue("/chosen/incomplete");
    mocks.register.mockRejectedValue("local-model:missing-tokenizer");
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "モデルフォルダを追加…" }));
    expect((await screen.findByRole("alert")).textContent).toContain("実行に必要なTokenizerが見つかりません");
  });
  it("reports startup storage errors and disables model management only", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available", selectedModelId: "apple:foundation-models:system-default",
      managementError: "Failed to prepare Core AI app data: permission denied",
      models: [{ id: "apple:core-ai:future", displayName: "Future", kind: "core_ai", status: "not_downloaded", selected: false }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("permission denied");
    expect(alert.querySelector("details")?.open).toBe(false);
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

  it("allows a detected app-managed local model to be selected without asset actions", async () => {
    const catalog = {
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
    };
    mocks.list.mockResolvedValue(catalog);
    mocks.select.mockResolvedValue({
      ...catalog,
      selectedModelId: "local:app-managed:MyQwen",
      models: catalog.models.map((model) => ({
        ...model,
        selected: model.id === "local:app-managed:MyQwen",
      })),
    });

    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText("My Qwen 3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "短い例文で試す" })).toBeNull();
    expect(screen.getByText("ローカル")).toBeTruthy();
    expect(screen.getByText("検出済み（選択できます）")).toBeTruthy();
    const select = screen.getByRole("button", { name: "使う" });
    select.focus();
    fireEvent.click(select);
    await waitFor(() => expect(mocks.select).toHaveBeenCalledWith("local:app-managed:MyQwen"));
    expect(await screen.findByRole("button", { name: "短い例文で試す" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "My Qwen 3" }),
    ));
    expect(screen.queryByRole("button", { name: "ダウンロード" })).toBeNull();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
  });

  it.each([
    ["ja", "現在のモデル：ローカルモデルが見つかりません", "使う", "現在のモデル：Apple Intelligence"],
    ["en", "Current model: Local model unavailable", "Use", "Current model: Apple Intelligence"],
    ["kana", "いまの もでる：ろーかるもでるが ありません", "つかふ", "いまの もでる：Apple Intelligence"],
  ] as const)("localizes a missing selected local model and permits System recovery in %s", async (language, missing, use, restored) => {
    const systemId = "apple:foundation-models:system-default";
    const missingId = "local:app-managed:MyQwen";
    const system = {
      id: systemId, displayName: "Apple Intelligence", kind: "system",
      source: "apple_hosted", status: "ready", selected: false,
    };
    const catalog = {
      distributionStatus: "not_published", selectedModelId: missingId, models: [system],
    };
    mocks.list.mockResolvedValue(catalog);
    mocks.select.mockResolvedValue({
      ...catalog, selectedModelId: systemId, models: [{ ...system, selected: true }],
    });

    const { container } = render(<CoreAiModelManager label="Models" language={language} />);
    expect(await screen.findByText(missing)).toBeTruthy();
    expect(container.textContent).not.toContain(missingId);
    fireEvent.click(screen.getByRole("button", { name: use }));
    await waitFor(() => expect(mocks.select).toHaveBeenCalledWith(systemId));
    expect(await screen.findByText(restored)).toBeTruthy();
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

    expect(await screen.findByText("Broken")).toBeTruthy();
    expect(screen.getByText("ローカル")).toBeTruthy();
    expect(screen.getByText("実行に必要なTokenizerが見つかりません。")).toBeTruthy();
    expect(screen.queryByText("missing-tokenizer")).toBeNull();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });

  it("does not steal focus when a selection finishes after the user moves away", async () => {
    const catalog = {
      distributionStatus: "available", selectedModelId: "system",
      models: [
        { id: "system", displayName: "System", kind: "system", status: "ready", selected: true },
        { id: "local:app-managed:Local", displayName: "Local", kind: "core_ai", source: "app_managed_local", status: "detected", selected: false },
      ],
    };
    let finish!: (value: typeof catalog) => void;
    mocks.list.mockResolvedValue(catalog);
    mocks.select.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<><CoreAiModelManager label="Models" language="en" /><button>Other setting</button></>);
    const select = await screen.findByRole("button", { name: "Use" });
    select.focus();
    fireEvent.click(select);
    const other = screen.getByRole("button", { name: "Other setting" });
    other.focus();
    await act(async () => finish({ ...catalog, models: catalog.models.map((model) => ({
      ...model, selected: model.id === "local:app-managed:Local",
    })) }));
    expect(document.activeElement).toBe(other);
  });

  it("explains that local models cannot use an external tokenizer", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "not_published",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        {
          id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
          kind: "system", source: "apple_hosted", status: "ready", selected: true,
        },
        {
          id: "local:app-managed:RemoteTokenizer", displayName: "Remote Tokenizer",
          kind: "core_ai", source: "app_managed_local", status: "failed", selected: false,
          errorCode: "external-tokenizer-not-allowed",
        },
      ],
    });

    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText("ローカルモデルにはTokenizerを同梱する必要があります。")).toBeTruthy();
    expect(screen.queryByText("external-tokenizer-not-allowed")).toBeNull();
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

  it("lets a ready model check for a newer pack without an app update", async () => {
    const catalog = {
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        { id: "apple:core-ai:12b", displayName: "Gemma 4 12B", kind: "core_ai", status: "ready", selected: false, canRemove: true },
      ],
    };
    mocks.list.mockResolvedValue(catalog);
    mocks.download.mockResolvedValue(catalog);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText("新しい版がある場合はダウンロードします。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "更新を確認して取得" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("apple:core-ai:12b"));
  });

  it("shows recovery in plain language and keeps the raw failure in details", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        { id: "apple:core-ai:12b", displayName: "Gemma 4 12B", kind: "core_ai", status: "failed", selected: false,
          canRemove: true, assetPackVersion: 2, errorCode: "verification-failed",
          error: "The downloaded E4B resource manifest does not match the signed catalog." },
      ],
    });
    mocks.remove.mockResolvedValue({
      distributionStatus: "available", selectedModelId: "apple:foundation-models:system-default", models: [],
    });
    mocks.download.mockResolvedValue({
      distributionStatus: "available", selectedModelId: "apple:foundation-models:system-default", models: [],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText(/ダウンロードしたモデルの検証に失敗しました/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
    const details = screen.getByText("技術情報").closest("details");
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("E4B resource manifest");
    expect(details?.textContent).toContain("取得対象の版 v2");
    fireEvent.click(screen.getByRole("button", { name: "削除して再取得" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("apple:core-ai:12b"));
    expect(mocks.remove).toHaveBeenCalledWith("apple:core-ai:12b");
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.download.mock.invocationCallOrder[0]);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("現在選択しているモデルは変更しません"));
    expect(confirm.mock.calls[0][0]).not.toContain("Apple Intelligenceに切り替え");
    confirm.mockRestore();
  });

  it("explains that recovering the selected model switches selection until the user chooses it again", async () => {
    const modelId = "apple:core-ai:12b";
    mocks.list.mockResolvedValue({
      distributionStatus: "available", selectedModelId: modelId,
      models: [{ id: modelId, displayName: "Gemma 4 12B", kind: "core_ai", source: "apple_hosted",
        status: "failed", selected: true, canRemove: true, errorCode: "verification-failed" }],
    });
    mocks.remove.mockResolvedValue({ distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default", models: [] });
    mocks.download.mockResolvedValue({ distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default", models: [] });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    fireEvent.click(await screen.findByRole("button", { name: "削除して再取得" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(modelId));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("選択をApple Intelligenceに切り替えて再取得します"));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("再取得後は「使う」で選び直してください"));
    expect(mocks.select).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("shows indeterminate verification progress and keeps download cancellation unavailable", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available", selectedModelId: "apple:foundation-models:system-default",
      models: [{ id: "apple:core-ai:12b", displayName: "Gemma 4 12B", kind: "core_ai",
        source: "apple_hosted", status: "verifying", selected: false, progress: null }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText("検証中")).toBeTruthy();
    expect(screen.getByText("ダウンロードが完了しました。モデルの整合性を確認しています。この画面を閉じても、文書の編集は続けられます。")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Gemma 4 12Bを検証中" }).hasAttribute("value")).toBe(false);
    expect(screen.queryByRole("button", { name: "キャンセル" })).toBeNull();
  });

  it("offers retry for a transport failure without deleting a model", async () => {
    mocks.list.mockResolvedValue({
      distributionStatus: "available",
      selectedModelId: "apple:foundation-models:system-default",
      models: [{
        id: "apple:core-ai:12b", displayName: "Gemma 4 12B", kind: "core_ai",
        source: "apple_hosted", status: "failed", selected: false,
        errorCode: "download-failed", canRemove: false, error: "Network unavailable",
      }],
    });
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);
    expect(await screen.findByText(/モデルのダウンロードに失敗しました/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "削除して再取得" })).toBeNull();
    expect(screen.queryByRole("button", { name: "削除" })).toBeNull();
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
          minimumMemoryGb: 16, recommendedMemoryGb: 24,
          license: "Apache-2.0", hasUpstreamConversionNotice: true,
        },
      ],
    };
    mocks.list.mockResolvedValue(catalog);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CoreAiModelManager label="オンデバイスモデル" language="ja" />);

    expect(await screen.findByText(/最低メモリ 16 GB/)).toBeTruthy();
    expect(screen.getByText(/推奨メモリ 24 GB/)).toBeTruthy();
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
