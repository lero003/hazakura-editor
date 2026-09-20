import { useEffect, useState } from "react";
import type { MenuLanguage } from "../../types";
import {
  deleteCoreAiModel,
  listCoreAiModels,
  selectLocalAssistModel,
  startCoreAiModelDownload,
  unavailableCoreAiModelCatalog,
  type CoreAiModelCatalog,
  type CoreAiModelSummary,
} from "../../lib/tauri/coreAiModels";

export function CoreAiModelManager({ language }: { language: MenuLanguage }) {
  const [catalog, setCatalog] = useState<CoreAiModelCatalog>(unavailableCoreAiModelCatalog);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = managerCopy(language);

  useEffect(() => {
    let disposed = false;
    void listCoreAiModels()
      .then((next) => { if (!disposed) setCatalog(next); })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { disposed = true; };
  }, []);

  const run = async (model: CoreAiModelSummary, action: "select" | "download" | "delete") => {
    setBusyId(model.id);
    setError(null);
    try {
      if (action === "select") setCatalog(await selectLocalAssistModel(model.id));
      if (action === "download") {
        await startCoreAiModelDownload(model.id);
        setCatalog(await listCoreAiModels());
      }
      if (action === "delete") setCatalog(await deleteCoreAiModel(model.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  return <div className="core-ai-model-manager" aria-label={copy.title}>
    <div className="core-ai-model-manager-heading">
      <p>{copy.title}</p>
      <span>{copy.localOnly}</span>
    </div>
    {catalog.distributionStatus === "not_published" ?
      <p className="field-hint" role="status">{copy.notPublished}</p> : null}
    {catalog.selectionLocked ? <p className="field-hint" role="status">{copy.developerOverride}</p> : null}
    <div className="core-ai-model-list">
      {catalog.models.map((model) => {
        const busy = busyId !== null || Boolean(catalog.managementError) || Boolean(catalog.selectionLocked);
        return <div className="core-ai-model-row" key={model.id}>
          <div>
            <strong>{model.displayName}</strong>
            <span>{model.selected ? copy.selected : statusLabel(model, copy)}</span>
          </div>
          <div className="core-ai-model-actions">
            {model.status === "ready" && !model.selected ?
              <button type="button" disabled={busy} onClick={() => void run(model, "select")}>{copy.select}</button> : null}
            {model.kind === "core_ai" && model.status === "not_downloaded" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{copy.download}</button> : null}
            {model.kind === "core_ai" && model.status === "ready" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "delete")}>{copy.delete}</button> : null}
          </div>
        </div>;
      })}
    </div>
    {catalog.managementError ? <p className="preference-warning" role="alert">
      {copy.managementUnavailable} {catalog.managementError}
    </p> : null}
    {error ? <p className="preference-warning" role="alert">{error}</p> : null}
    <p className="field-hint">{copy.boundary}</p>
  </div>;
}

type ManagerCopy = ReturnType<typeof managerCopy>;
function statusLabel(model: CoreAiModelSummary, copy: ManagerCopy): string {
  if (model.status === "not_downloaded") {
    const size = model.downloadSizeBytes
      ? ` · ${new Intl.NumberFormat(undefined, { style: "unit", unit: "megabyte", maximumFractionDigits: 0 }).format(model.downloadSizeBytes / 1_000_000)}`
      : "";
    return copy.notDownloaded + size;
  }
  if (model.status === "not_published") return copy.notPublishedShort;
  return copy.ready;
}

function managerCopy(language: MenuLanguage) {
  if (language === "en") return {
    title: "On-device models", localOnly: "Local only", selected: "Selected", ready: "Ready",
    notDownloaded: "Not downloaded", notPublishedShort: "Not published", select: "Use",
    download: "Download", delete: "Delete",
    notPublished: "No Core AI model has been published for download yet. This build includes the adapter and management controls. Apple Intelligence is the default model.",
    developerOverride: "A Developer test backend is selected for this session. Restart without the test override to manage models.",
    managementUnavailable: "Model management is unavailable. You can continue editing documents. Resolve the following error and restart the app:",
    boundary: "Models can only come from Hazakura's Apple-hosted catalog. URLs, local model paths, and GGUF imports are not accepted.",
  };
  if (language === "kana") return {
    title: "この Mac の もでる", localOnly: "この Mac だけ", selected: "えらんでゐます", ready: "つかへます",
    notDownloaded: "まだ いれてゐません", notPublishedShort: "まだ くばってゐません", select: "つかふ",
    download: "いれる", delete: "けす",
    notPublished: "Core AI の もでるは まだ くばってゐません。この あぷりには うけいれと かんりの しくみだけが あり、はじめは Apple Intelligence を つかひます。",
    developerOverride: "ためすための もでるを えらんでゐます。もでるを かんりするには、ためすための していを はづして あぷりを ひらきなほして ください。",
    managementUnavailable: "もでるを かんりできません。ぶんしょは そのまま かきつづけられます。つぎの げんいんを なおして あぷりを ひらきなほして ください：",
    boundary: "Hazakura が Apple から くばる もでるだけを つかひます。URL、Mac の みち、GGUF は うけつけません。",
  };
  return {
    title: "オンデバイスモデル", localOnly: "ローカルのみ", selected: "選択中", ready: "利用可能",
    notDownloaded: "未ダウンロード", notPublishedShort: "未公開", select: "使う",
    download: "ダウンロード", delete: "削除",
    notPublished: "Core AI モデルはまだ配布されていません。このビルドには実行アダプタと管理画面だけが入り、標準では Apple Intelligence を使います。",
    developerOverride: "Developer用のテストモデル指定が有効です。モデルを管理するには、テスト指定を外してアプリを再起動してください。",
    managementUnavailable: "モデル管理を利用できません。文書の編集は続けられます。次の原因を解消してアプリを再起動してください：",
    boundary: "Hazakura が Apple 経由で配布するカタログ内モデルだけを扱います。URL、ローカルパス、GGUF の持ち込みは受け付けません。",
  };
}
