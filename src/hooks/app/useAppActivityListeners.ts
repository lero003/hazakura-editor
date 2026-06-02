import { useEffect } from "react";
import { isCommandKeyPressed } from "../../keyboard";

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
      if (isCommandKeyPressed(event) && event.key === "p") {
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
