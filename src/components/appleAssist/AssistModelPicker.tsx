import { useEffect, useId, useRef, useState } from "react";
import type { MenuLanguage } from "../../types";
import { getAssistConversationCopy } from "../../lib/locale/assistConversation";
import { isCoreAiModelSelectable } from "../../lib/coreAiModelSelection";
import { ChevronIcon } from "../app/Icons";
import {
  SYSTEM_LOCAL_ASSIST_MODEL_ID,
  unavailableCoreAiModelCatalog,
  type CoreAiModelSummary,
} from "../../lib/tauri/coreAiModels";

// Only native-catalog ids can be selected. A missing local resource still lets
// the user switch back to System; a Developer override stays read-only.
export function AssistModelPicker({ language, disabled, modelId, models, onSelect, onManage }: {
  language: MenuLanguage;
  disabled: boolean;
  modelId?: string;
  models?: CoreAiModelSummary[];
  onSelect?: (modelId: string) => void | Promise<void>;
  onManage?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<Array<HTMLButtonElement | null>>([]);
  const manageOption = useRef<HTMLButtonElement>(null);
  const focusedModelId = useRef<string | null>(null);
  const wasExpanded = useRef(false);
  const menuId = useId();
  const title = getAssistConversationCopy(language).chooseModel;
  const fallbackModelLabel = modelId === "apple:core-ai:qwen3-0.6b-test"
    ? "Core AI · Qwen3 0.6B (test)"
    : modelId === undefined || modelId === SYSTEM_LOCAL_ASSIST_MODEL_ID
      ? "Apple Intelligence"
      : "On-device model";
  const outsideCatalog = modelId && modelId !== SYSTEM_LOCAL_ASSIST_MODEL_ID
    && !models?.some((model) => model.id === modelId);
  const missingLocal = outsideCatalog && modelId.startsWith("local:");
  const catalogModels = models?.length ? models : unavailableCoreAiModelCatalog().models;
  const availableModels: CoreAiModelSummary[] = missingLocal
    ? [...catalogModels, {
      id: modelId, displayName: language === "en" ? "Local model unavailable"
        : language === "kana" ? "ろーかるもでるが ありません" : "ローカルモデルが見つかりません",
      kind: "core_ai", source: modelId.startsWith("local:external:") ? "external_local" : "app_managed_local", status: "failed", selected: true,
    }]
    : outsideCatalog
    ? [{
      id: modelId, displayName: fallbackModelLabel, kind: "core_ai" as const,
      status: "ready" as const, selected: true,
    }]
    : catalogModels;
  const selectedModel = availableModels.find((model) => model.id === modelId)
    ?? availableModels.find((model) => model.selected)
    ?? availableModels[0];
  const selectedId = selectedModel?.id ?? SYSTEM_LOCAL_ASSIST_MODEL_ID;
  const modelLabel = selectedModel?.displayName ?? fallbackModelLabel;
  const expanded = open && !disabled;
  const close = (restoreFocus: boolean) => {
    if (restoreFocus) trigger.current?.focus();
    setOpen(false);
  };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [expanded]);
  useEffect(() => {
    if (!expanded) {
      wasExpanded.current = false;
      focusedModelId.current = null;
      return;
    }
    if (document.activeElement === manageOption.current) return;
    const preferredId = wasExpanded.current ? focusedModelId.current : selectedId;
    wasExpanded.current = true;
    const preferredIndex = availableModels.findIndex((model) => model.id === preferredId && isCoreAiModelSelectable(model));
    const fallbackIndex = availableModels.findIndex((model) => model.id === selectedId && isCoreAiModelSelectable(model));
    const index = preferredIndex >= 0 ? preferredIndex
      : fallbackIndex >= 0 ? fallbackIndex
        : availableModels.findIndex(isCoreAiModelSelectable);
    if (index >= 0 && document.activeElement !== options.current[index]) options.current[index]?.focus();
  }, [availableModels, expanded, selectedId]);

  return <div className="apple-assist-model-picker" ref={root}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && expanded) {
        event.preventDefault(); event.stopPropagation(); close(true);
      } else if (event.key === "Tab" && expanded) {
        // Continue native tab order from the trigger to the next/previous control.
        close(true);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && !disabled) {
        event.preventDefault();
        if (!expanded) {
          setOpen(true);
          return;
        }
        const enabledOptions = [...options.current, manageOption.current].filter((option): option is HTMLButtonElement => Boolean(option && !option.disabled));
        if (!enabledOptions.length) return;
        const current = enabledOptions.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? enabledOptions.length - 1
          : event.key === "ArrowUp" ? (current - 1 + enabledOptions.length) % enabledOptions.length
            : (current + 1) % enabledOptions.length;
        enabledOptions[next]?.focus();
      }
    }}>
    <button ref={trigger} type="button" className="apple-assist-model-trigger"
      aria-haspopup="menu" aria-expanded={expanded} aria-controls={expanded ? menuId : undefined}
      aria-label={`${title}: ${modelLabel}`} disabled={disabled}
      onClick={() => setOpen(!expanded)}>
      <span className="apple-assist-model-prefix" aria-hidden="true">{language === "en" ? "Model:" : language === "kana" ? "もでる：" : "モデル："}</span>
      <span>{modelLabel}</span>
      <span className="apple-assist-model-chevron" aria-hidden="true"><ChevronIcon expanded /></span>
    </button>
    {expanded ? <div id={menuId} className="apple-assist-model-menu" role="menu" aria-label={title}>
      <p className="apple-assist-model-heading" aria-hidden="true">{title}</p>
      {availableModels.map((model, index) => {
        const selected = model.id === selectedId;
        const selectable = isCoreAiModelSelectable(model);
        const unavailableReason = selectable ? null : modelUnavailableReason(model, language);
        return <button key={model.id} ref={(node) => { options.current[index] = node; }} type="button"
          role="menuitemradio" aria-checked={selected} tabIndex={-1}
          aria-label={unavailableReason ? `${model.displayName}${language === "en" ? ": " : "："}${unavailableReason}` : undefined}
          disabled={!selectable}
          className="apple-assist-model-option"
          onFocus={() => { focusedModelId.current = model.id; }}
          onClick={() => {
            if (!outsideCatalog || missingLocal) void onSelect?.(model.id);
            close(true);
          }}>
          <span>{model.displayName}</span>
          {unavailableReason ? <span className="apple-assist-model-option-status">{unavailableReason}</span> : null}
          {selected ? <span aria-hidden="true">✓</span> : null}
        </button>;
      })}
      {onManage ? <button ref={manageOption} type="button" role="menuitem" tabIndex={-1}
        className="apple-assist-model-option apple-assist-model-manage"
        onClick={() => { close(false); void onManage(); }}>
        {language === "en" ? "Add or manage models…" : language === "kana" ? "もでるを たす・かんりする…" : "モデルを追加・管理…"}
      </button> : null}
    </div> : null}
  </div>;
}

