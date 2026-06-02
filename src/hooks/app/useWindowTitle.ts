import { useEffect } from "react";
import { setCurrentWindowTitle } from "../../lib/tauri";

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
    const title = selectedImage
      ? `${selectedImage.name} - hazakura editor`
      : activeTab
      ? `${activeTab.name}${activeDirty ? " *" : ""} - hazakura editor`
      : "hazakura editor";

    void setCurrentWindowTitle(title).catch((err) => {
      console.warn("Failed to update window title", err);
    });
  }, [activeDirty, activeTab, selectedImage]);
}
