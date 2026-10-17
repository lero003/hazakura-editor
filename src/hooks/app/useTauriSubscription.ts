import { useEffect, type DependencyList } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

/**
 * Registers one Tauri event subscription for the lifetime of an effect.
 *
 * The listener boilerplate (`cancelled` flag, `unlisten` held in a closure,
 * release on cleanup) used to be hand-written in every listener hook. Keep the
 * subscribe call and its error handling at the call site; this hook only owns
 * the lifecycle:
 *
 * - the handle is stored when it resolves before cleanup,
 * - a handle that resolves after cleanup is released immediately,
 * - cleanup releases the stored handle once.
 *
 * `deps` are forwarded to `useEffect` unchanged, so re-subscription timing is
 * exactly what the call site declares (do not drop dependencies here).
 */
export function useTauriSubscription(
  subscribe: (isCancelled: () => boolean) => Promise<unknown> | unknown,
  deps: DependencyList,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let unlisten: UnlistenFn | null = null;
    const isCancelled = () => cancelled;

    void Promise.resolve(subscribe(isCancelled)).then((handle) => {
      if (typeof handle !== "function") {
        return;
      }
      const release = handle as UnlistenFn;
      if (cancelled) {
        void release();
        return;
      }
      unlisten = release;
    });

    return () => {
      cancelled = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
    // The call site owns the dependency list; see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
