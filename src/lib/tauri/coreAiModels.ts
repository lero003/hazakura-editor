import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";

export const SYSTEM_LOCAL_ASSIST_MODEL_ID = "apple:foundation-models:system-default";

export type CoreAiDistributionStatus = "not_published" | "available";
export type CoreAiModelKind = "system" | "core_ai";
export type CoreAiModelStatus = "ready" | "not_downloaded" | "not_published";

export type CoreAiModelSummary = {
  id: string;
  displayName: string;
  kind: CoreAiModelKind;
  status: CoreAiModelStatus;
  selected: boolean;
  downloadSizeBytes?: number;
};

export type CoreAiModelCatalog = {
  distributionStatus: CoreAiDistributionStatus;
  selectedModelId: string;
  models: CoreAiModelSummary[];
  managementError?: string | null;
  selectionLocked?: boolean;
};

export function unavailableCoreAiModelCatalog(): CoreAiModelCatalog {
  return {
    distributionStatus: "not_published",
    selectedModelId: SYSTEM_LOCAL_ASSIST_MODEL_ID,
    models: [{
      id: SYSTEM_LOCAL_ASSIST_MODEL_ID,
      displayName: "Apple Intelligence",
      kind: "system",
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

export async function startCoreAiModelDownload(modelId: string): Promise<void> {
  await invoke("start_core_ai_model_download", { modelId });
}

export async function cancelCoreAiModelDownload(modelId: string): Promise<boolean> {
  return invoke<boolean>("cancel_core_ai_model_download", { modelId });
}

export async function deleteCoreAiModel(modelId: string): Promise<CoreAiModelCatalog> {
  return invoke<CoreAiModelCatalog>("delete_core_ai_model", { modelId });
}
