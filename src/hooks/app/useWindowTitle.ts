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

  useEffect(() => {
    const appName = isDeveloperDistributionLane()
      ? "hazakura editor Dev"
      : "hazakura editor";
    const title = selectedImage
      ? `${selectedImage.name} - ${appName}`
      : activeTab
      ? `${activeTab.name}${activeDirty ? " *" : ""} - ${appName}`
      : appName;

    void setCurrentWindowTitle(title).catch((err) => {
      console.warn("Failed to update window title", err);
      onStatusRef.current?.("Failed to update window title");
    });
  }, [activeDirty, activeTab, selectedImage]);
}
