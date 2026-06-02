import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getMainActiveWorkspace,
} from "../../lib/tauri";
import { MAIN_WORKSPACE_CHANGED_EVENT } from "../../types";

// `useMainWindowWorkspace` is the agent window's bridge to the main
// window's active workspace. It reads the latest known value from
// the Rust-side `get_main_active_workspace` cache on mount, and
// subscribes to `MAIN_WORKSPACE_CHANGED_EVENT` for live updates
// when the main window opens / closes a workspace. Returns the
// latest known workspace path or `null`. The hook is intentionally
// thin — no caching layer beyond React state, no fallback polling —
// because the value only changes on user action in the main window
// and the event round-trip is sub-200 ms in practice.

type UseMainWindowWorkspaceResult = string | null;

export function useMainWindowWorkspace(): UseMainWindowWorkspaceResult {
  const [workspace, setWorkspace] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void getMainActiveWorkspace()
      .then((initial) => {
        if (disposed) {
          return;
        }
        setWorkspace(initial);
      })
      .catch((err) => {
        if (disposed) {
          return;
        }
        console.warn("Failed to read initial main workspace", err);
      });

    void listen<string | null>(MAIN_WORKSPACE_CHANGED_EVENT, (event) => {
      if (disposed) {
        return;
      }
      setWorkspace(event.payload ?? null);
    })
      .then((handle) => {
        if (disposed) {
          void handle();
          return;
        }
        unlisten = handle;
      })
      .catch((err) => {
        if (disposed) {
          return;
        }
        console.warn("Failed to subscribe to main workspace changes", err);
      });

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, []);

  return workspace;
}
