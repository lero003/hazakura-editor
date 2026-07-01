import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { useModalKeyboardGuard } from "./useModalKeyboardGuard";

// `trapFocusInElement` filters focusable candidates with
// `element.offsetParent !== null`. jsdom does not run a layout
// engine, so `offsetParent` is `null` for every element. Stub it
// out so the test mirrors a rendered browser environment where
// buttons in the DOM are considered visible.
if (!("offsetParent" in HTMLElement.prototype) ||
  // Older jsdom does not define a configurable getter.
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent") ===
    undefined) {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });
} else {
  // jsdom ships a getter that returns null; override it for the
  // duration of these tests.
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });
}

type RefValue<T> = { current: T | null };

function renderGuard(overrides: {
  modalOpen?: boolean;
  appCloseDialogRef?: RefValue<HTMLElement>;
  assistDiscardDialogRef?: RefValue<HTMLElement>;
  closeTabDialogRef?: RefValue<HTMLElement>;
  epubExportDialogRef?: RefValue<HTMLElement>;
  pdfExportDialogRef?: RefValue<HTMLElement>;
  moveTrashDialogRef?: RefValue<HTMLElement>;
  preferencesDialogRef?: RefValue<HTMLElement>;
  pendingAppClose?: boolean;
  pendingAssistDiscardOpen?: boolean;
  pendingCloseTabOpen?: boolean;
  epubExportSettingsOpen?: boolean;
  pdfExportSettingsOpen?: boolean;
  pendingTrashOpen?: boolean;
  preferencesOpen?: boolean;
  commandPaletteVisible?: boolean;
  globalSearchVisible?: boolean;
  onCancelAppClose?: () => void;
  onCancelAssistDiscard?: () => void;
  onCancelEpubBetaExport?: () => void;
  onCancelPdfExport?: () => void;
  onCancelPendingTrash?: () => void;
  onCancelTabClose?: () => void;
  onCloseCommandPalette?: () => void;
  onCloseGlobalSearch?: () => void;
  onClosePreferences?: () => void;
}) {
  const onCancelAppClose = overrides.onCancelAppClose ?? vi.fn();
  const onCancelAssistDiscard = overrides.onCancelAssistDiscard ?? vi.fn();
  const onCancelEpubBetaExport = overrides.onCancelEpubBetaExport ?? vi.fn();
  const onCancelPdfExport = overrides.onCancelPdfExport ?? vi.fn();
  const onCancelPendingTrash = overrides.onCancelPendingTrash ?? vi.fn();
  const onCancelTabClose = overrides.onCancelTabClose ?? vi.fn();
  const onCloseCommandPalette = overrides.onCloseCommandPalette ?? vi.fn();
  const onCloseGlobalSearch = overrides.onCloseGlobalSearch ?? vi.fn();
  const onClosePreferences = overrides.onClosePreferences ?? vi.fn();
  const appCloseDialogRef = overrides.appCloseDialogRef ?? {
    current: null,
  };
  const assistDiscardDialogRef = overrides.assistDiscardDialogRef ?? {
    current: null,
  };
  const closeTabDialogRef = overrides.closeTabDialogRef ?? {
    current: null,
  };
  const epubExportDialogRef = overrides.epubExportDialogRef ?? {
    current: null,
  };
  const pdfExportDialogRef = overrides.pdfExportDialogRef ?? {
    current: null,
  };
  const moveTrashDialogRef = overrides.moveTrashDialogRef ?? {
    current: null,
  };
  const preferencesDialogRef = overrides.preferencesDialogRef ?? {
    current: null,
  };

  function Host() {
    useModalKeyboardGuard({
      appCloseDialogRef,
      assistDiscardDialogRef,
      closeTabDialogRef,
      commandPaletteVisible: overrides.commandPaletteVisible ?? false,
      epubExportDialogRef,
      epubExportSettingsOpen: overrides.epubExportSettingsOpen ?? false,
      pdfExportDialogRef,
      pdfExportSettingsOpen: overrides.pdfExportSettingsOpen ?? false,
      globalSearchVisible: overrides.globalSearchVisible ?? false,
      modalOpen: overrides.modalOpen ?? true,
      moveTrashDialogRef,
      onCancelAppClose,
      onCancelAssistDiscard,
      onCancelEpubBetaExport,
      onCancelPdfExport,
      onCancelPendingTrash,
      onCancelTabClose,
      onCloseCommandPalette,
      onCloseGlobalSearch,
      onClosePreferences,
      pendingAppClose: overrides.pendingAppClose ?? false,
      pendingAssistDiscardOpen: overrides.pendingAssistDiscardOpen ?? false,
      pendingCloseTabOpen: overrides.pendingCloseTabOpen ?? false,
      pendingTrashOpen: overrides.pendingTrashOpen ?? false,
      preferencesDialogRef,
      preferencesOpen: overrides.preferencesOpen ?? false,
    });
    return null;
  }

  const utils = render(<Host />);
  return {
    ...utils,
    appCloseDialogRef,
    assistDiscardDialogRef,
    closeTabDialogRef,
    epubExportDialogRef,
    pdfExportDialogRef,
    moveTrashDialogRef,
    onCancelAppClose,
    onCancelAssistDiscard,
    onCancelEpubBetaExport,
    onCancelPdfExport,
    onCancelPendingTrash,
    onCancelTabClose,
    onCloseCommandPalette,
    onCloseGlobalSearch,
    onClosePreferences,
    preferencesDialogRef,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useModalKeyboardGuard v0.7 modal Escape routing", () => {
  it("routes Escape to onCancelTabClose when a dirty tab is closing", () => {
    const utils = renderGuard({ pendingCloseTabOpen: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelTabClose).toHaveBeenCalledTimes(1);
    expect(utils.onCancelAppClose).not.toHaveBeenCalled();
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
  });

  it("routes Escape to onCancelAppClose when the app is closing", () => {
    const utils = renderGuard({ pendingAppClose: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelAppClose).toHaveBeenCalledTimes(1);
    expect(utils.onCancelTabClose).not.toHaveBeenCalled();
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
  });

  it("routes Escape to onClosePreferences when the preferences dialog is open", () => {
    const utils = renderGuard({ preferencesOpen: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onClosePreferences).toHaveBeenCalledTimes(1);
    expect(utils.onCancelTabClose).not.toHaveBeenCalled();
    expect(utils.onCancelAppClose).not.toHaveBeenCalled();
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
  });

  it("routes Escape to onCancelEpubBetaExport when the EPUB settings dialog is open", () => {
    const utils = renderGuard({ epubExportSettingsOpen: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelEpubBetaExport).toHaveBeenCalledTimes(1);
    expect(utils.onCancelTabClose).not.toHaveBeenCalled();
    expect(utils.onCancelAppClose).not.toHaveBeenCalled();
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
  });

  it("routes Escape to onCancelPdfExport when the PDF settings dialog is open", () => {
    const utils = renderGuard({ pdfExportSettingsOpen: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelPdfExport).toHaveBeenCalledTimes(1);
    expect(utils.onCancelEpubBetaExport).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
  });

  it("prefers the command palette over the move-to-trash dialog on Escape", () => {
    // The v0.8 daily-editor rule: the most-recent / topmost
    // modal surface wins. If the user opened the palette over
    // the move-to-trash dialog, the palette should close first
    // so a second Esc can address the trash dialog.
    const utils = renderGuard({
      commandPaletteVisible: true,
      pendingTrashOpen: true,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCloseCommandPalette).toHaveBeenCalledTimes(1);
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
  });
});

describe("useModalKeyboardGuard v0.18 move-to-trash Escape routing", () => {
  it("routes Escape to onCancelPendingTrash when the trash dialog is pending", () => {
    // v0.18 accessibility follow-up: pressing Escape on the
    // open move-to-trash dialog must call the same handler
    // the Cancel button uses so keyboard users can dismiss
    // the destructive confirmation.
    const utils = renderGuard({ pendingTrashOpen: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelPendingTrash).toHaveBeenCalledTimes(1);
    expect(utils.onCancelTabClose).not.toHaveBeenCalled();
    expect(utils.onCancelAppClose).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
  });

  it("routes Escape to onCancelAssistDiscard when the assist discard dialog is pending", () => {
    // v1.3: the Local Assist discard confirmation is a
    // destructive confirmation, so Escape must route to the
    // same cancel handler the Cancel button uses.
    const utils = renderGuard({ pendingAssistDiscardOpen: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelAssistDiscard).toHaveBeenCalledTimes(1);
    expect(utils.onCancelTabClose).not.toHaveBeenCalled();
    expect(utils.onCancelAppClose).not.toHaveBeenCalled();
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
  });

  it("ignores Escape during IME composition so Japanese input is not stolen", () => {
    // v0.7-era behavior: an IME composition event must not
    // route to a close handler. The v0.18 trash routing
    // reuses the same `isImeComposing` guard so the
    // composition-underway case is not regressed.
    const utils = renderGuard({ pendingTrashOpen: true });
    fireEvent.keyDown(window, { key: "Escape", isComposing: true });
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
  });

  it("does not attach a keydown listener when no modal is open", () => {
    const utils = renderGuard({ modalOpen: false });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(utils.onCancelPendingTrash).not.toHaveBeenCalled();
    expect(utils.onCancelTabClose).not.toHaveBeenCalled();
    expect(utils.onCancelAppClose).not.toHaveBeenCalled();
    expect(utils.onClosePreferences).not.toHaveBeenCalled();
    expect(utils.onCloseCommandPalette).not.toHaveBeenCalled();
    expect(utils.onCloseGlobalSearch).not.toHaveBeenCalled();
  });
});

describe("useModalKeyboardGuard v0.18 move-to-trash Tab trap", () => {
  function setupDialog() {
    const section = document.createElement("section");
    section.setAttribute("role", "dialog");
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "Move to Trash";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    section.append(confirmButton, cancelButton);
    document.body.append(section);
    const dialogRef: RefValue<HTMLElement> = { current: section };
    return {
      cancelButton,
      confirmButton,
      dialogRef,
      cleanup: () => {
        section.remove();
      },
    };
  }

  it("wraps Tab from the last focusable back to the first inside the trash dialog", async () => {
    // The v0.18 follow-up: pressing Tab from the Cancel
    // button (the last focusable in the trash dialog) must
    // wrap back to the first focusable (Confirm) instead of
    // escaping to the workspace tree behind the dialog.
    const { cancelButton, cleanup, confirmButton, dialogRef } = setupDialog();
    const utils = renderGuard({
      moveTrashDialogRef: dialogRef,
      pendingTrashOpen: true,
    });

    // Park the focus on the last focusable so the next Tab
    // is the wrap-around case.
    await act(async () => {
      cancelButton.focus();
    });
    expect(document.activeElement).toBe(cancelButton);

    fireEvent.keyDown(window, { key: "Tab" });

    // `trapFocusInElement` uses preventDefault + a
    // programmatic focus, so the focused element should now
    // be the first focusable inside the dialog.
    expect(document.activeElement).toBe(confirmButton);

    utils.unmount();
    cleanup();
  });

  it("wraps Shift+Tab from the first focusable back to the last inside the trash dialog", async () => {
    const { cancelButton, cleanup, confirmButton, dialogRef } = setupDialog();
    const utils = renderGuard({
      moveTrashDialogRef: dialogRef,
      pendingTrashOpen: true,
    });

    await act(async () => {
      confirmButton.focus();
    });
    expect(document.activeElement).toBe(confirmButton);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(cancelButton);

    utils.unmount();
    cleanup();
  });

  it("does not steal focus when the active element is in the middle of the dialog", async () => {
    // The focus trap should only intervene on the wrap-around
    // case. Tab from a middle focusable should let the
    // browser follow its native order.
    const { cancelButton, cleanup, confirmButton, dialogRef } = setupDialog();
    const utils = renderGuard({
      moveTrashDialogRef: dialogRef,
      pendingTrashOpen: true,
    });

    await act(async () => {
      confirmButton.focus();
    });
    // Simulate the user pressing Tab naturally; the browser
    // would move focus to the next focusable element. The
    // hook's Tab handler must NOT call preventDefault, so
    // defaultPrevented stays false.
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);

    void cancelButton;
    utils.unmount();
    cleanup();
  });

  it("uses the trash dialog ref (not preferences) when both refs are populated", async () => {
    // Guard against a regression where the Tab trap points
    // at the wrong dialog. The preferences dialog is also a
    // modal-shaped surface; the hook must target the trash
    // dialog when `pendingTrashOpen` is true.
    const trashSection = document.createElement("section");
    trashSection.setAttribute("role", "dialog");
    const trashButton = document.createElement("button");
    trashButton.type = "button";
    trashButton.textContent = "Trash Cancel";
    trashSection.append(trashButton);
    document.body.append(trashSection);

    const preferencesSection = document.createElement("section");
    preferencesSection.setAttribute("role", "dialog");
    const preferencesButton = document.createElement("button");
    preferencesButton.type = "button";
    preferencesButton.textContent = "Preferences Close";
    preferencesSection.append(preferencesButton);
    document.body.append(preferencesSection);

    const utils = renderGuard({
      moveTrashDialogRef: { current: trashSection },
      pendingTrashOpen: true,
      preferencesDialogRef: { current: preferencesSection },
      preferencesOpen: true,
    });

    await act(async () => {
      trashButton.focus();
    });
    // Tab from the only focusable in the trash dialog should
    // wrap back to itself, not escape to the preferences
    // dialog.
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(trashButton);
    expect(document.activeElement).not.toBe(preferencesButton);

    utils.unmount();
    trashSection.remove();
    preferencesSection.remove();
  });
});

describe("useModalKeyboardGuard export settings Tab trap", () => {
  function setupDialog() {
    const section = document.createElement("section");
    section.setAttribute("role", "dialog");
    const titleInput = document.createElement("input");
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Export";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    section.append(titleInput, exportButton, cancelButton);
    document.body.append(section);
    const dialogRef: RefValue<HTMLElement> = { current: section };
    return {
      cancelButton,
      cleanup: () => {
        section.remove();
      },
      dialogRef,
      titleInput,
    };
  }

  it("wraps Tab from the last focusable back to the first inside the EPUB settings dialog", async () => {
    const { cancelButton, cleanup, dialogRef, titleInput } = setupDialog();
    const utils = renderGuard({
      epubExportDialogRef: dialogRef,
      epubExportSettingsOpen: true,
    });

    await act(async () => {
      cancelButton.focus();
    });
    expect(document.activeElement).toBe(cancelButton);

    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(titleInput);

    utils.unmount();
    cleanup();
  });

  it("wraps Tab inside the PDF settings dialog", async () => {
    const { cancelButton, cleanup, dialogRef, titleInput } = setupDialog();
    const utils = renderGuard({
      pdfExportDialogRef: dialogRef,
      pdfExportSettingsOpen: true,
    });

    await act(async () => {
      cancelButton.focus();
    });
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(titleInput);

    utils.unmount();
    cleanup();
  });
});
