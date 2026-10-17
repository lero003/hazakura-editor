import { useEffect } from "react";

type Options = {
  enabled: boolean;
  refresh: () => Promise<void>;
  cancel: () => void;
};

/** Refresh directory metadata only while the workspace list is being used. */
export function useWorkspaceAutoRefresh({ enabled, refresh, cancel }: Options) {
  useEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }

    let interval: number | undefined;
    const check = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    const stop = () => {
      window.clearInterval(interval);
      interval = undefined;
    };
    const start = () => {
      stop();
      if (document.visibilityState !== "hidden") {
        interval = window.setInterval(check, 10_000);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
        cancel();
      } else {
        check();
        start();
      }
    };

    start();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      cancel();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cancel, enabled, refresh]);
}
