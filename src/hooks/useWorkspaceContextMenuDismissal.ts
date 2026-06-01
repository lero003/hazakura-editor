import { useEffect } from "react";

type UseWorkspaceContextMenuDismissalOptions = {
  enabled: boolean;
  onClose: () => void;
};

export function useWorkspaceContextMenuDismissal({
  enabled,
  onClose,
}: UseWorkspaceContextMenuDismissalOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const closeMenuFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("click", onClose);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("keydown", closeMenuFromKeyboard, true);

    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("keydown", closeMenuFromKeyboard, true);
    };
  }, [enabled, onClose]);
}
