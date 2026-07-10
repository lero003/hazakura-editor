import { useEffect, useRef } from "react";
import type { ReferenceCompareState } from "../../features/referenceCompare/types";
import { getReferenceFileMetadata } from "../../lib/tauri";

const POLL_INTERVAL_MS = 4_000;

type UseReferenceExternalChangeOptions = {
  referenceCompare: ReferenceCompareState | null;
  onExternalChange: () => void;
};

/**
 * Poll disk fingerprint for the open reference. Never auto-reloads;
 * only notifies so the user can explicitly reload (design R2).
 *
 * Uses regular-file metadata so PDF/image binaries are not rejected.
 * Missing / unreadable paths also surface as an external-change notice.
 */
export function useReferenceExternalChange({
  referenceCompare,
  onExternalChange,
}: UseReferenceExternalChangeOptions) {
  const onExternalChangeRef = useRef(onExternalChange);
  onExternalChangeRef.current = onExternalChange;

  const path = referenceCompare?.reference.path ?? null;
  const fingerprint = referenceCompare?.sourceFingerprint ?? null;
  const alreadyPending = referenceCompare?.externalChangePending ?? false;

  useEffect(() => {
    // Need a path. Fingerprint is preferred; without it we still poll for
    // disappearance / unreadable (bounded failure → notify).
    if (!path || alreadyPending) {
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const meta = await getReferenceFileMetadata(path);
        if (cancelled) return;
        if (fingerprint && meta.fingerprint !== fingerprint) {
          onExternalChangeRef.current();
        }
      } catch {
        if (cancelled) return;
        // Deletion, permission loss, or type/size rejection: notify explicitly.
        onExternalChangeRef.current();
      }
    };

    void check();
    const timer = window.setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);

    const onFocus = () => {
      void check();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [path, fingerprint, alreadyPending]);
}
