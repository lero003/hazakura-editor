import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./_runtime";

export const SYSTEM_LOCAL_ASSIST_MODEL_ID = "apple:foundation-models:system-default";
export const CORE_AI_MODEL_STATE_CHANGED_EVENT = "core-ai-model-state-changed";
export const LOCAL_ASSIST_GENERATION_PROFILE_CHANGED_EVENT =
  "local-assist-generation-profile-changed";

export type CoreAiDistributionStatus = "not_published" | "available";
export type CoreAiModelKind = "system" | "core_ai";
/**
 * Where a model came from. `app_managed_local` means Rust detected a bundle in
 * the Custom Models directory and validated it with the local contract; those
 * entries can be selected but are not managed as downloaded assets.
 */
export type CoreAiModelSource = "apple_hosted" | "app_managed_local";
export type CoreAiModelStatus =
  | "ready"
  | "not_downloaded"
  | "downloading"
  | "paused"
  | "verifying"
  | "failed"
  | "unsupported"
  | "not_published"
  | "detected";

export type CoreAiModelSummary = {
  id: string;
  displayName: string;
  kind: CoreAiModelKind;
  /** Absent in older payloads, which only ever listed Apple-hosted models. */
  source?: CoreAiModelSource;
  status: CoreAiModelStatus;
  selected: boolean;
  downloadSizeBytes?: number;
  installedSizeBytes?: number;
  recommendedMemoryGb?: number;
  license?: string;
  hasUpstreamConversionNotice?: boolean;
  progress?: number | null;
  error?: string | null;
  /** Stable code for a frontend-owned message; local entries use this instead of `error`. */
  errorCode?: string | null;
  assetPackVersion?: number | null;
};

export type CoreAiModelCatalog = {
  distributionStatus: CoreAiDistributionStatus;
  selectedModelId: string;
  models: CoreAiModelSummary[];
  managementError?: string | null;
  selectionLocked?: boolean;
  deviceMemoryGb?: number;
};

export function unavailableCoreAiModelCatalog(): CoreAiModelCatalog {
  return {
    distributionStatus: "not_published",
    selectedModelId: SYSTEM_LOCAL_ASSIST_MODEL_ID,
    models: [{
      id: SYSTEM_LOCAL_ASSIST_MODEL_ID,
      displayName: "Apple Intelligence",
      kind: "system",
      source: "apple_hosted",
      status: "ready",
      selected: true,
    }],
  };
}

export async function listCoreAiModels(): Promise<CoreAiModelCatalog> {
  if (!isTauriRuntime()) return unavailableCoreAiModelCatalog();
  return invoke<CoreAiModelCatalog>("list_core_ai_models");
}

export async function selectLocalAssistModel(modelId: string): Promise<CoreAiModelCatalog> {
  return invoke<CoreAiModelCatalog>("select_local_assist_model", { modelId });
}

export async function startCoreAiModelDownload(modelId: string): Promise<CoreAiModelCatalog> {
  return invoke<CoreAiModelCatalog>("start_core_ai_model_download", { modelId });
}

export async function cancelCoreAiModelDownload(modelId: string): Promise<boolean> {
  return invoke<boolean>("cancel_core_ai_model_download", { modelId });
}

export async function deleteCoreAiModel(modelId: string): Promise<CoreAiModelCatalog> {
  return invoke<CoreAiModelCatalog>("delete_core_ai_model", { modelId });
}

export async function listenCoreAiModelStateChanges(
  onChange: (catalog: CoreAiModelCatalog) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => undefined;
  return listen<CoreAiModelCatalog>(CORE_AI_MODEL_STATE_CHANGED_EVENT, (event) => {
    onChange(event.payload);
  });
}

/**
 * The generation settings the helper actually reported for the last Local
 * Assist run. Rust owns this record: it is built from the helper's `usage`
 * envelope, not from a copy of the numbers in the webview. `null` means this
 * session has not observed a run that reported usage yet.
 */
export type LocalAssistGenerationProfile = {
  modelId: string;
  maximumResponseTokens?: number | null;
  samplingRequested?: string | null;
  samplingEffective?: string | null;
  promptTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
};

export async function getLocalAssistGenerationProfile(): Promise<LocalAssistGenerationProfile | null> {
  if (!isTauriRuntime()) return null;
  return invoke<LocalAssistGenerationProfile | null>("local_assist_generation_profile");
}

export async function listenLocalAssistGenerationProfileChanges(
  onChange: (profile: LocalAssistGenerationProfile) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) return () => undefined;
  return listen<LocalAssistGenerationProfile>(
    LOCAL_ASSIST_GENERATION_PROFILE_CHANGED_EVENT,
    (event) => {
      onChange(event.payload);
    },
  );
}
