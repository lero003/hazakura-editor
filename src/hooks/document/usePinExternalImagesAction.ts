/**
 * Theme G M4 — explicit pin of external Markdown image refs into workspace assets.
 * Always user-initiated; marks dirty via one CodeMirror transaction (Undo-able).
 */

import { useCallback, type RefObject } from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { pinExternalImagesToAssets } from "../../features/editor/pinExternalImagesToAssets";
import { listPinableImageReferences } from "../../features/editor/pinExternalImages";
import type { MediaImageAccessOptions } from "../../features/editor/imagePolicy";
import {
  assertTabEditable,
} from "../../features/editor/appleAssistEditGuard";
import {
  confirmPinRemoteImages,
  fetchRemoteImage,
  importImageFromPath,
  savePastedImage,
} from "../../lib/tauri";
import type { AppleAssistGenerationLock, EditorTab } from "../../types";
import type { MenuLanguage } from "../../types";
import { getPinRemoteConfirmationCopy } from "../../lib/locale/commandPalette";

type UsePinExternalImagesActionOptions = {
  activeTab: EditorTab | null;
  appleAssistGenerationLock?: AppleAssistGenerationLock | null;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  mediaAccess?: MediaImageAccessOptions | null;
  menuLanguage?: MenuLanguage;
  setStatus: (message: string) => void;
  workspaceRootPath: string | null;
};

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    return dataUrl;
  }
  return dataUrl.slice(comma + 1);
}

export function usePinExternalImagesAction({
  activeTab,
  appleAssistGenerationLock = null,
  editorPaneRef,
  mediaAccess = null,
  menuLanguage = "en",
  setStatus,
  workspaceRootPath,
}: UsePinExternalImagesActionOptions) {
  const pinExternalImages = useCallback(async () => {
    if (!activeTab) {
      setStatus("No active document to pin images");
      return;
    }
    if (!workspaceRootPath) {
      setStatus("Open a workspace folder first to pin images");
      return;
    }

    const editability = assertTabEditable(appleAssistGenerationLock, {
      id: activeTab.id,
      path: activeTab.path,
    });
    if (!editability.editable) {
      setStatus(editability.statusMessage);
      return;
    }

    const source =
      editorPaneRef.current?.getActiveDocument()?.text ?? activeTab.contents;
    if (!source.trim()) {
      setStatus("No image references to pin");
      return;
    }

    const requiresRemoteConfirmation =
      !mediaAccess?.loadRemoteImages &&
      listPinableImageReferences(source).some((reference) =>
        /^https:\/\//i.test(reference.src),
      );
    if (
      requiresRemoteConfirmation &&
      !(await confirmPinRemoteImages(getPinRemoteConfirmationCopy(menuLanguage)))
    ) {
      setStatus("Image pin cancelled");
      return;
    }

    setStatus("Pinning external images into assets…");
    try {
      const result = await pinExternalImagesToAssets(source, {
        documentPath: activeTab.path,
        workspaceRoot: workspaceRootPath,
        mediaAccess,
        importLocalImage: async (absoluteSourcePath) =>
          importImageFromPath(workspaceRootPath, absoluteSourcePath),
        importRemoteImageDataUrl: async (url) => {
          const image = await fetchRemoteImage(url);
          return image.dataUrl;
        },
        saveDataUrlToAssets: async (dataUrl, preferredName) => {
          const base64 = dataUrlToBase64(dataUrl);
          return savePastedImage(workspaceRootPath, base64, preferredName);
        },
      });

      if (result.pinnedCount === 0) {
        const detail =
          result.warnings.length > 0
            ? ` (${result.warnings[0]})`
            : result.skippedCount > 0
              ? ` (${result.skippedCount} skipped)`
              : "";
        setStatus(`No external images were pinned${detail}`);
        return;
      }

      if (result.nextSource === source) {
        setStatus("Pin finished without source changes");
        return;
      }

      const applied =
        editorPaneRef.current?.replaceDocumentContents(result.nextSource) ??
        false;
      if (!applied) {
        setStatus(
          "Could not apply image pin (read-only, IME, or editor unavailable)",
        );
        return;
      }

      const warn =
        result.warnings.length > 0
          ? ` · ${result.warnings.length} warning(s)`
          : "";
      setStatus(
        `Pinned ${result.pinnedCount} image(s) into assets${
          result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ""
        }${warn} — save to keep on disk`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Image pin failed: ${message}`);
    }
  }, [
    activeTab,
    appleAssistGenerationLock,
    editorPaneRef,
    mediaAccess,
    menuLanguage,
    setStatus,
    workspaceRootPath,
  ]);

  return { pinExternalImages };
}
