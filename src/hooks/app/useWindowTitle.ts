import { useEffect } from "react";
import { setCurrentWindowTitle } from "../../lib/tauri";
import { isDeveloperDistributionLane } from "../../lib/distributionLane";

type TitledDocument = {
  name: string;
};

type UseWindowTitleOptions = {
  activeDirty: boolean;
  activeTab: TitledDocument | null;
  selectedImage: TitledDocument | null;
};

export function useWindowTitle({
  activeDirty,
  activeTab,
  selectedImage,
}: UseWindowTitleOptions) {
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
    });
  }, [activeDirty, activeTab, selectedImage]);
}
