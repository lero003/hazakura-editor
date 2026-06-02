import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  drainOpenedFiles,
  isTauriRuntime,
  OPENED_FILES_EVENT,
} from "../../tauri";

type UseOpenedFilesListenerOptions = {
  enabled: boolean;
  onError: (message: string) => void;
  onOpenFiles: (paths: string[]) => Promise<void>;
  onStatus: (message: string) => void;
};

export function useOpenedFilesListener({
  enabled,
  onError,
  onOpenFiles,
  onStatus,
}: UseOpenedFilesListenerOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!isTauriRuntime()) {
      return;
    }

    let cancelled = false;
    let unlisten: UnlistenFn | null = null;

    const openPendingFiles = async () => {
      try {
        const paths = await drainOpenedFiles();

        if (!cancelled && paths.length > 0) {
          await onOpenFiles(paths);
        }
      } catch (err) {
        if (!cancelled) {
          onError(String(err));
          onStatus("Open failed");
        }
      }
    };

    void openPendingFiles();

    void listen<string[]>(OPENED_FILES_EVENT, () => {
      void openPendingFiles();
    }).then((nextUnlisten) => {
      if (cancelled) {
        nextUnlisten();
        return;
      }

      unlisten = nextUnlisten;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enabled, onError, onOpenFiles, onStatus]);
}
