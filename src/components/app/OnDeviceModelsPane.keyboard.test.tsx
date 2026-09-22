import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesDialog } from "./PreferencesDialog";
import { OnDeviceModelsPane } from "./OnDeviceModelsPane";
import { getPreferencesCopy } from "../../lib/locale";
import { useModalKeyboardGuard } from "../../hooks/app/useModalKeyboardGuard";

// jsdom は layout を持たない。実 focus trap は client rect を見るため、
// 描画済みの操作対象として扱えるよう他の focus trap テストと同じ形で模擬する。
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
    [{ width: 40, height: 32 }] as unknown as DOMRectList,
  );
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

vi.mock("../../lib/tauri/coreAiModels", () => ({
  unavailableCoreAiModelCatalog: () => ({
    distributionStatus: "not_published",
    selectedModelId: "apple:foundation-models:system-default",
    models: [{
      id: "apple:foundation-models:system-default",
      displayName: "Apple Intelligence",
      kind: "system",
      status: "ready",
      selected: true,
    }],
  }),
  // 本文に Tab 対象を持たせる（System だけだと本文に操作対象が無く、
  // 「見出しの次」と「先頭へ戻る」の区別が付かない）。
  listCoreAiModels: async () => ({
    distributionStatus: "available",
    selectedModelId: "apple:foundation-models:system-default",
    models: [
      {
        id: "apple:foundation-models:system-default",
        displayName: "Apple Intelligence",
        kind: "system",
        status: "ready",
        selected: true,
      },
      {
        id: "apple:core-ai:gemma-4-e4b-it-int4-provider-v2",
        displayName: "Gemma 4 E4B",
        kind: "core_ai",
        status: "not_downloaded",
        selected: false,
        downloadSizeBytes: 5_431_767_284,
        assetPackVersion: 1,
      },
    ],
  }),
  listenCoreAiModelStateChanges: async () => () => undefined,
  getLocalAssistGenerationProfile: async () => null,
  listenLocalAssistGenerationProfileChanges: async () => () => undefined,
}));

const copy = getPreferencesCopy("ja");

function Host() {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const noop = () => undefined;
  const emptyRef = { current: null };
  useModalKeyboardGuard({
    appCloseDialogRef: emptyRef,
    assistDiscardDialogRef: emptyRef,
    closeTabDialogRef: emptyRef,
    commandPaletteVisible: false,
    epubExportDialogRef: emptyRef,
    epubExportSettingsOpen: false,
    pdfExportDialogRef: emptyRef,
    pdfExportSettingsOpen: false,
    globalSearchVisible: false,
    okfReviewVisible: false,
    modalOpen: true,
    moveTrashDialogRef: emptyRef,
    onCancelAppClose: noop,
    onCancelAssistDiscard: noop,
    onCancelEpubBetaExport: noop,
    onCancelPdfExport: noop,
    onCancelPendingTrash: noop,
    onCancelTabClose: noop,
    onCloseCommandPalette: noop,
    onCloseGlobalSearch: noop,
    onCloseOkfReview: noop,
    onClosePreferences: noop,
    pendingAppClose: false,
    pendingAssistDiscardOpen: false,
    pendingCloseTabOpen: false,
    pendingTrashOpen: false,
    preferencesDialogRef: dialogRef,
    preferencesOpen: true,
  });
  return <PreferencesDialog
    closeButtonRef={closeButtonRef}
    closeLabel={copy.closeDialog}
    dialogRef={dialogRef}
    menuLanguage="ja"
    mode="models"
    modelsLabel={copy.onDeviceModels}
    onChangeMode={noop}
    onClose={noop}
    title={copy.onDeviceModels}
  >
    <OnDeviceModelsPane copy={copy} language="ja" />
  </PreferencesDialog>;
}

describe("on-device model page keyboard path", () => {
  it("moves from the page heading into the body, and back to Close", async () => {
    // 見出しは tabindex=-1 の受け皿。着地した「次の一歩」が本文へ進み、
    // 戻るときは見出しの直前（ヘッダーの閉じる）へ戻ることを、実 dialog と
    // 実 modal guard の組み合わせで見る。
    render(<Host />);
    // ダイアログ見出し（h2、読み上げ専用）と同名なので、ページ本文の h3 を取る。
    const heading = await screen.findByRole("heading", { level: 3, name: copy.onDeviceModels });
    expect(document.activeElement).toBe(heading);

    const download = await screen.findByRole("button", { name: "ダウンロード" });
    fireEvent.keyDown(heading, { key: "Tab" });
    expect(document.activeElement).toBe(download);
    // ダイアログ先頭（ヘッダーのページ選択）へ戻らない。
    expect(document.activeElement).not.toBe(screen.getByRole("combobox", { name: "設定 / ヘルプ" }));

    heading.focus();
    fireEvent.keyDown(heading, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: copy.closeDialog }));
  });
});
