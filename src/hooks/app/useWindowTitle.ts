import { useEffect, useRef } from "react";
import { setCurrentWindowTitle } from "../../lib/tauri";
import { isDeveloperDistributionLane } from "../../lib/distributionLane";

type TitledDocument = {
  name: string;
};

type UseWindowTitleOptions = {
  activeDirty: boolean;
  activeTab: TitledDocument | null;
  selectedImage: TitledDocument | null;
  /**
   * Optional status callback. Used to surface the IPC
   * `setCurrentWindowTitle` failure through the existing
   * status bar instead of dropping it into the console
   * only. The status string goes through
   * `localizeStatusMessage`, so callers should pass the
   * raw English key.
   */
  onStatus?: (message: string) => void;
};

export function useWindowTitle({
  activeDirty,
  activeTab,
  selectedImage,
  onStatus,
}: UseWindowTitleOptions) {
  // Keep the latest `onStatus` callback in a ref so the
  // title-sync effect does not have to re-run every time the
  // caller passes a fresh function reference.
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  // Live editing replaces the tab object on every character, so build the
  // exact title string first and depend on that instead of the tab object.
  // Re-sending the same title makes macOS repaint the window chrome, which
  // the user sees as the title and menu bar blinking. Deriving the string
  // here also covers the image-preview case, where the title ignores the
  // active tab entirely.
  const appName = isDeveloperDistributionLane()
    ? "Hazakura Editor Dev"
    : "Hazakura Editor";
  const imageName = selectedImage?.name ?? null;
  const activeName = activeTab?.name ?? null;
  const title = imageName
    ? `${imageName} - ${appName}`
    : activeName
      ? `${activeName}${activeDirty ? " *" : ""} - ${appName}`
      : appName;

  useEffect(() => {
    void setCurrentWindowTitle(title).catch((err) => {
      console.warn("Failed to update window title", err);
      onStatusRef.current?.("Failed to update window title");
    });
  }, [title]);
}
