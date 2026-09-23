import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MenuLanguage } from "../../types";
import { useCoreAiModelCatalog } from "../../hooks/app/useCoreAiModelCatalog";
import { isCoreAiModelSelectable } from "../../lib/coreAiModelSelection";
import { pickCoreAiModelFolder } from "../../lib/tauri/dialog";
import {
  finishAppleAssistGeneration,
  generateAppleAssistCandidate,
  prepareAppleAssistGeneration,
  stopAppleAssistGeneration,
} from "../../lib/tauri/appleAssist";
import {
  cancelCoreAiModelDownload,
  deleteCoreAiModel,
  registerExternalCoreAiModel,
  selectLocalAssistModel,
  startCoreAiModelDownload,
  unregisterExternalCoreAiModel,
  type CoreAiModelCatalog,
  type CoreAiModelSummary,
} from "../../lib/tauri/coreAiModels";

const MODEL_CHECK_TEXT = "春の風が心地よいです。";
type ModelCheckJob = {
  requestId: string;
  modelId: string;
  preparePromise: Promise<void>;
  cancelled: boolean;
  stopPromise?: Promise<void>;
};
type ModelCheckResult = {
  modelId: string;
  kind: "success" | "cancelled" | "error";
  sample?: string;
  error?: string;
};

/**
 * オンデバイスモデルの一覧と操作。見出しは持たず、ページ側が「オンデバイスモデル」の
 * 見出しと保存先の説明を出す（同じ文言を2か所に置かない）。`label` はこの領域の
 * アクセシブル名で、ページの見出しと同じ値を渡す。
 */
