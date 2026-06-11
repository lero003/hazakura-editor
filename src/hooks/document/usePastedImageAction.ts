import { useCallback } from "react";
import { savePastedImage } from "../../lib/tauri";

type UsePastedImageActionOptions = {
  activeTabPath: string | null;
  setStatus: (message: string) => void;
  workspaceRootPath: string | null;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function usePastedImageAction({
  activeTabPath,
  setStatus,
  workspaceRootPath,
}: UsePastedImageActionOptions) {
  const handlePasteImage = useCallback(
    async (dataBase64: string, fileName: string) => {
      const rootForPaste =
        workspaceRootPath ??
        (activeTabPath ? activeTabPath.replace(/\/[^/]+$/, "") : null);

      if (!rootForPaste) {
        setStatus("Open a folder first to enable image paste");
        return null;
      }

      setStatus("Saving pasted image...");
      try {
        const result = await savePastedImage(rootForPaste, dataBase64, fileName);
        setStatus(`Image saved: ${result}`);
        return result;
      } catch (err) {
        console.warn("Failed to save pasted image", err);
        setStatus(`Image paste failed: ${errorMessage(err)}`);
        return null;
      }
    },
    [activeTabPath, setStatus, workspaceRootPath],
  );

  return {
    handlePasteImage,
  };
}
