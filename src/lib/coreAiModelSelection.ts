import type { CoreAiModelSummary } from "./tauri/coreAiModels";

/** Both model controls use the native catalog's source-specific selection state. */
export function isCoreAiModelSelectable(model: CoreAiModelSummary): boolean {
  return model.source === "app_managed_local"
    ? model.status === "detected"
    : model.status === "ready";
}
