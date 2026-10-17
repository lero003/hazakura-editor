import { getCurrentWebview } from "@tauri-apps/api/webview";
import { markdownPathForImportedImage } from "../../features/editor/markdownImageReferences";
import { importImageFromPath } from "../../lib/tauri/workspace";
import { isTauriRuntime } from "../../lib/tauri/_runtime";
import { useTauriSubscription } from "./useTauriSubscription";

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
  useTauriSubscription(
    (isCancelled) => {
      if (!isTauriRuntime()) {
        return null;
      }

      return getCurrentWebview()
        .onDragDropEvent(async (event) => {
          if (isCancelled()) {
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
                const markdownPath = markdownPathForImportedImage({
                  activeTabPath,
                  assetRelativePath: relativePath,
                  assetRootPath: rootForDrop,
                });

                onInsertMarkdown(`![](${markdownPath})`);
                onStatus(`Imported: ${markdownPath}`);
              } catch (err) {
                console.warn("Failed to import image:", imagePath, err);
                onStatus(`Failed to import image: ${String(err)}`);
              }
            }
          }
        })
        .catch((err) => {
          console.warn("Failed to listen for drag-drop events", err);
          onStatus(`Failed to listen for drag-drop events: ${String(err)}`);
        });
    },
    [
      activeTabPath,
      onInsertMarkdown,
      onOpenTextFiles,
      onStatus,
      workspaceRootPath,
    ],
  );
}