export function CoreAiModelManager({ label, language }: { label: string; language: MenuLanguage }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkingModelId, setCheckingModelId] = useState<string | null>(null);
  const [checkStopping, setCheckStopping] = useState(false);
  const [checkResult, setCheckResult] = useState<ModelCheckResult | null>(null);
  const checkJob = useRef<ModelCheckJob | null>(null);
  const checkSequence = useRef(0);
  const mounted = useRef(true);
  const focusedAction = useRef<{ control: HTMLElement; row: HTMLElement } | null>(null);
  const copy = managerCopy(language);
  const { catalog, refreshCatalog, runCatalogRequest } = useCoreAiModelCatalog((reason) => {
    setError(reason instanceof Error ? reason.message : String(reason));
  });
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  useEffect(() => {
    setCheckResult(null);
  }, [catalog.selectedModelId]);

  useLayoutEffect(() => {
    const previous = focusedAction.current;
    if (previous && !previous.control.isConnected) {
      focusedAction.current = null;
      if (previous.row.isConnected && document.activeElement === document.body) {
        previous.row.focus();
      }
    }
  }, [catalog]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const job = checkJob.current;
      if (!job) return;
      job.cancelled = true;
      job.stopPromise ??= job.preparePromise
        .then(() => stopAppleAssistGeneration(job.requestId))
        .then(() => undefined)
        .catch(() => undefined);
    };
  }, []);

  const stopCheck = async (modelId: string) => {
    const job = checkJob.current;
    if (!job || job.modelId !== modelId || job.cancelled) return;
    job.cancelled = true;
    setCheckStopping(true);
    job.stopPromise = job.preparePromise
      .then(() => stopAppleAssistGeneration(job.requestId))
      .then(() => undefined)
      .catch(() => undefined);
    await job.stopPromise;
  };

  const checkModel = async (model: CoreAiModelSummary) => {
    if (checkJob.current || !model.selected || model.kind !== "core_ai" || !isCoreAiModelSelectable(model)) return;
    const requestId = `model-check-${Date.now()}-${++checkSequence.current}`;
    const job: ModelCheckJob = {
      requestId,
      modelId: model.id,
      preparePromise: prepareAppleAssistGeneration(requestId),
      cancelled: false,
    };
    checkJob.current = job;
    setBusyId(model.id);
    setCheckingModelId(model.id);
    setCheckStopping(false);
    setCheckResult(null);
    setError(null);
    setNotice(null);
    let prepared = false;
    try {
      await job.preparePromise;
      prepared = true;
      if (job.cancelled) {
        if (mounted.current) setCheckResult({ modelId: model.id, kind: "cancelled" });
        return;
      }
      const response = await generateAppleAssistCandidate(
        { operation: "rephrase", selectedText: MODEL_CHECK_TEXT },
        requestId,
      );
      if (!mounted.current) return;
      if (job.cancelled) {
        setCheckResult({ modelId: model.id, kind: "cancelled" });
        return;
      }
      if (response.modelId !== model.id || catalogRef.current.selectedModelId !== model.id ||
          !catalogRef.current.models.some((entry) => entry.id === model.id && entry.selected)) {
        throw new Error("Local Assist model changed during the check.");
      }
      if (typeof response.candidateText !== "string" || !response.candidateText.trim()) {
        throw new Error("Local Assist returned no text for the model check.");
      }
      const characters = Array.from(response.candidateText.trim());
      const sample = characters.slice(0, 320).join("") + (characters.length > 320 ? "…" : "");
      setCheckResult({ modelId: model.id, kind: "success", sample });
    } catch (reason) {
      if (!mounted.current) return;
      const error = reason instanceof Error ? reason.message : String(reason);
      setCheckResult(job.cancelled || error.includes("cancelled by user")
        ? { modelId: model.id, kind: "cancelled" }
        : { modelId: model.id, kind: "error", error });
    } finally {
      await job.stopPromise;
      if (prepared) await finishAppleAssistGeneration(requestId).catch(() => undefined);
      if (checkJob.current === job) checkJob.current = null;
      if (mounted.current) {
        setCheckingModelId(null);
        setCheckStopping(false);
        setBusyId(null);
      }
    }
  };

  const addFolder = async () => {
    setError(null);
    try {
      const path = await pickCoreAiModelFolder();
      if (!path) return;
      setBusyId("register");
      const before = new Set(catalog.models.map((model) => model.id));
      const next = await runCatalogRequest(() => registerExternalCoreAiModel(path));
      setNotice(next.models.some((model) => !before.has(model.id)) ? copy.folderAdded : copy.folderAlreadyAdded);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  const run = async (model: CoreAiModelSummary, action: "select" | "download" | "cancel" | "delete" | "recover" | "unregister") => {
    if (action === "download" && model.status !== "ready" && isBelowRecommendedMemory(model, catalog)) {
      const proceed = window.confirm(isBelowMinimumMemory(model, catalog)
        ? copy.minimumMemoryConfirmation(catalog.deviceMemoryGb!, model.minimumMemoryGb!, model.displayName)
        : copy.memoryConfirmation(catalog.deviceMemoryGb!, model.recommendedMemoryGb!, model.displayName));
      if (!proceed) return;
    }
    if (action === "delete" && !window.confirm(copy.deleteConfirmation(
      model.displayName,
      model.installedSizeBytes == null ? null : formatSize(model.installedSizeBytes),
      model.selected,
    ))) return;
    if (action === "recover" && !window.confirm(copy.recoverConfirmation(model.displayName, model.selected))) return;
    if (action === "unregister" && !window.confirm(copy.unregisterConfirmation(model.displayName, model.selected))) return;
    setBusyId(model.id);
    setError(null);
    setNotice(null);
    try {
      if (action === "select") await runCatalogRequest(() => selectLocalAssistModel(model.id));
      if (action === "download") await runCatalogRequest(() => startCoreAiModelDownload(model.id));
      if (action === "cancel") {
        const cancelled = await cancelCoreAiModelDownload(model.id);
        await refreshCatalog();
        if (!cancelled) throw new Error(copy.cancelFailed);
      }
      if (action === "delete") await runCatalogRequest(() => deleteCoreAiModel(model.id));
      if (action === "recover") {
        await runCatalogRequest(() => deleteCoreAiModel(model.id));
        await runCatalogRequest(() => startCoreAiModelDownload(model.id));
      }
      if (action === "unregister") await runCatalogRequest(() => unregisterExternalCoreAiModel(model.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  return <div className="core-ai-model-manager" aria-label={label}>
    <div className="core-ai-current-model">
      <strong>{copy.currentModel(
        catalog.models.find((model) => model.selected)?.displayName
          ?? (catalog.selectedModelId.startsWith("local:")
            ? copy.missingLocalModel
            : catalog.selectedModelId),
      )}</strong>
      {catalog.deviceMemoryGb == null ? null : <span>{copy.deviceMemory(catalog.deviceMemoryGb)}</span>}
    </div>
    {catalog.distributionStatus === "not_published" ?
      <p className="field-hint" role="status">{copy.notPublished}</p> : null}
    {catalog.selectionLocked ? <p className="field-hint" role="status">{copy.developerOverride}</p> : null}
    <div className="core-ai-model-list">
      {catalog.models.map((model) => {
        const source = model.source ?? "apple_hosted";
        const isLocal = source === "app_managed_local" || source === "external_local";
        const busy = busyId !== null || Boolean(catalog.managementError) || Boolean(catalog.selectionLocked);
        const canSelect = !model.selected && isCoreAiModelSelectable(model);
        const status = statusLabel(model, copy);
        return <div className="core-ai-model-row" key={model.id}
          role="group" aria-label={model.displayName} tabIndex={-1}
          onFocusCapture={(event) => {
            focusedAction.current = event.target instanceof HTMLButtonElement
              ? { control: event.target, row: event.currentTarget } : null;
          }}>
          <div className="core-ai-model-row-main">
            <div className="core-ai-model-row-heading">
              <strong>{model.displayName}</strong>
              {isLocal ? <span className="core-ai-model-source">{copy.localBadge}</span> : null}
              {model.selected ? <span className="core-ai-model-selected">{copy.selected}</span> : null}
            </div>
            <span className={`core-ai-model-status${model.status === "failed" ? " is-error" : ""}`}>{status}</span>
            {model.kind === "system" ? <span className="core-ai-model-fact">{copy.systemDescription}</span> : null}
            {model.kind === "core_ai" ? <div className="core-ai-model-facts">
              {model.downloadSizeBytes != null && model.status !== "ready" ?
                <span>{copy.downloadSize(formatSize(model.downloadSizeBytes))}</span> : null}
              {model.installedSizeBytes != null ? <span>{
                model.status === "ready"
                  ? copy.installedSize(formatSize(model.installedSizeBytes))
                  : copy.installSize(formatSize(model.installedSizeBytes))
              }</span> : null}
              {model.minimumMemoryGb != null ?
                <span>{copy.minimumMemory(model.minimumMemoryGb)}</span> : null}
              {model.recommendedMemoryGb != null ?
                <span>{copy.recommendedMemory(model.recommendedMemoryGb)}</span> : null}
              {model.license ? <span>{copy.licenseShort(model.license)}</span> : null}
            </div> : null}
            {isBelowRecommendedMemory(model, catalog) ? <span className="preference-warning" role="status">
              {isBelowMinimumMemory(model, catalog)
                ? copy.minimumMemoryWarning(catalog.deviceMemoryGb!, model.minimumMemoryGb!)
                : copy.memoryWarning(catalog.deviceMemoryGb!, model.recommendedMemoryGb!)}
            </span> : null}
            {model.status === "downloading" ? <progress
              aria-label={copy.downloadProgress(model.displayName)}
              max={1} value={model.progress ?? undefined}
            /> : null}
            {model.status === "verifying" ? <>
              <progress aria-label={copy.verificationProgress(model.displayName)} max={1} />
              <span className="field-hint" role="status">{copy.verifyingHint}</span>
            </> : null}
            {isLocal && model.errorCode ?
              <span className="preference-warning" role="status">{copy.localReason(model.errorCode)}</span> : null}
            {!isLocal && model.errorCode === "local-preview" ?
              <span className="field-hint" role="status">{copy.previewHint}</span> : null}
            {!isLocal && model.status === "failed" ? <span className="preference-warning" role="status">
              {model.errorCode === "verification-failed" ? copy.verificationFailure : copy.downloadFailure}
              {model.errorCode === "verification-failed" && model.canRemove ? ` ${copy.recoveryHint}` : null}
            </span> : null}
          </div>
          <div className="core-ai-model-actions">
            {canSelect ?
              <button type="button" disabled={busy} onClick={() => void run(model, "select")}>{copy.select}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "not_downloaded" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{copy.download}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && (model.status === "paused" || (model.status === "failed" && model.errorCode !== "verification-failed")) ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{model.status === "paused" ? copy.resume : copy.retry}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "failed" && model.errorCode === "verification-failed" && model.canRemove ?
              <button type="button" disabled={busy} onClick={() => void run(model, "recover")}>{copy.recover}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "ready" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{copy.checkForUpdates}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "downloading" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "cancel")}>{copy.cancel}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "ready" ?
              <button className="core-ai-model-remove" type="button" disabled={busy} onClick={() => void run(model, "delete")}>{copy.delete}</button> : null}
            {source === "external_local" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "unregister")}>{copy.unregister}</button> : null}
            {model.kind === "core_ai" && model.selected && isCoreAiModelSelectable(model) ?
              <button type="button"
                disabled={checkingModelId === model.id ? checkStopping : busy}
                onClick={() => void (checkingModelId === model.id ? stopCheck(model.id) : checkModel(model))}>
                {checkingModelId === model.id ? copy.stopCheck : copy.checkModel}
              </button> : null}
          </div>
          {source === "apple_hosted" && model.kind === "core_ai" && model.status === "ready" ?
            <span className="field-hint core-ai-model-update-hint">{copy.checkForUpdatesHint}</span> : null}
          {model.kind === "core_ai" && model.selected && isCoreAiModelSelectable(model) ?
            <span className="field-hint core-ai-model-check-hint">{copy.checkHint}</span> : null}
          {checkingModelId === model.id ?
            <span className="field-hint core-ai-model-check-result" role="status">{copy.checking}</span> : null}
          {checkResult?.modelId === model.id && model.selected ?
            <div className="core-ai-model-check-result" role={checkResult.kind === "error" ? "alert" : "status"}>
              <span>{checkResult.kind === "success" ? copy.checkSucceeded
                : checkResult.kind === "cancelled" ? copy.checkCancelled : copy.checkFailed}</span>
              {checkResult.sample ? <blockquote>{checkResult.sample}</blockquote> : null}
              {checkResult.error ? <details className="core-ai-model-details"><summary>{copy.technicalDetails}</summary><code>{checkResult.error}</code></details> : null}
            </div> : null}
          {model.kind === "core_ai" && (model.error || model.assetPackVersion != null || model.license) ?
            <details className="core-ai-model-details">
              <summary>{copy.technicalDetails}</summary>
              {model.license ? <span>{copy.license(model.license, Boolean(model.hasUpstreamConversionNotice))}</span> : null}
              {model.assetPackVersion != null ? <span>{copy.deliveryVersion(model.assetPackVersion)}</span> : null}
              {model.error ? <code>{model.error}</code> : null}
            </details> : null}
        </div>;
      })}
    </div>
    <div className="core-ai-local-actions">
      <button type="button" disabled={busyId !== null || Boolean(catalog.managementError) || Boolean(catalog.selectionLocked)}
        onClick={() => void addFolder()}>{copy.addFolder}</button>
      <span className="field-hint">{copy.addFolderHint}</span>
    </div>
    {notice ? <p role="status" className="field-hint">{notice}</p> : null}
    {catalog.managementError ? <div className="preference-warning" role="alert">
      {copy.managementUnavailable}
      <details className="core-ai-model-details"><summary>{copy.technicalDetails}</summary><code>{catalog.managementError}</code></details>
    </div> : null}
    {error ? <div className="preference-warning" role="alert">
      {actionErrorMessage(error, copy)}
      <details className="core-ai-model-details"><summary>{copy.technicalDetails}</summary><code>{error}</code></details>
    </div> : null}
  </div>;
}

type ManagerCopy = ReturnType<typeof managerCopy>;
function actionErrorMessage(error: string, copy: ManagerCopy): string {
  if (error.startsWith("local-model:")) return copy.localReason(error.slice("local-model:".length));
  if (error.startsWith("model-bookmark:select-resource-root")) return copy.selectResourceRoot;
  if (error.startsWith("model-bookmark:")) return copy.folderPermissionFailed;
  return copy.operationFailed;
}

function statusLabel(model: CoreAiModelSummary, copy: ManagerCopy): string {
  const isLocal = model.source === "app_managed_local" || model.source === "external_local";
  return model.kind === "system" ? copy.systemStatus
    : isLocal && model.status === "detected" ? copy.localDetected
    : isLocal ? copy.localUnavailable
    : model.status === "not_downloaded" ? copy.notDownloaded
    : model.status === "not_published" ? copy.notPublishedShort
    : model.status === "downloading" ? copy.downloading(model.progress)
    : model.status === "paused" ? copy.paused
    : model.status === "verifying" ? copy.verifying
    : model.status === "failed" ? copy.failed
    : model.status === "unsupported" && model.errorCode === "local-preview" ? copy.previewUnavailable
    : model.status === "unsupported" ? copy.unsupported
    : copy.ready;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

function isBelowRecommendedMemory(
  model: CoreAiModelSummary,
  catalog: CoreAiModelCatalog,
): boolean {
  return model.kind === "core_ai"
    && catalog.deviceMemoryGb != null
    && model.recommendedMemoryGb != null
    && catalog.deviceMemoryGb < model.recommendedMemoryGb;
}

function isBelowMinimumMemory(model: CoreAiModelSummary, catalog: CoreAiModelCatalog): boolean {
  return model.kind === "core_ai"
    && catalog.deviceMemoryGb != null
    && model.minimumMemoryGb != null
    && catalog.deviceMemoryGb < model.minimumMemoryGb;
}

function managerCopy(language: MenuLanguage) {
  if (language === "en") return {
    selected: "Selected", ready: "Ready", systemStatus: "Built-in model",
    checkModel: "Try a short sample", stopCheck: "Stop check",
    checkHint: "Uses only a fixed sample sentence. Your open document is not sent or changed.",
    checking: "Checking this model…",
    checkSucceeded: "This model generated text. Your document was not changed.",
    checkCancelled: "Check stopped. Your document was not changed.",
    checkFailed: "This model could not generate text. Your document was not changed.",
    systemDescription: "No download needed. Availability is checked when you use it.",
    localBadge: "Local", localDetected: "Detected (can be selected)",
    addFolder: "Add model folder…", addFolderHint: "Select a Core AI resource folder. Its files stay where they are.",
    selectResourceRoot: "Select the folder containing the model and tokenizer, then try again.",
    folderPermissionFailed: "This Mac could not grant access to that model folder. Choose it again.",
    folderAdded: "Model folder added. Choose Use to switch Local Assist to it.",
    folderAlreadyAdded: "This model folder is already listed.",
    unregister: "Remove from list",
    unregisterConfirmation: (name: string, selected: boolean) => `Remove ${name} from this list? The model files will stay in their folder.${selected ? " Apple Intelligence will become the current model." : ""}`,
    missingLocalModel: "Local model unavailable",
    localUnavailable: "Unavailable", localReason: (code: string) => localModelReason("en", code),
    notDownloaded: "Not downloaded", notPublishedShort: "Not published", select: "Use",
    download: "Download", resume: "Resume", retry: "Retry", cancel: "Cancel", delete: "Delete", recover: "Delete and download again",
    checkForUpdates: "Check for updates and download", checkForUpdatesHint: "Downloads a newer version if one is available.", technicalDetails: "Technical details",
    deliveryVersion: (version: number) => `Requested pack version v${version}`,
    verificationFailure: "The downloaded model failed verification.",
    downloadFailure: "The model download failed.",
    operationFailed: "Couldn't complete that model action. Check the status and try again.",
    recoveryHint: "Delete the downloaded copy and download it again.",
    recoverConfirmation: (name: string, selected: boolean) => selected
      ? `Delete ${name}, switch the selected model to Apple Intelligence, and download it again? When the download finishes, choose Use to select ${name} again.`
      : `Delete ${name} and download it again? Your currently selected model will not change.`,
    downloadSize: (size: string) => `Download about ${size}`,
    installedSize: (size: string) => `Uses about ${size}`,
    installSize: (size: string) => `About ${size} after installation`,
    currentModel: (name: string) => `Current model: ${name}`,
    deviceMemory: (memory: number) => `This Mac: ${memory} GB memory`,
    minimumMemory: (memory: number) => `Minimum memory: ${memory} GB`,
    recommendedMemory: (memory: number) => `Recommended memory: ${memory} GB`,
    license: (license: string, hasNotice: boolean) => hasNotice
      ? `License: ${license} · upstream conversion license included`
      : `License: ${license}`,
    licenseShort: (license: string) => `License: ${license}`,
    memoryWarning: (current: number, recommended: number) => `This Mac has ${current} GB of memory; ${recommended} GB is recommended. Generation may be slow or unavailable.`,
    minimumMemoryWarning: (current: number, minimum: number) => `This Mac has ${current} GB of memory; this model needs at least ${minimum} GB and may be unavailable.`,
    memoryConfirmation: (current: number, recommended: number, name: string) => `${name} recommends ${recommended} GB of memory, but this Mac has ${current} GB. Download anyway?`,
    minimumMemoryConfirmation: (current: number, minimum: number, name: string) => `${name} needs at least ${minimum} GB of memory, but this Mac has ${current} GB. Download anyway?`,
    deleteConfirmation: (name: string, size: string | null, selected: boolean) => `Delete ${name}?${size ? ` This removes about ${size}.` : ""} You can download it again later.${selected ? " Apple Intelligence will become the current model." : ""}`,
    cancelFailed: "The download could not be stopped. Check its current status and try again.",
    downloading: (progress?: number | null) => progress == null ? "Downloading" : `Downloading · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `Download progress for ${name}`,
    verificationProgress: (name: string) => `Verifying ${name}`,
    verifyingHint: "Download complete. Checking the model files. You can close this page and continue editing documents.",
    paused: "Paused", verifying: "Verifying download", failed: "Download unavailable", unsupported: "Requires macOS 27",
    previewUnavailable: "Unavailable in this preview", previewHint: "Try Apple-hosted model downloads in the TestFlight build.",
    notPublished: "No Core AI model has been published for download yet. Validated local bundles in Custom Models can still be selected.",
    developerOverride: "A Developer test backend is selected for this session. Restart without the test override to manage models.",
    managementUnavailable: "Model management is unavailable. You can continue editing documents. Resolve the following error and restart the app:",
    boundary: "Apple-hosted models and validated local Core AI folders are listed here. Choose a local model in Local Assist. URL and GGUF imports are not accepted.",
  };
  if (language === "kana") return {
    selected: "えらんでゐます", ready: "つかへます", systemStatus: "Mac に はじめから ある もでる",
    checkModel: "みじかい ぶんで ためす", stopCheck: "たしかめるのを とめる",
    checkHint: "きまった みじかい ぶんだけを つかひます。ひらいてゐる ぶんしょは つかはず、かへません。",
    checking: "もでるを たしかめてゐます…",
    checkSucceeded: "この もでるで ぶんを つくれました。ぶんしょは かへてゐません。",
    checkCancelled: "たしかめるのを とめました。ぶんしょは かへてゐません。",
    checkFailed: "この もでるで ぶんを つくれませんでした。ぶんしょは かへてゐません。",
    systemDescription: "いれる ひつようは ありません。つかふときに うごくかを たしかめます。",
    localBadge: "ろーかる", localDetected: "みつけました（えらべます）",
    addFolder: "もでるの ふぉるだを たす…", addFolderHint: "Core AI の もでるの ふぉるだを えらびます。なかみは そのままに します。",
    selectResourceRoot: "もでると Tokenizer が はいった ふぉるだを えらんで、もういちど ためして ください。",
    folderPermissionFailed: "この ふぉるだを よむ きょかが とれませんでした。もういちど えらんで ください。",
    folderAdded: "もでるを たしました。「つかふ」で Local Assist の もでるを きりかへられます。",
    folderAlreadyAdded: "この もでるは すでに あります。",
    unregister: "いちらんから はづす",
    unregisterConfirmation: (name: string, selected: boolean) => `${name}を いちらんから はづしますか？ もとの ふぁいるは のこります。${selected ? " Apple Intelligence に もどします。" : ""}`,
    missingLocalModel: "ろーかるもでるが ありません",
    localUnavailable: "つかへません", localReason: (code: string) => localModelReason("kana", code),
    notDownloaded: "まだ いれてゐません", notPublishedShort: "まだ くばってゐません", select: "つかふ",
    download: "いれる", resume: "つづける", retry: "もういちど", cancel: "とめる", delete: "けす", recover: "けして いれなほす",
    checkForUpdates: "あたらしい ばんを たしかめて いれる", checkForUpdatesHint: "あたらしい ばんが あれば、いれます。", technicalDetails: "くはしい じょうほう",
    deliveryVersion: (version: number) => `とりよせる ばん v${version}`,
    verificationFailure: "いれた もでるを たしかめられませんでした。",
    downloadFailure: "もでるを いれられませんでした。",
    operationFailed: "もでるの そうさを おへられませんでした。ようすを たしかめて、もういちど ためしてください。",
    recoveryHint: "いれた ものを けして、いれなほせます。",
    recoverConfirmation: (name: string, selected: boolean) => selected
      ? `${name}を けして、えらぶ もでるを Apple Intelligence に きりかへて いれなほしますか？いれたあとは「つかふ」で えらびなほしてください。`
      : `${name}を けして いれなほしますか？いま えらんでゐる もでるは かへません。`,
    downloadSize: (size: string) => `いれる おほきさ やく ${size}`,
    installedSize: (size: string) => `つかふ りょう やく ${size}`,
    installSize: (size: string) => `いれたあとの おほきさ やく ${size}`,
    currentModel: (name: string) => `いまの もでる：${name}`,
    deviceMemory: (memory: number) => `この Mac の めもり：${memory} GB`,
    minimumMemory: (memory: number) => `ひつような めもり ${memory} GB いじょう`,
    recommendedMemory: (memory: number) => `すすめる めもり ${memory} GB`,
    license: (license: string, hasNotice: boolean) => hasNotice
      ? `らいせんす ${license} · へんかんもとの らいせんすぶんしょ つき`
      : `らいせんす ${license}`,
    licenseShort: (license: string) => `らいせんす ${license}`,
    memoryWarning: (current: number, recommended: number) => `この Mac の めもりは ${current} GB です。${recommended} GB を すすめます。うごきが おそい、または つかへない ことが あります。`,
    minimumMemoryWarning: (current: number, minimum: number) => `この Mac の めもりは ${current} GB です。この もでるには ${minimum} GB いじょう ひつようで、つかへない ことが あります。`,
    memoryConfirmation: (current: number, recommended: number, name: string) => `${name} は ${recommended} GB の めもりを すすめます。この Mac は ${current} GB です。それでも いれますか？`,
    minimumMemoryConfirmation: (current: number, minimum: number, name: string) => `${name} には ${minimum} GB いじょうの めもりが ひつようです。この Mac は ${current} GB です。それでも いれますか？`,
    deleteConfirmation: (name: string, size: string | null, selected: boolean) => `${name}を けしますか？${size ? ` やく ${size}を けします。` : ""} あとで また いれられます。${selected ? " Apple Intelligenceを つかふように もどします。" : ""}`,
    cancelFailed: "いれるのを とめられませんでした。いまの ようすを たしかめて もういちど ためしてください。",
    downloading: (progress?: number | null) => progress == null ? "いれてゐます" : `いれてゐます · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `${name}を いれる すすみぐあい`,
    verificationProgress: (name: string) => `${name}を たしかめてゐます`,
    verifyingHint: "いれおはりました。もでるの なかみを たしかめてゐます。この がめんを とぢても、ぶんしょを かきつづけられます。",
    paused: "とめてゐます", verifying: "たしかめてゐます", failed: "いれられませんでした", unsupported: "macOS 27 から つかへます",
    previewUnavailable: "この ためす ばんでは いれられません", previewHint: "Apple からの もでるは TestFlight ばんで ためして ください。",
    notPublished: "Core AI の もでるは まだ くばってゐません。Custom Models の なかで たしかめた ろーかるもでるは えらべます。",
    developerOverride: "ためすための もでるを えらんでゐます。もでるを かんりするには、ためすための していを はづして あぷりを ひらきなほして ください。",
    managementUnavailable: "もでるを かんりできません。ぶんしょは そのまま かきつづけられます。つぎの げんいんを なおして あぷりを ひらきなほして ください：",
    boundary: "Apple から くばる もでると、たしかめた ろーかるの Core AI ふぉるだを ここに だします。Local Assist で えらべます。URL と GGUF は うけつけません。",
  };
  return {
    selected: "選択中", ready: "利用可能", systemStatus: "Mac標準のモデル",
    checkModel: "短い例文で試す", stopCheck: "確認を中止",
    checkHint: "固定の短文だけで試します。開いている文書は使わず、変更しません。",
    checking: "モデルを確認しています…",
    checkSucceeded: "このモデルで生成できました。文書は変更していません。",
    checkCancelled: "確認を中止しました。文書は変更していません。",
    checkFailed: "このモデルで生成できませんでした。文書は変更していません。",
    systemDescription: "ダウンロード不要。使用時に利用できるか確認します。",
    localBadge: "ローカル", localDetected: "検出済み（選択できます）",
    addFolder: "モデルフォルダを追加…", addFolderHint: "Core AI のモデルが入ったフォルダを選びます。元のファイルは移動しません。",
    selectResourceRoot: "モデルとTokenizerが入ったフォルダを選んで、もう一度お試しください。",
    folderPermissionFailed: "モデルフォルダの読み取り許可を得られませんでした。フォルダを選び直してください。",
    folderAdded: "モデルフォルダを追加しました。「使う」を押すと Local Assist に切り替わります。",
    folderAlreadyAdded: "このモデルフォルダはすでに一覧にあります。",
    unregister: "一覧から外す",
    unregisterConfirmation: (name: string, selected: boolean) => `${name}を一覧から外しますか？元のファイルは削除しません。${selected ? " Apple Intelligenceに切り替わります。" : ""}`,
    missingLocalModel: "ローカルモデルが見つかりません",
    localUnavailable: "利用不可", localReason: (code: string) => localModelReason("ja", code),
    notDownloaded: "未ダウンロード", notPublishedShort: "未公開", select: "使う",
    download: "ダウンロード", resume: "再開", retry: "再試行", cancel: "キャンセル", delete: "削除", recover: "削除して再取得",
    checkForUpdates: "更新を確認して取得", checkForUpdatesHint: "新しい版がある場合はダウンロードします。", technicalDetails: "技術情報",
    deliveryVersion: (version: number) => `取得対象の版 v${version}`,
    verificationFailure: "ダウンロードしたモデルの検証に失敗しました。",
    downloadFailure: "モデルのダウンロードに失敗しました。",
    operationFailed: "モデルの操作を完了できませんでした。状態を確認して、もう一度お試しください。",
    recoveryHint: "取得済みのデータを削除して、ダウンロードし直せます。",
    recoverConfirmation: (name: string, selected: boolean) => selected
      ? `${name}を削除し、選択をApple Intelligenceに切り替えて再取得しますか？再取得後は「使う」で選び直してください。`
      : `${name}を削除して再取得しますか？現在選択しているモデルは変更しません。`,
    downloadSize: (size: string) => `ダウンロード 約${size}`,
    installedSize: (size: string) => `使用量 約${size}`,
    installSize: (size: string) => `インストール後 約${size}`,
    currentModel: (name: string) => `現在のモデル：${name}`,
    deviceMemory: (memory: number) => `このMacのメモリ：${memory} GB`,
    minimumMemory: (memory: number) => `最低メモリ ${memory} GB`,
    recommendedMemory: (memory: number) => `推奨メモリ ${memory} GB`,
    license: (license: string, hasNotice: boolean) => hasNotice
      ? `ライセンス ${license} · 変換元のライセンス文書を同梱`
      : `ライセンス ${license}`,
    licenseShort: (license: string) => `ライセンス ${license}`,
    memoryWarning: (current: number, recommended: number) => `このMacは${current} GBです。${recommended} GBを推奨します。生成が遅い、または利用できない場合があります。`,
    minimumMemoryWarning: (current: number, minimum: number) => `このMacは${current} GBです。このモデルには最低${minimum} GBが必要で、利用できない場合があります。`,
    memoryConfirmation: (current: number, recommended: number, name: string) => `${name}の推奨メモリは${recommended} GBですが、このMacは${current} GBです。それでもダウンロードしますか？`,
    minimumMemoryConfirmation: (current: number, minimum: number, name: string) => `${name}には最低${minimum} GBのメモリが必要ですが、このMacは${current} GBです。それでもダウンロードしますか？`,
    deleteConfirmation: (name: string, size: string | null, selected: boolean) => `${name}を削除しますか？${size ? ` 約${size}を削除します。` : ""}後から再ダウンロードできます。${selected ? " Apple Intelligenceを現在のモデルに戻します。" : ""}`,
    cancelFailed: "ダウンロードを停止できませんでした。現在の状態を確認して、もう一度お試しください。",
    downloading: (progress?: number | null) => progress == null ? "ダウンロード中" : `ダウンロード中 · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `${name}のダウンロード進捗`,
    verificationProgress: (name: string) => `${name}を検証中`,
    verifyingHint: "ダウンロードが完了しました。モデルの整合性を確認しています。この画面を閉じても、文書の編集は続けられます。",
    paused: "一時停止", verifying: "検証中", failed: "利用できません", unsupported: "macOS 27以降が必要",
    previewUnavailable: "このプレビューでは取得できません", previewHint: "Apple経由のモデル取得はTestFlight版でお試しください。",
    notPublished: "Core AI モデルはまだ配布されていません。Custom Models 内で検証したローカルモデルは選択できます。",
    developerOverride: "Developer用のテストモデル指定が有効です。モデルを管理するには、テスト指定を外してアプリを再起動してください。",
    managementUnavailable: "モデル管理を利用できません。文書の編集は続けられます。次の原因を解消してアプリを再起動してください：",
    boundary: "Apple 経由のモデルと、検証済みのローカル Core AI フォルダを表示します。Local Assist でも切り替えられます。URL と GGUF の持ち込みは受け付けません。",
  };
}

function localModelReason(language: MenuLanguage, code: string): string {
  const messages = language === "en" ? {
    "bookmark-inaccessible": "Access to this model folder has expired. Remove it from the list, then select the folder again.",
    "root-missing": "The model folder no longer exists.",
    "root-not-a-directory": "The model location is not a folder.",
    "missing-descriptor": "No Core AI model metadata was found.",
    "malformed-descriptor": "hazakura-model.json is not valid JSON.",
    "malformed-bundle-metadata": "The Core AI bundle metadata is invalid.",
    "unsupported-descriptor": "This hazakura-model.json version is not supported.",
    "unknown-runtime-kind": "This Core AI runtime is not supported.",
    "missing-bundle-directory": "The model bundle folder named by the metadata is missing.",
    "missing-model-directory": "No .aimodel folder was found.",
    "multiple-model-directories": "More than one .aimodel folder was found.",
    "model-directory-mismatch": "The bundle metadata points to a different .aimodel folder.",
    "incomplete-model-directory": "The .aimodel folder is incomplete.",
    "missing-tokenizer": "The tokenizer required to run this model is missing.",
    "external-tokenizer-not-allowed": "Local models must include their tokenizer in the bundle.",
    "missing-tables": "The embedding tables required to run this model are missing.",
    "unsafe-path": "The model contains a symbolic link or a path outside its folder.",
    unreadable: "The model folder could not be read.",
  } : language === "kana" ? {
    "bookmark-inaccessible": "もでるの ふぉるだを よめません。いちらんから はづして、もういちど えらんで ください。",
    "root-missing": "もでるの ふぉるだが ありません。",
    "root-not-a-directory": "もでるの ばしょが ふぉるだでは ありません。",
    "missing-descriptor": "Core AI もでるの じょうほうが ありません。",
    "malformed-descriptor": "hazakura-model.json を よめません。",
    "malformed-bundle-metadata": "Core AI もでるの じょうほうを よめません。",
    "unsupported-descriptor": "この hazakura-model.json の かたちは つかへません。",
    "unknown-runtime-kind": "この Core AI の うごかしかたは つかへません。",
    "missing-bundle-directory": "じょうほうに かかれた もでるの ふぉるだが ありません。",
    "missing-model-directory": ".aimodel ふぉるだが ありません。",
    "multiple-model-directories": ".aimodel ふぉるだが ふたつ いじょう あります。",
    "model-directory-mismatch": "じょうほうと .aimodel ふぉるだが あってゐません。",
    "incomplete-model-directory": ".aimodel ふぉるだの なかみが たりません。",
    "missing-tokenizer": "うごかすための Tokenizer が ありません。",
    "external-tokenizer-not-allowed": "ろーかるの もでるには Tokenizer を いれてください。",
    "missing-tables": "うごかすための embedding tables が ありません。",
    "unsafe-path": "もでるの なかに symlink または そとの ばしょを さす みちが あります。",
    unreadable: "もでるの ふぉるだを よめません。",
  } : {
    "bookmark-inaccessible": "モデルフォルダへのアクセス権が失われました。一覧から外して、フォルダをもう一度選んでください。",
    "root-missing": "モデルフォルダが見つかりません。",
    "root-not-a-directory": "モデルの場所がフォルダではありません。",
    "missing-descriptor": "Core AI モデルのメタデータが見つかりません。",
    "malformed-descriptor": "hazakura-model.json を正しいJSONとして読み取れません。",
    "malformed-bundle-metadata": "Core AI モデルのmetadata.jsonを正しく読み取れません。",
    "unsupported-descriptor": "この hazakura-model.json のバージョンには対応していません。",
    "unknown-runtime-kind": "この Core AI ランタイムには対応していません。",
    "missing-bundle-directory": "メタデータで指定されたモデルフォルダが見つかりません。",
    "missing-model-directory": ".aimodel フォルダが見つかりません。",
    "multiple-model-directories": ".aimodel フォルダが複数あり、使用するモデルを特定できません。",
    "model-directory-mismatch": "metadata.jsonが、検証したものとは別の.aimodelフォルダを指しています。",
    "incomplete-model-directory": ".aimodel フォルダに必要なファイルが揃っていません。",
    "missing-tokenizer": "実行に必要なTokenizerが見つかりません。",
    "external-tokenizer-not-allowed": "ローカルモデルにはTokenizerを同梱する必要があります。",
    "missing-tables": "実行に必要なembedding tablesが見つかりません。",
    "unsafe-path": "モデル内にシンボリックリンクまたはフォルダ外を指すパスがあります。",
    unreadable: "モデルフォルダを読み取れません。",
  };
  return messages[code as keyof typeof messages] ?? (language === "en"
    ? "The local model could not be validated."
    : language === "kana"
      ? "ろーかるの もでるを たしかめられません。"
      : "ローカルモデルを検証できませんでした。");
}
