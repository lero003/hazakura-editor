import { useEffect } from "react";
import { updateThemeMenuState } from "../../lib/tauri";
import type { ThemePreference } from "../../types";

export function useThemeMenuStateSync(themePreference: ThemePreference) {
  useEffect(() => {
    void updateThemeMenuState(themePreference).catch((err) => {
      console.warn("Failed to update theme menu state", err);
    });
  }, [themePreference]);
}
