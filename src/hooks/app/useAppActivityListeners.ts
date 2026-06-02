import { useEffect } from "react";
import { isCommandKeyPressed } from "../../lib/keyboard";

type UseAppActivityListenersOptions = {
  onResumeAgentUiRefresh: () => void;
  onSuspendAgentUiRefresh: () => void;
  onToggleQuickOpen: () => void;
};

export function useAppActivityListeners({
  onResumeAgentUiRefresh,
  onSuspendAgentUiRefresh,
  onToggleQuickOpen,
}: UseAppActivityListenersOptions) {
  useEffect(() => {
    const handleQuickOpenKeyDown = (event: KeyboardEvent) => {
      // The `!event.shiftKey` guard is required so that
      // `Cmd+Shift+P` (Command Palette) does not also fire
      // Quick Open from this bubble-phase handler. The capture-
      // phase `useGlobalKeyboardShortcuts` already preventDefaults
      // the palette shortcut, but document-level handlers still
      // see the same event, and `event.defaultPrevented` would
      // be the wrong gate here because Cmd+P (Quick Open) is a
      // distinct shortcut that should still work when neither
      // the global handler nor any modal cares about it.
      if (
        isCommandKeyPressed(event) &&
        !event.shiftKey &&
        event.key === "p"
      ) {
        event.preventDefault();
        onToggleQuickOpen();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onResumeAgentUiRefresh();
      } else {
        onSuspendAgentUiRefresh();
      }
    };

    window.addEventListener("blur", onSuspendAgentUiRefresh);
    window.addEventListener("focus", onResumeAgentUiRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("keydown", handleQuickOpenKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", onResumeAgentUiRefresh);
      window.removeEventListener("blur", onSuspendAgentUiRefresh);
      document.removeEventListener("keydown", handleQuickOpenKeyDown);
    };
  }, [
    onResumeAgentUiRefresh,
    onSuspendAgentUiRefresh,
    onToggleQuickOpen,
  ]);
}
