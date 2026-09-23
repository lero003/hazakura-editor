import type { CoreAiModelSummary } from "./tauri/coreAiModels";

/** Both model controls use the native catalog's source-specific selection state. */
export function isCoreAiModelSelectable(model: CoreAiModelSummary): boolean {
  if (model.source === "app_managed_local" || model.source === "external_local") {
    return model.status === "detected";
  }
  return model.status === "ready";
}
