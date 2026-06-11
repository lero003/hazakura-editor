import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import { openImageFile, openWorkspaceImage } from "../../lib/tauri";
import type { CompareViewState, EditorTab, ImagePreviewState } from "../../types";

type UseImagePreviewOptions = {
  activeTabId: string | null;
  onError: (message: string | null) => void;
  onStatus: (message: string) => void;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setCompareView: Dispatch<SetStateAction<CompareViewState | null>>;
  tabs: EditorTab[];
  workspaceRootPath: string | null;
};

export function useImagePreview({
  activeTabId,
  onError,
  onStatus,
  setActiveTabId,
  setCompareView,
  tabs,
  workspaceRootPath,
}: UseImagePreviewOptions) {
  const [selectedImage, setSelectedImage] = useState<ImagePreviewState | null>(
    null,
  );
  const [imageReturnTabId, setImageReturnTabId] = useState<string | null>(null);
  const previewRequestSeqRef = useRef(0);

  const clearImagePreview = useCallback(() => {
    previewRequestSeqRef.current += 1;
    setSelectedImage(null);
    setImageReturnTabId(null);
  }, []);

  const openImagePreview = useCallback(
    async (path: string) => {
      onError(null);
      onStatus("Opening image preview...");
      const requestSeq = previewRequestSeqRef.current + 1;
      previewRequestSeqRef.current = requestSeq;

      try {
        const image = workspaceRootPath
          ? await openWorkspaceImage(workspaceRootPath, path)
          : await openImageFile(path);
        if (previewRequestSeqRef.current !== requestSeq) {
          return false;
        }

        setImageReturnTabId(activeTabId);
        setActiveTabId(null);
        setSelectedImage({
          path: image.path,
          name: image.name,
          url: image.dataUrl,
          size: image.size,
        });
        setCompareView(null);
        onStatus("Image preview opened");
        return true;
      } catch (err) {
        if (previewRequestSeqRef.current !== requestSeq) {
          return false;
        }
        onError(String(err));
        onStatus("Image preview failed");
        return false;
      }
    },
    [
      activeTabId,
      onError,
      onStatus,
      setActiveTabId,
      setCompareView,
      workspaceRootPath,
    ],
  );

  const closeSelectedImagePreview = useCallback(() => {
    const returnTab =
      imageReturnTabId !== null
        ? tabs.find((tab) => tab.id === imageReturnTabId)
        : null;

    clearImagePreview();
    setActiveTabId(returnTab?.id ?? tabs[0]?.id ?? null);
    onStatus("Image preview closed");
  }, [
    clearImagePreview,
    imageReturnTabId,
    onStatus,
    setActiveTabId,
    tabs,
  ]);

  return {
    clearImagePreview,
    closeSelectedImagePreview,
    imageReturnTabId,
    openImagePreview,
    selectedImage,
  };
}
