import { useEffect, useState } from "react";
import type { MenuLanguage } from "../../types";
import {
  cancelCoreAiModelDownload,
  deleteCoreAiModel,
  listenCoreAiModelStateChanges,
  listCoreAiModels,
  selectLocalAssistModel,
  startCoreAiModelDownload,
  unavailableCoreAiModelCatalog,
  type CoreAiModelCatalog,
  type CoreAiModelSummary,
} from "../../lib/tauri/coreAiModels";

/**
 * オンデバイスモデルの一覧と操作。見出しは持たず、ページ側が「オンデバイスモデル」の
 * 見出しと保存先の説明を出す（同じ文言を2か所に置かない）。`label` はこの領域の
 * アクセシブル名で、ページの見出しと同じ値を渡す。
 */
export function CoreAiModelManager({ label, language }: { label: string; language: MenuLanguage }) {
  const [catalog, setCatalog] = useState<CoreAiModelCatalog>(unavailableCoreAiModelCatalog);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = managerCopy(language);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listCoreAiModels()
      .then((next) => { if (!disposed) setCatalog(next); })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      });
    void listenCoreAiModelStateChanges((next) => {
      if (!disposed) setCatalog(next);
    }).then((stop) => {
      if (disposed) stop(); else unlisten = stop;
    }).catch((reason: unknown) => console.warn("Failed to listen for Core AI model state", reason));
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const run = async (model: CoreAiModelSummary, action: "select" | "download" | "cancel" | "delete") => {
    setBusyId(model.id);
    setError(null);
    try {
      if (action === "select") setCatalog(await selectLocalAssistModel(model.id));
      if (action === "download") setCatalog(await startCoreAiModelDownload(model.id));
      if (action === "cancel") {
        await cancelCoreAiModelDownload(model.id);
        setCatalog(await listCoreAiModels());
      }
      if (action === "delete") setCatalog(await deleteCoreAiModel(model.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  return <div className="core-ai-model-manager" aria-label={label}>
    {catalog.distributionStatus === "not_published" ?
      <p className="field-hint" role="status">{copy.notPublished}</p> : null}
    {catalog.selectionLocked ? <p className="field-hint" role="status">{copy.developerOverride}</p> : null}
    <div className="core-ai-model-list">
      {catalog.models.map((model) => {
        const busy = busyId !== null || Boolean(catalog.managementError) || Boolean(catalog.selectionLocked);
        // 選択状態は状態行の先頭に置き、選択中でもサイズ・バージョンを落とさない。
        const status = statusLabel(model, copy);
        return <div className="core-ai-model-row" key={model.id}>
          <div>
            <strong>{model.displayName}</strong>
            <span>{model.selected ? `${copy.selected} · ${status}` : status}</span>
            {model.status === "downloading" ? <progress
              aria-label={copy.downloadProgress(model.displayName)}
              max={1} value={model.progress ?? undefined}
            /> : null}
            {model.error ? <span className="preference-warning" role="status">{model.error}</span> : null}
          </div>
          <div className="core-ai-model-actions">
            {model.status === "ready" && !model.selected ?
              <button type="button" disabled={busy} onClick={() => void run(model, "select")}>{copy.select}</button> : null}
            {model.kind === "core_ai" && model.status === "not_downloaded" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{copy.download}</button> : null}
            {model.kind === "core_ai" && (model.status === "paused" || model.status === "failed") ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{model.status === "paused" ? copy.resume : copy.retry}</button> : null}
            {model.kind === "core_ai" && model.status === "downloading" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "cancel")}>{copy.cancel}</button> : null}
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
  const base = model.status === "not_downloaded" ? copy.notDownloaded
    : model.status === "not_published" ? copy.notPublishedShort
    : model.status === "downloading" ? copy.downloading(model.progress)
    : model.status === "paused" ? copy.paused
    : model.status === "verifying" ? copy.verifying
    : model.status === "failed" ? copy.failed
    : model.status === "unsupported" ? copy.unsupported
    : copy.ready;
  // サイズと資産バージョンは catalog が持っている値だけを出す（推測で埋めない）。
  const details: string[] = [];
  if (model.downloadSizeBytes) details.push(formatDownloadSize(model.downloadSizeBytes));
  if (model.assetPackVersion != null) details.push(`v${model.assetPackVersion}`);
  return details.length > 0 ? `${base} · ${details.join(" · ")}` : base;
}

function formatDownloadSize(bytes: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 0,
  }).format(bytes / 1_000_000);
}

function managerCopy(language: MenuLanguage) {
  if (language === "en") return {
    selected: "Selected", ready: "Ready",
    notDownloaded: "Not downloaded", notPublishedShort: "Not published", select: "Use",
    download: "Download", resume: "Resume", retry: "Retry", cancel: "Cancel", delete: "Delete",
    downloading: (progress?: number | null) => progress == null ? "Downloading" : `Downloading · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `Download progress for ${name}`,
    paused: "Paused", verifying: "Verifying download", failed: "Download unavailable", unsupported: "Requires macOS 27",
    notPublished: "No Core AI model has been published for download yet. This build includes the adapter and management controls. Apple Intelligence is the default model.",
    developerOverride: "A Developer test backend is selected for this session. Restart without the test override to manage models.",
    managementUnavailable: "Model management is unavailable. You can continue editing documents. Resolve the following error and restart the app:",
    boundary: "Models can only come from Hazakura's Apple-hosted catalog. URLs, local model paths, and GGUF imports are not accepted.",
  };
  if (language === "kana") return {
    selected: "えらんでゐます", ready: "つかへます",
    notDownloaded: "まだ いれてゐません", notPublishedShort: "まだ くばってゐません", select: "つかふ",
    download: "いれる", resume: "つづける", retry: "もういちど", cancel: "とめる", delete: "けす",
    downloading: (progress?: number | null) => progress == null ? "いれてゐます" : `いれてゐます · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `${name}を いれる すすみぐあい`,
    paused: "とめてゐます", verifying: "たしかめてゐます", failed: "いれられませんでした", unsupported: "macOS 27 から つかへます",
    notPublished: "Core AI の もでるは まだ くばってゐません。この あぷりには うけいれと かんりの しくみだけが あり、はじめは Apple Intelligence を つかひます。",
    developerOverride: "ためすための もでるを えらんでゐます。もでるを かんりするには、ためすための していを はづして あぷりを ひらきなほして ください。",
    managementUnavailable: "もでるを かんりできません。ぶんしょは そのまま かきつづけられます。つぎの げんいんを なおして あぷりを ひらきなほして ください：",
    boundary: "Hazakura が Apple から くばる もでるだけを つかひます。URL、Mac の みち、GGUF は うけつけません。",
  };
  return {
    selected: "選択中", ready: "利用可能",
    notDownloaded: "未ダウンロード", notPublishedShort: "未公開", select: "使う",
    download: "ダウンロード", resume: "再開", retry: "再試行", cancel: "キャンセル", delete: "削除",
    downloading: (progress?: number | null) => progress == null ? "ダウンロード中" : `ダウンロード中 · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `${name}のダウンロード進捗`,
    paused: "一時停止", verifying: "検証中", failed: "ダウンロード失敗", unsupported: "macOS 27以降が必要",
    notPublished: "Core AI モデルはまだ配布されていません。このビルドには実行アダプタと管理画面だけが入り、標準では Apple Intelligence を使います。",
    developerOverride: "Developer用のテストモデル指定が有効です。モデルを管理するには、テスト指定を外してアプリを再起動してください。",
    managementUnavailable: "モデル管理を利用できません。文書の編集は続けられます。次の原因を解消してアプリを再起動してください：",
    boundary: "Hazakura が Apple 経由で配布するカタログ内モデルだけを扱います。URL、ローカルパス、GGUF の持ち込みは受け付けません。",
  };
}
