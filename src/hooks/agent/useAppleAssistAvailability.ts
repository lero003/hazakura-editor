import { useEffect, useRef, useState } from "react";
import { probeAppleAssistAvailability, type AppleAssistAvailability } from "../../lib/tauri";
import { listenCoreAiModelStateChanges } from "../../lib/tauri/coreAiModels";

// The fixed Core AI test backend performs an eager model load so missing and
// unloadable resources fail during the probe. Keep this just beyond the
// native supervisor's 60 second Core AI budget; the System probe still ends
// at its native 10 second timeout.
const APPLE_ASSIST_PROBE_UI_TIMEOUT_MS = 65_000;
const BUSY_PROBE_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000] as const;

// `useAppleAssistAvailability` is the on-device counterpart to
// `useAgentProviderAvailability`. It is intentionally a single
// value rather than a list: Hazakura Local Assist is one provider
// (the native-selected on-device backend), so the React side
// only needs to know whether the feature is currently
// addressable from this runtime, and if not, why.
//
// The hook starts in `unsupported` (the safest default that
// hides the command palette entries) and only ever moves
// forward once the probe resolves. A probe error is treated as
// `unavailable` with a reason so the UI can show a clear
// "this didn't work" state instead of pretending the feature
// is fine. The four-state AppleAssistAvailability shape keeps
// the React layer free of "loading" branches.

export type UseAppleAssistAvailabilityResult = {
  availability: AppleAssistAvailability;
  available: boolean;
  /**
   * `true` once the availability probe has resolved
   * (either to a non-`unsupported` value, or back to
   * `unsupported` meaning the environment is genuinely
   * unsupported). The initial value is `false` so callers
   * can distinguish "probe in flight" from "probe settled
   * on `unsupported`". The Hazakura Local Assist operation-
   * feedback panel uses this to avoid leaving the panel
   * empty when the probe stays at `unsupported` because
   * the environment is unsupported.
   */
  probed: boolean;
};

export function useAppleAssistAvailability(
  enabled = true,
  refreshKey = 0,
  watchModelChanges = true,
): UseAppleAssistAvailabilityResult {
  const [availability, setAvailability] = useState<AppleAssistAvailability>({
    kind: "unsupported",
  });
  const [probed, setProbed] = useState<boolean>(false);
  const [modelRevision, setModelRevision] = useState(0);
  const currentAvailability = useRef(availability);
  currentAvailability.current = availability;

  useEffect(() => {
    if (!enabled || !watchModelChanges) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let selectedSignature: string | null = null;
    void listenCoreAiModelStateChanges((catalog) => {
      if (disposed) return;
      const selected = catalog.models.find((model) => model.id === catalog.selectedModelId);
      // Repeated progress for another download must not restart a potentially
      // expensive model load. Recheck when the selected identity, readiness,
      // or installed pack version changes.
      const signature = `${catalog.selectedModelId}:${selected?.status ?? "missing"}:${selected?.assetPackVersion ?? "none"}`;
      if (selectedSignature === signature) return;
      const previous = currentAvailability.current;
      selectedSignature = signature;
      if (previous.modelId === catalog.selectedModelId && selected?.kind === "system") return;
      setModelRevision((revision) => revision + 1);
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch((reason) => {
      console.warn("Failed to listen for Local Assist model changes", reason);
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled, watchModelChanges]);

  useEffect(() => {
    let disposed = false;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!enabled) {
      // `enabled` controls whether this hook may perform the explicit probe;
      // it is not itself a model-availability result. Keep the safe initial
      // state before the first probe, and retain a completed snapshot when the
      // settings surface closes. This avoids claiming that Local Assist is
      // disabled merely because background/startup probing is intentionally
      // off.
      return () => {
        disposed = true;
      };
    }

    // A previous model's successful probe does not establish availability of
    // the newly selected model. Keep requests gated until this probe settles.
    setAvailability({ kind: "unsupported" });
    setProbed(false);

    timeoutId = setTimeout(() => {
      if (disposed || settled) {
        return;
      }
      settled = true;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      setAvailability({
        kind: "unavailable",
        reason: "Hazakura Local Assist availability probe timed out.",
      });
      setProbed(true);
    }, APPLE_ASSIST_PROBE_UI_TIMEOUT_MS);

    const probe = (retryIndex: number) => {
      if (disposed || settled) return;
      probeAppleAssistAvailability()
        .then((snapshot) => {
          if (!disposed && !settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            setAvailability(snapshot);
            setProbed(true);
          }
        })
        .catch((err: unknown) => {
          if (disposed || settled) return;
          const reason = err instanceof Error ? err.message : String(err);
          // The main window and the companion can probe the same native helper
          // on startup. Its non-blocking lock reports busy while the first
          // probe is running; retry that transient condition without making
          // the user reselect a model. Other failures still surface at once.
          if (
            reason.startsWith("Local Assist is busy.")
          ) {
            retryTimeoutId = setTimeout(() => {
              retryTimeoutId = null;
              probe(retryIndex + 1);
            }, BUSY_PROBE_RETRY_DELAYS_MS[Math.min(retryIndex, BUSY_PROBE_RETRY_DELAYS_MS.length - 1)]);
            return;
          }
          console.warn("Failed to probe Hazakura Local Assist availability", err);
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          // IPC / parse / network failure: safest UX is
          // "unavailable with a reason" so the user understands
          // the feature is not working right now without us
          // claiming the platform is fundamentally unsupported.
          setAvailability({ kind: "unavailable", reason });
          setProbed(true);
        });
    };
    probe(0);

    return () => {
      disposed = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [enabled, refreshKey, modelRevision]);

  return {
    availability,
    available: availability.kind === "available",
    probed,
  };
}
