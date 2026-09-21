import { useCallback, useEffect, useRef, useState } from "react";
import {
  listenCoreAiModelStateChanges,
  listCoreAiModels,
  unavailableCoreAiModelCatalog,
  type CoreAiModelCatalog,
} from "../../lib/tauri/coreAiModels";

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
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const stop = await listenCoreAiModelStateChanges((next) => {
          eventRevisionRef.current += 1;
          if (!disposed) setCatalog(next);
        });
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
      } catch (reason) {
        console.warn("Failed to listen for Core AI model state", reason);
      }
      if (disposed) return;
      try {
        await refreshCatalog();
      } catch (reason) {
        if (!disposed) onErrorRef.current?.(reason);
      }
    })();
    return () => {
      disposed = true;
      mountedRef.current = false;
      requestSerialRef.current += 1;
      unlisten?.();
    };
  }, [refreshCatalog]);

  return { catalog, refreshCatalog, runCatalogRequest };
}
