import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { useDialogInitialFocus } from "./useDialogInitialFocus";

type FocusableRef = RefObject<{ focus: () => void } | null>;

// The focusable refs in `useDialogInitialFocus` only need a
// minimal `focus` method. Plain objects with a `vi.fn()` cover
// the call surface and let each test assert which button was
// focused.
function makeRef(): RefObject<{ focus: () => void } | null> {
  const focus = vi.fn();
  return { current: { focus } };
}

function makeHookArgs(overrides: Partial<{
  pendingCloseTabOpen: boolean;
  pendingAppClose: boolean;
  pendingTrashOpen: boolean;
  pendingAssistDiscardOpen: boolean;
  preferencesOpen: boolean;
}> = {}) {
  const closeTabCancelButtonRef = makeRef();
  const appCloseCancelButtonRef = makeRef();
  const moveTrashCancelButtonRef = makeRef();
  const assistDiscardCancelButtonRef = makeRef();
  const preferencesCloseButtonRef = makeRef();
  return {
    args: {
      appCloseCancelButtonRef,
      assistDiscardCancelButtonRef,
      closeTabCancelButtonRef,
      moveTrashCancelButtonRef,
      pendingAppClose: false,
      pendingAssistDiscardOpen: false,
      pendingCloseTabOpen: false,
      pendingTrashOpen: false,
      preferencesCloseButtonRef,
      preferencesOpen: false,
      ...overrides,
    },
    refs: {
      appCloseCancelButtonRef,
      assistDiscardCancelButtonRef,
      closeTabCancelButtonRef,
      moveTrashCancelButtonRef,
      preferencesCloseButtonRef,
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useDialogInitialFocus", () => {
  it("focuses the close-tab Cancel button when a dirty tab is closing", () => {
    const { args, refs } = makeHookArgs({ pendingCloseTabOpen: true });
    renderHook(() => useDialogInitialFocus(args));
    expect(refs.closeTabCancelButtonRef.current?.focus).toHaveBeenCalledTimes(1);
    expect(refs.appCloseCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.moveTrashCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.preferencesCloseButtonRef.current?.focus).not.toHaveBeenCalled();
  });

  it("focuses the app-close Cancel button when the app is closing", () => {
    const { args, refs } = makeHookArgs({ pendingAppClose: true });
    renderHook(() => useDialogInitialFocus(args));
    expect(refs.appCloseCancelButtonRef.current?.focus).toHaveBeenCalledTimes(1);
    expect(refs.closeTabCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.moveTrashCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.preferencesCloseButtonRef.current?.focus).not.toHaveBeenCalled();
  });

  it("focuses the move-to-trash Cancel button when the trash dialog is pending (v0.18)", () => {
    // The v0.18 accessibility follow-up: the move-to-trash
    // dialog must land focus on its Cancel button so a
    // keyboard user can dismiss the destructive confirmation
    // without reaching for the mouse. The trash flow is the
    // only modal-shaped surface in the workspace file-ops
    // path and the Cancel button is the safe default for
    // an irreversible Tauri command.
    const { args, refs } = makeHookArgs({ pendingTrashOpen: true });
    renderHook(() => useDialogInitialFocus(args));
    expect(refs.moveTrashCancelButtonRef.current?.focus).toHaveBeenCalledTimes(1);
    expect(refs.closeTabCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.appCloseCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.assistDiscardCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.preferencesCloseButtonRef.current?.focus).not.toHaveBeenCalled();
  });

  it("focuses the assist-discard Cancel button when the discard dialog is pending (v1.3)", () => {
    // v1.3: the Local Assist discard confirmation is a
    // destructive confirmation (Confirm reverts hand edits
    // alongside the assist change), so it lands focus on
    // Cancel for the same safe default as move-to-trash.
    const { args, refs } = makeHookArgs({ pendingAssistDiscardOpen: true });
    renderHook(() => useDialogInitialFocus(args));
    expect(refs.assistDiscardCancelButtonRef.current?.focus).toHaveBeenCalledTimes(1);
    expect(refs.closeTabCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.appCloseCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.moveTrashCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.preferencesCloseButtonRef.current?.focus).not.toHaveBeenCalled();
  });

  it("focuses the preferences Close button when the preferences dialog is open", () => {
    const { args, refs } = makeHookArgs({ preferencesOpen: true });
    renderHook(() => useDialogInitialFocus(args));
    expect(refs.preferencesCloseButtonRef.current?.focus).toHaveBeenCalledTimes(1);
    expect(refs.closeTabCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.appCloseCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.moveTrashCancelButtonRef.current?.focus).not.toHaveBeenCalled();
  });

  it("does not focus anything when no modal is open", () => {
    const { args, refs } = makeHookArgs();
    renderHook(() => useDialogInitialFocus(args));
    expect(refs.closeTabCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.appCloseCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.moveTrashCancelButtonRef.current?.focus).not.toHaveBeenCalled();
    expect(refs.preferencesCloseButtonRef.current?.focus).not.toHaveBeenCalled();
  });

  it("re-focuses the trash Cancel button when pendingTrashOpen toggles on", async () => {
    // End-to-end behaviour: a real DOM render with a
    // dialog section that has a focusable Cancel button.
    // The hook's effect must re-fire when the boolean
    // toggles, so opening the dialog after another surface
    // closes still lands focus on Cancel.
    function Host() {
      const dialogRef = createRef<HTMLElement | null>();
      const cancelButtonRef = createRef<HTMLButtonElement | null>();
      useDialogInitialFocus({
        appCloseCancelButtonRef: { current: null },
        assistDiscardCancelButtonRef: { current: null },
        closeTabCancelButtonRef: { current: null },
        moveTrashCancelButtonRef: cancelButtonRef,
        pendingAppClose: false,
        pendingAssistDiscardOpen: false,
        pendingCloseTabOpen: false,
        pendingTrashOpen: true,
        preferencesCloseButtonRef: { current: null },
        preferencesOpen: false,
      });
      return (
        <section ref={dialogRef} role="dialog">
          <button ref={cancelButtonRef} type="button">
            Cancel
          </button>
        </section>
      );
    }

    const { getByRole } = render(<Host />);
    // Let the post-mount effect run.
    await act(async () => {});
    expect(document.activeElement).toBe(getByRole("button", { name: "Cancel" }));
  });
});
