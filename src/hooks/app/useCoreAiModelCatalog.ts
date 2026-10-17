import { useCallback, useEffect, useRef, useState } from "react";
import {
  listenCoreAiModelStateChanges,
  listCoreAiModels,
  unavailableCoreAiModelCatalog,
  type CoreAiModelCatalog,
} from "../../lib/tauri/coreAiModels";
import { useTauriSubscription } from "./useTauriSubscription";

export function useCoreAiModelCatalog(onError?: (reason: unknown) => void) {
  const [catalog, setCatalog] = useState<CoreAiModelCatalog>(unavailableCoreAiModelCatalog);
  const mountedRef = useRef(true);
  const eventRevisionRef = useRef(0);
  const requestSerialRef = useRef(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const runCatalogRequest = useCallback(async (request: () => Promise<CoreAiModelCatalog>) => {
    const serial = ++requestSerialRef.current;
    const observedEventRevision = eventRevisionRef.current;
    const next = await request();
    if (mountedRef.current
      && serial === requestSerialRef.current
      && observedEventRevision === eventRevisionRef.current) {
      setCatalog(next);
    }
    return next;
  }, []);

  const refreshCatalog = useCallback(
    () => runCatalogRequest(listCoreAiModels),
    [runCatalogRequest],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSerialRef.current += 1;
    };
  }, [refreshCatalog]);

  // Subscription first, then the initial refresh — the original effect awaited
  // the listener registration before fetching, so keep that order.
  useTauriSubscription(
    (isCancelled) =>
      listenCoreAiModelStateChanges((next) => {
        eventRevisionRef.current += 1;
        if (!isCancelled()) setCatalog(next);
      })
        // A failed subscription still falls back to the snapshot refresh.
        .catch((reason) => {
          console.warn("Failed to listen for Core AI model state", reason);
          return null;
        })
        .then((stop) => {
          if (!isCancelled()) {
            void refreshCatalog().catch((reason) => {
              if (!isCancelled()) onErrorRef.current?.(reason);
            });
          }
          return stop;
        }),
    [refreshCatalog],
  );

  return { catalog, refreshCatalog, runCatalogRequest };
}
