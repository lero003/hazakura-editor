import { useLayoutEffect, useRef, useState } from "react";
import type { MenuLanguage } from "../../types";
import { useCoreAiModelCatalog } from "../../hooks/app/useCoreAiModelCatalog";
import { isCoreAiModelSelectable } from "../../lib/coreAiModelSelection";
import {
  cancelCoreAiModelDownload,
  deleteCoreAiModel,
  selectLocalAssistModel,
  startCoreAiModelDownload,
  type CoreAiModelCatalog,
  type CoreAiModelSummary,
} from "../../lib/tauri/coreAiModels";

/**
 * オンデバイスモデルの一覧と操作。見出しは持たず、ページ側が「オンデバイスモデル」の
 * 見出しと保存先の説明を出す（同じ文言を2か所に置かない）。`label` はこの領域の
 * アクセシブル名で、ページの見出しと同じ値を渡す。
 */
export function CoreAiModelManager({ label, language }: { label: string; language: MenuLanguage }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const focusedAction = useRef<{ control: HTMLElement; row: HTMLElement } | null>(null);
  const copy = managerCopy(language);
  const { catalog, refreshCatalog, runCatalogRequest } = useCoreAiModelCatalog((reason) => {
    setError(reason instanceof Error ? reason.message : String(reason));
  });

  useLayoutEffect(() => {
    const previous = focusedAction.current;
    if (previous && !previous.control.isConnected) {
      focusedAction.current = null;
      if (previous.row.isConnected && document.activeElement === document.body) {
        previous.row.focus();
      }
    }
  }, [catalog]);

  const run = async (model: CoreAiModelSummary, action: "select" | "download" | "cancel" | "delete") => {
    if (action === "download" && isBelowRecommendedMemory(model, catalog)) {
      const proceed = window.confirm(copy.memoryConfirmation(
        catalog.deviceMemoryGb!,
        model.recommendedMemoryGb!,
        model.displayName,
      ));
      if (!proceed) return;
    }
    if (action === "delete" && !window.confirm(copy.deleteConfirmation(
      model.displayName,
      model.installedSizeBytes == null ? null : formatSize(model.installedSizeBytes),
      model.selected,
    ))) return;
    setBusyId(model.id);
    setError(null);
    try {
      if (action === "select") await runCatalogRequest(() => selectLocalAssistModel(model.id));
      if (action === "download") await runCatalogRequest(() => startCoreAiModelDownload(model.id));
      if (action === "cancel") {
        const cancelled = await cancelCoreAiModelDownload(model.id);
        await refreshCatalog();
        if (!cancelled) throw new Error(copy.cancelFailed);
      }
      if (action === "delete") await runCatalogRequest(() => deleteCoreAiModel(model.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyId(null);
    }
  };

  return <div className="core-ai-model-manager" aria-label={label}>
    <p className="field-hint">{copy.currentModel(
        catalog.models.find((model) => model.selected)?.displayName
          ?? (catalog.selectedModelId.startsWith("local:app-managed:")
            ? copy.missingLocalModel
            : catalog.selectedModelId),
    )} {catalog.deviceMemoryGb == null ? null : `· ${copy.deviceMemory(catalog.deviceMemoryGb)}`}</p>
    {catalog.distributionStatus === "not_published" ?
      <p className="field-hint" role="status">{copy.notPublished}</p> : null}
    {catalog.selectionLocked ? <p className="field-hint" role="status">{copy.developerOverride}</p> : null}
    <div className="core-ai-model-list">
      {catalog.models.map((model) => {
        const source = model.source ?? "apple_hosted";
        const isLocal = source === "app_managed_local";
        const busy = busyId !== null || Boolean(catalog.managementError) || Boolean(catalog.selectionLocked);
        const canSelect = !model.selected && isCoreAiModelSelectable(model);
        // 選択状態は状態行の先頭に置き、選択中でもサイズ・バージョンを落とさない。
        const status = statusLabel(model, copy);
        return <div className="core-ai-model-row" key={model.id}
          role="group" aria-label={model.displayName} tabIndex={-1}
          onFocusCapture={(event) => {
            focusedAction.current = event.target instanceof HTMLButtonElement
              ? { control: event.target, row: event.currentTarget } : null;
          }}>
          <div>
            <strong>{model.displayName}{isLocal ? ` · ${copy.localBadge}` : ""}</strong>
            <span>{model.selected ? `${copy.selected} · ${status}` : status}</span>
            {model.kind === "core_ai" && model.recommendedMemoryGb != null ?
              <span>{copy.recommendedMemory(model.recommendedMemoryGb)}</span> : null}
            {model.kind === "core_ai" && model.installedSizeBytes != null ? <span>{
              model.status === "ready"
                ? copy.installedSize(formatSize(model.installedSizeBytes))
                : copy.installSize(formatSize(model.installedSizeBytes))
            }</span> : null}
            {model.kind === "core_ai" && model.license ?
              <span>{copy.license(model.license, Boolean(model.hasUpstreamConversionNotice))}</span> : null}
            {isBelowRecommendedMemory(model, catalog) ? <span className="preference-warning" role="status">
              {copy.memoryWarning(catalog.deviceMemoryGb!, model.recommendedMemoryGb!)}
            </span> : null}
            {model.status === "downloading" ? <progress
              aria-label={copy.downloadProgress(model.displayName)}
              max={1} value={model.progress ?? undefined}
            /> : null}
            {isLocal && model.errorCode ?
              <span className="preference-warning" role="status">{copy.localReason(model.errorCode)}</span> : null}
            {!isLocal && model.error ? <span className="preference-warning" role="status">{model.error}</span> : null}
          </div>
          <div className="core-ai-model-actions">
            {canSelect ?
              <button type="button" disabled={busy} onClick={() => void run(model, "select")}>{copy.select}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "not_downloaded" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{copy.download}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && (model.status === "paused" || model.status === "failed") ?
              <button type="button" disabled={busy} onClick={() => void run(model, "download")}>{model.status === "paused" ? copy.resume : copy.retry}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "downloading" ?
              <button type="button" disabled={busy} onClick={() => void run(model, "cancel")}>{copy.cancel}</button> : null}
            {source === "apple_hosted" && model.kind === "core_ai" && model.status === "ready" ?
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
  const isLocal = model.source === "app_managed_local";
  const base = model.kind === "system" ? copy.systemStatus
    : isLocal && model.status === "detected" ? copy.localDetected
    : isLocal ? copy.localUnavailable
    : model.status === "not_downloaded" ? copy.notDownloaded
    : model.status === "not_published" ? copy.notPublishedShort
    : model.status === "downloading" ? copy.downloading(model.progress)
    : model.status === "paused" ? copy.paused
    : model.status === "verifying" ? copy.verifying
    : model.status === "failed" ? copy.failed
    : model.status === "unsupported" ? copy.unsupported
    : copy.ready;
  // サイズと資産バージョンは catalog が持っている値だけを出す（推測で埋めない）。
  const details: string[] = [];
  if (model.downloadSizeBytes) details.push(copy.downloadSize(formatSize(model.downloadSizeBytes)));
  if (model.assetPackVersion != null) details.push(`v${model.assetPackVersion}`);
  return details.length > 0 ? `${base} · ${details.join(" · ")}` : base;
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

function managerCopy(language: MenuLanguage) {
  if (language === "en") return {
    selected: "Selected", ready: "Ready", systemStatus: "System default / availability not checked",
    localBadge: "Local", localDetected: "Detected (can be selected)",
    missingLocalModel: "Local model unavailable",
    localUnavailable: "Unavailable", localReason: (code: string) => localModelReason("en", code),
    notDownloaded: "Not downloaded", notPublishedShort: "Not published", select: "Use",
    download: "Download", resume: "Resume", retry: "Retry", cancel: "Cancel", delete: "Delete",
    downloadSize: (size: string) => `Download about ${size}`,
    installedSize: (size: string) => `Uses about ${size}`,
    installSize: (size: string) => `About ${size} after installation`,
    currentModel: (name: string) => `Current model: ${name}`,
    deviceMemory: (memory: number) => `This Mac: ${memory} GB memory`,
    recommendedMemory: (memory: number) => `Recommended memory: ${memory} GB`,
    license: (license: string, hasNotice: boolean) => hasNotice
      ? `License: ${license} · upstream conversion license included`
      : `License: ${license}`,
    memoryWarning: (current: number, recommended: number) => `This Mac has ${current} GB of memory; ${recommended} GB is recommended. Generation may be slow or unavailable.`,
    memoryConfirmation: (current: number, recommended: number, name: string) => `${name} recommends ${recommended} GB of memory, but this Mac has ${current} GB. Download anyway?`,
    deleteConfirmation: (name: string, size: string | null, selected: boolean) => `Delete ${name}?${size ? ` This removes about ${size}.` : ""} You can download it again later.${selected ? " Apple Intelligence will become the current model." : ""}`,
    cancelFailed: "The download could not be stopped. Check its current status and try again.",
    downloading: (progress?: number | null) => progress == null ? "Downloading" : `Downloading · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `Download progress for ${name}`,
    paused: "Paused", verifying: "Verifying download", failed: "Download unavailable", unsupported: "Requires macOS 27",
    notPublished: "No Core AI model has been published for download yet. Validated local bundles in Custom Models can still be selected.",
    developerOverride: "A Developer test backend is selected for this session. Restart without the test override to manage models.",
    managementUnavailable: "Model management is unavailable. You can continue editing documents. Resolve the following error and restart the app:",
    boundary: "Apple-hosted models and validated bundles in Hazakura's Custom Models folder are listed here. Local bundles can be selected for Local Assist; URL and GGUF imports are not accepted.",
  };
  if (language === "kana") return {
    selected: "えらんでゐます", ready: "つかへます", systemStatus: "しすてむの ひょうじゅん / つかへるかは まだ たしかめてゐません",
    localBadge: "ろーかる", localDetected: "みつけました（えらべます）",
    missingLocalModel: "ろーかるもでるが ありません",
    localUnavailable: "つかへません", localReason: (code: string) => localModelReason("kana", code),
    notDownloaded: "まだ いれてゐません", notPublishedShort: "まだ くばってゐません", select: "つかふ",
    download: "いれる", resume: "つづける", retry: "もういちど", cancel: "とめる", delete: "けす",
    downloadSize: (size: string) => `いれる おほきさ やく ${size}`,
    installedSize: (size: string) => `つかふ りょう やく ${size}`,
    installSize: (size: string) => `いれたあとの おほきさ やく ${size}`,
    currentModel: (name: string) => `いまの もでる：${name}`,
    deviceMemory: (memory: number) => `この Mac の めもり：${memory} GB`,
    recommendedMemory: (memory: number) => `すすめる めもり ${memory} GB`,
    license: (license: string, hasNotice: boolean) => hasNotice
      ? `らいせんす ${license} · へんかんもとの らいせんすぶんしょ つき`
      : `らいせんす ${license}`,
    memoryWarning: (current: number, recommended: number) => `この Mac の めもりは ${current} GB です。${recommended} GB を すすめます。うごきが おそい、または つかへない ことが あります。`,
    memoryConfirmation: (current: number, recommended: number, name: string) => `${name} は ${recommended} GB の めもりを すすめます。この Mac は ${current} GB です。それでも いれますか？`,
    deleteConfirmation: (name: string, size: string | null, selected: boolean) => `${name}を けしますか？${size ? ` やく ${size}を けします。` : ""} あとで また いれられます。${selected ? " Apple Intelligenceを つかふように もどします。" : ""}`,
    cancelFailed: "いれるのを とめられませんでした。いまの ようすを たしかめて もういちど ためしてください。",
    downloading: (progress?: number | null) => progress == null ? "いれてゐます" : `いれてゐます · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `${name}を いれる すすみぐあい`,
    paused: "とめてゐます", verifying: "たしかめてゐます", failed: "いれられませんでした", unsupported: "macOS 27 から つかへます",
    notPublished: "Core AI の もでるは まだ くばってゐません。Custom Models の なかで たしかめた ろーかるもでるは えらべます。",
    developerOverride: "ためすための もでるを えらんでゐます。もでるを かんりするには、ためすための していを はづして あぷりを ひらきなほして ください。",
    managementUnavailable: "もでるを かんりできません。ぶんしょは そのまま かきつづけられます。つぎの げんいんを なおして あぷりを ひらきなほして ください：",
    boundary: "Apple から くばる もでると Hazakura の Custom Models ふぉるだで たしかめた もでるを ここに だします。ろーかるの もでるは Local Assist で えらべます。URL と GGUF は うけつけません。",
  };
  return {
    selected: "選択中", ready: "利用可能", systemStatus: "システム標準 / 利用状況未確認",
    localBadge: "ローカル", localDetected: "検出済み（選択できます）",
    missingLocalModel: "ローカルモデルが見つかりません",
    localUnavailable: "利用不可", localReason: (code: string) => localModelReason("ja", code),
    notDownloaded: "未ダウンロード", notPublishedShort: "未公開", select: "使う",
    download: "ダウンロード", resume: "再開", retry: "再試行", cancel: "キャンセル", delete: "削除",
    downloadSize: (size: string) => `ダウンロード 約${size}`,
    installedSize: (size: string) => `使用量 約${size}`,
    installSize: (size: string) => `インストール後 約${size}`,
    currentModel: (name: string) => `現在のモデル：${name}`,
    deviceMemory: (memory: number) => `このMacのメモリ：${memory} GB`,
    recommendedMemory: (memory: number) => `推奨メモリ ${memory} GB`,
    license: (license: string, hasNotice: boolean) => hasNotice
      ? `ライセンス ${license} · 変換元のライセンス文書を同梱`
      : `ライセンス ${license}`,
    memoryWarning: (current: number, recommended: number) => `このMacは${current} GBです。${recommended} GBを推奨します。生成が遅い、または利用できない場合があります。`,
    memoryConfirmation: (current: number, recommended: number, name: string) => `${name}の推奨メモリは${recommended} GBですが、このMacは${current} GBです。それでもダウンロードしますか？`,
    deleteConfirmation: (name: string, size: string | null, selected: boolean) => `${name}を削除しますか？${size ? ` 約${size}を削除します。` : ""}後から再ダウンロードできます。${selected ? " Apple Intelligenceを現在のモデルに戻します。" : ""}`,
    cancelFailed: "ダウンロードを停止できませんでした。現在の状態を確認して、もう一度お試しください。",
    downloading: (progress?: number | null) => progress == null ? "ダウンロード中" : `ダウンロード中 · ${Math.round(progress * 100)}%`,
    downloadProgress: (name: string) => `${name}のダウンロード進捗`,
    paused: "一時停止", verifying: "検証中", failed: "ダウンロード失敗", unsupported: "macOS 27以降が必要",
    notPublished: "Core AI モデルはまだ配布されていません。Custom Models 内で検証したローカルモデルは選択できます。",
    developerOverride: "Developer用のテストモデル指定が有効です。モデルを管理するには、テスト指定を外してアプリを再起動してください。",
    managementUnavailable: "モデル管理を利用できません。文書の編集は続けられます。次の原因を解消してアプリを再起動してください：",
    boundary: "Apple 経由のモデルと Hazakura の Custom Models フォルダで検証したモデルを表示します。ローカルモデルは Local Assist で選択できます。URL と GGUF の持ち込みは受け付けません。",
  };
}

function localModelReason(language: MenuLanguage, code: string): string {
  const messages = language === "en" ? {
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
