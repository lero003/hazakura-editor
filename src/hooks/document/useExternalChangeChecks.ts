import { useEffect } from "react";
import { EXTERNAL_CHANGE_ACTIVE_POLL_MS } from "../../types";

type RefValue<T> = {
  current: T;
};

type UseExternalChangeChecksOptions = {
  activeAgentSession: boolean;
  activeTabId: string | null;
  agentUiSuspendedRef: RefValue<boolean>;
  onCheckTabForExternalChange: (tabId: string) => unknown;
};

export function useExternalChangeChecks({
  activeAgentSession,
  activeTabId,
  agentUiSuspendedRef,
  onCheckTabForExternalChange,
}: UseExternalChangeChecksOptions) {
  useEffect(() => {
    if (!activeTabId) {
      return;
    }

    void onCheckTabForExternalChange(activeTabId);
  }, [activeTabId, onCheckTabForExternalChange]);

  useEffect(() => {
    const checkActiveTab = () => {
      if (!activeTabId || document.visibilityState === "hidden") {
        return;
      }

      void onCheckTabForExternalChange(activeTabId);
    };

    window.addEventListener("focus", checkActiveTab);
    document.addEventListener("visibilitychange", checkActiveTab);

    return () => {
      window.removeEventListener("focus", checkActiveTab);
      document.removeEventListener("visibilitychange", checkActiveTab);
    };
  }, [activeTabId, onCheckTabForExternalChange]);

  useEffect(() => {
    if (!activeAgentSession || !activeTabId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (agentUiSuspendedRef.current) {
        return;
      }

      void onCheckTabForExternalChange(activeTabId);
    }, EXTERNAL_CHANGE_ACTIVE_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    activeAgentSession,
    activeTabId,
    agentUiSuspendedRef,
    onCheckTabForExternalChange,
  ]);
}
