// Browser-only presentation fixture. Real components, simulated IPC; no download,
// no model load, no file access, no persistence. This is a development entry, not
// the app bundle entry.
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { PreferencesDialog } from "../../../src/components/app/PreferencesDialog";
import { OnDeviceModelsPane } from "../../../src/components/app/OnDeviceModelsPane";
import { getPreferencesCopy } from "../../../src/lib/locale";
import type { CoreAiModelCatalog } from "../../../src/lib/tauri/coreAiModels";
import type { MenuLanguage } from "../../../src/types";
import "../../../src/styles/index.css";

const params = new URLSearchParams(location.search);
const lang = (params.get("lang") ?? "ja") as MenuLanguage;
const theme = params.get("theme") ?? "light";
localStorage.setItem("hazakura-note-theme", theme);
localStorage.setItem("hazakura-note-menu-language", lang);
// 本物のウィンドウは useAppPreferences が html[data-theme] を書く。fixture は
// ダイアログだけを描くので、同じ属性をここで立ててテーマ CSS を効かせる。
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.themePreference = theme;

const notPublished: CoreAiModelCatalog = {
  distributionStatus: "not_published",
  selectedModelId: "apple:foundation-models:system-default",
  models: [{
    id: "apple:foundation-models:system-default",
    displayName: "Apple Intelligence",
    kind: "system",
    status: "ready",
    selected: true,
  }],
};

const downloaded: CoreAiModelCatalog = {
  distributionStatus: "available",
  selectedModelId: "apple:core-ai:gemma-4-e4b-it-int4-v1",
  models: [
    {
      id: "apple:foundation-models:system-default",
      displayName: "Apple Intelligence",
      kind: "system",
      status: "ready",
      selected: false,
    },
    {
      id: "apple:core-ai:gemma-4-e4b-it-int4-v1",
      displayName: "Gemma 4 E4B",
      kind: "core_ai",
      status: "ready",
      selected: true,
      downloadSizeBytes: 5_431_767_284,
      assetPackVersion: 1,
    },
    {
      id: "apple:core-ai:gemma-4-12b-it-int8-v1",
      displayName: "Gemma 4 12B",
      kind: "core_ai",
      status: "downloading",
      selected: false,
      progress: 0.42,
      downloadSizeBytes: 9_148_928_727,
    },
  ],
};

const catalog = params.has("empty") ? notPublished : downloaded;
const profile = params.has("noprofile") ? null : {
  modelId: "apple:core-ai:gemma-4-e4b-it-int4-v1",
  maximumResponseTokens: 2048,
  samplingRequested: "temperature=none(greedy)",
  samplingEffective: "greedy",
  promptTokens: 812,
  outputTokens: 24,
  cachedTokens: 640,
};

mockIPC(async (command) => {
  if (command === "list_core_ai_models") return catalog;
  if (command === "local_assist_generation_profile") return profile;
  return undefined;
});

function Fixture() {
  const copy = getPreferencesCopy(lang);
  return <div className="modal-backdrop" role="presentation">
    <PreferencesDialog
      closeButtonRef={{ current: null }}
      closeLabel={copy.closeDialog}
      dialogRef={{ current: null }}
      menuLanguage={lang}
      mode="models"
      modelsLabel={copy.onDeviceModels}
      onChangeMode={() => undefined}
      onClose={() => undefined}
      title={copy.onDeviceModels}
    >
      <OnDeviceModelsPane copy={copy} language={lang} />
    </PreferencesDialog>
  </div>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
