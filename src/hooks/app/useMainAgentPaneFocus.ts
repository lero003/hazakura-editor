import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../../lib/tauri";
import { OPEN_MAIN_AGENT_PANE_EVENT } from "../../types";

// Reverse-link listener: the detached Agent window fires
// OPEN_MAIN_AGENT_PANE_EVENT when the user clicks the footer's
// "Show in main pane" button. The main window subscribes here and
// invokes `onOpen` so its right pane flips to Agent. See the slice
// plan in docs/current-status.md and the Rust command in
// src-tauri/src/lib.rs (open_main_agent_pane, main|agent gate).
type UseMainAgentPaneFocusOptions = {
  onOpen: () => void;
};

export function useMainAgentPaneFocus({ onOpen }: UseMainAgentPaneFocusOptions) {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen(OPEN_MAIN_AGENT_PANE_EVENT, () => {
      onOpen();
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }

        unlisten = cleanup;
      })
      .catch((err) => {
        console.warn("Failed to listen for main agent pane focus event", err);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onOpen]);
}
