import { useEffect, useRef } from "react";
import { updateThemeMenuState } from "../../lib/tauri";
import type { ThemePreference } from "../../types";

type UseThemeMenuStateSyncOptions = {
  onStatus?: (message: string) => void;
};

export function useThemeMenuStateSync(
  themePreference: ThemePreference,
  options: UseThemeMenuStateSyncOptions = {},
) {
  const onStatusRef = useRef(options.onStatus);

  useEffect(() => {
    onStatusRef.current = options.onStatus;
  }, [options.onStatus]);

  useEffect(() => {
    void updateThemeMenuState(themePreference).catch((err) => {
      console.warn("Failed to update theme menu state", err);
      onStatusRef.current?.("Failed to update theme menu state");
    });
  }, [themePreference]);
}
