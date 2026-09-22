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
export function AssistModelPicker({ language, disabled, modelId, models, onSelect }: {
  language: MenuLanguage;
  disabled: boolean;
  modelId?: string;
  models?: CoreAiModelSummary[];
  onSelect?: (modelId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<Array<HTMLButtonElement | null>>([]);
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
  const missingLocal = outsideCatalog && modelId.startsWith("local:app-managed:");
  const catalogModels = models?.length ? models : unavailableCoreAiModelCatalog().models;
  const availableModels: CoreAiModelSummary[] = missingLocal
    ? [...catalogModels, {
      id: modelId, displayName: language === "en" ? "Local model unavailable"
        : language === "kana" ? "ろーかるもでるが ありません" : "ローカルモデルが見つかりません",
      kind: "core_ai", source: "app_managed_local", status: "failed", selected: true,
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
        const enabledOptions = options.current.filter((option): option is HTMLButtonElement => Boolean(option && !option.disabled));
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
      <span>{modelLabel}</span>
      <span className="apple-assist-model-chevron" aria-hidden="true"><ChevronIcon expanded /></span>
    </button>
    {expanded ? <div id={menuId} className="apple-assist-model-menu" role="menu" aria-label={title}>
      <p className="apple-assist-model-heading" aria-hidden="true">{title}</p>
      {availableModels.map((model, index) => {
        const selected = model.id === selectedId;
        return <button key={model.id} ref={(node) => { options.current[index] = node; }} type="button"
          role="menuitemradio" aria-checked={selected} tabIndex={-1}
          disabled={!isCoreAiModelSelectable(model)}
          className="apple-assist-model-option"
          onFocus={() => { focusedModelId.current = model.id; }}
          onClick={() => {
            if (!selected) void onSelect?.(model.id);
            close(true);
          }}>
          <span>{model.displayName}</span><span aria-hidden="true">{selected ? "✓" : isCoreAiModelSelectable(model) ? "" : "—"}</span>
        </button>;
      })}
    </div> : null}
  </div>;
}
