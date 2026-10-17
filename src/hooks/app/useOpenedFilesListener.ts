import { listen } from "@tauri-apps/api/event";
import {
  drainOpenedFiles,
  isTauriRuntime,
  OPENED_FILES_EVENT,
} from "../../lib/tauri";
import { useTauriSubscription } from "./useTauriSubscription";

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
  useTauriSubscription(
    (isCancelled) => {
      if (!isTauriRuntime()) {
        return null;
      }

      const openPendingFiles = async () => {
        try {
          const paths = await drainOpenedFiles();

          if (!isCancelled() && paths.length > 0) {
            await onOpenFiles(paths);
          }
        } catch (err) {
          if (!isCancelled()) {
            onError(String(err));
            onStatus("Open failed");
          }
        }
      };

      void openPendingFiles();

      return listen<string[]>(OPENED_FILES_EVENT, () => {
        void openPendingFiles();
      });
    },
    [enabled, onError, onOpenFiles, onStatus],
    { enabled },
  );
}
