// Presentation-only fixture: real settings components with simulated IPC.
// It never downloads, loads, removes, or selects an actual model.
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { PreferencesDialog } from "../../../src/components/app/PreferencesDialog";
import { OnDeviceModelsPane } from "../../../src/components/app/OnDeviceModelsPane";
import { getPreferencesCopy } from "../../../src/lib/locale";
import type { CoreAiModelCatalog } from "../../../src/lib/tauri/coreAiModels";
import type { MenuLanguage } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const language = (params.get("lang") ?? "ja") as MenuLanguage;
const theme = params.get("theme") ?? "light";
const ready = params.has("ready");
const local = params.has("local");
const localId = "local:external:sample";
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.themePreference = theme;

const catalog: CoreAiModelCatalog = {
  distributionStatus: "available",
  selectedModelId: local ? localId : "apple:foundation-models:system-default",
  deviceMemoryGb: 16,
  models: [
    {
      id: "apple:foundation-models:system-default", displayName: "Apple Intelligence",
      kind: "system", status: "ready", selected: !local,
    },
    {
      id: "apple:core-ai:gemma-4-12b-it-int8-v1", displayName: "Gemma 4 12B",
      kind: "core_ai", status: ready ? "ready" : "failed", selected: false,
      downloadSizeBytes: 9_148_924_300, installedSizeBytes: 14_698_433_203,
      minimumMemoryGb: 16, recommendedMemoryGb: 24, license: "Apache-2.0",
      canRemove: true, assetPackVersion: 2, errorCode: ready ? null : "verification-failed",
      error: ready ? null : "Core AI SHA-256 mismatch for model.bin.",
    },
    ...(local ? [{
      id: localId, displayName: "登録したモデル", kind: "core_ai" as const,
      source: "external_local" as const, status: "detected" as const, selected: true,
    }] : []),
  ],
};

mockIPC(async (command) => {
  if (command === "list_core_ai_models") return catalog;
  if (command === "local_assist_generation_profile") return null;
  if (command === "prepare_apple_assist_generation") return null;
  if (command === "generate_apple_assist_candidate") return {
    operation: "rephrase", candidateText: "春風が心地よいです。", modelId: localId, latencyMs: 100,
  };
  if (command === "finish_apple_assist_generation") return null;
  if (command === "stop_apple_assist_candidate") return true;
  return undefined;
});

function Fixture() {
  const copy = getPreferencesCopy(language);
  return <div className="modal-backdrop" role="presentation">
    <PreferencesDialog
      closeButtonRef={{ current: null }}
      closeLabel={copy.closeDialog}
      dialogRef={{ current: null }}
      menuLanguage={language}
      mode="models"
      modelsLabel={copy.onDeviceModels}
      onChangeMode={() => undefined}
      onClose={() => undefined}
      title={copy.onDeviceModels}
    >
      <OnDeviceModelsPane copy={copy} language={language} />
    </PreferencesDialog>
  </div>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