function modelUnavailableReason(model: CoreAiModelSummary, language: MenuLanguage): string {
  const copy = language === "en" ? {
    notDownloaded: "Not downloaded", downloading: "Downloading", paused: "Paused",
    verifying: "Verifying", folder: "Check model folder", verificationFailed: "Verification failed",
    downloadFailed: "Download failed", notPublished: "Not published",
    unsupported: "Unavailable on this Mac", preview: "Unavailable in this preview", unavailable: "Unavailable",
  } : language === "kana" ? {
    notDownloaded: "まだ いれてゐません", downloading: "いれてゐます", paused: "とめてゐます",
    verifying: "たしかめてゐます", folder: "ふぉるだを たしかめる", verificationFailed: "たしかめられませんでした",
    downloadFailed: "いれられませんでした", notPublished: "まだ くばってゐません",
    unsupported: "この Mac では つかへません", preview: "この ばんでは いれられません", unavailable: "つかへません",
  } : {
    notDownloaded: "未ダウンロード", downloading: "ダウンロード中", paused: "一時停止",
    verifying: "検証中", folder: "フォルダを確認", verificationFailed: "検証に失敗",
    downloadFailed: "取得に失敗", notPublished: "未公開",
    unsupported: "このMacでは利用不可", preview: "この版では取得不可", unavailable: "利用不可",
  };
  if (model.source === "app_managed_local" || model.source === "external_local") return copy.folder;
  if (model.status === "not_downloaded") return copy.notDownloaded;
  if (model.status === "downloading") {
    return model.progress == null || !Number.isFinite(model.progress) ? copy.downloading
      : `${copy.downloading} ${Math.round(Math.max(0, Math.min(1, model.progress)) * 100)}%`;
  }
  if (model.status === "paused") return copy.paused;
  if (model.status === "verifying") return copy.verifying;
  if (model.status === "failed") return model.errorCode === "verification-failed"
    ? copy.verificationFailed : copy.downloadFailed;
  if (model.status === "not_published") return copy.notPublished;
  if (model.status === "unsupported") return model.errorCode === "local-preview"
    ? copy.preview : copy.unsupported;
  return copy.unavailable;
}
