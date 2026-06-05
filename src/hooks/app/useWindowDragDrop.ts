import { useEffect } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { importImageFromPath, isTauriRuntime } from "../../lib/tauri";

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp)$/i;

type UseWindowDragDropOptions = {
  activeTabPath: string | null;
  onInsertMarkdown: (markdown: string) => void;
  onOpenTextFiles: (paths: string[]) => Promise<void>;
  onStatus: (message: string) => void;
  workspaceRootPath: string | null;
};

export function splitDroppedPaths(paths: string[]): {
  imageFiles: string[];
  textFiles: string[];
} {
  const imageFiles = paths.filter((path) => IMAGE_FILE_PATTERN.test(path));
  const textFiles = paths.filter((path) => !IMAGE_FILE_PATTERN.test(path));

  return { imageFiles, textFiles };
}

export function useWindowDragDrop({
  activeTabPath,
  onInsertMarkdown,
  onOpenTextFiles,
  onStatus,
  workspaceRootPath,
}: UseWindowDragDropOptions) {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    void getCurrentWebview()
      .onDragDropEvent(async (event) => {
        if (cancelled) {
          return;
        }

        const payload = event.payload;

        if (payload.type !== "drop") {
          return;
        }

        const { imageFiles, textFiles } = splitDroppedPaths(payload.paths);

        if (textFiles.length === 1) {
          await onOpenTextFiles(textFiles);
        } else if (textFiles.length > 1) {
          await onOpenTextFiles([textFiles[0]]);
        }

        const rootForDrop =
          workspaceRootPath ??
          (activeTabPath ? activeTabPath.replace(/\/[^/]+$/, "") : null);

        if (imageFiles.length > 0 && rootForDrop) {
          for (const imagePath of imageFiles) {
            try {
              const relativePath = await importImageFromPath(
                rootForDrop,
                imagePath,
              );

              onInsertMarkdown(`![](${relativePath})`);
              onStatus(`Imported: ${relativePath}`);
            } catch (err) {
              console.warn("Failed to import image:", imagePath, err);
              onStatus(`Failed to import image: ${String(err)}`);
            }
          }
        }
      })
      .then((nextUnlisten) => {
        if (!cancelled) {
          unlisten = nextUnlisten;
          return;
        }

        nextUnlisten();
      })
      .catch((err) => {
        console.warn("Failed to listen for drag-drop events", err);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [
    activeTabPath,
    onInsertMarkdown,
    onOpenTextFiles,
    onStatus,
    workspaceRootPath,
  ]);
}
