import { useEffect, useState } from "react";
import { probeAppleAssistAvailability, type AppleAssistAvailability } from "../../lib/tauri";

// `useAppleAssistAvailability` is the on-device counterpart to
// `useAgentProviderAvailability`. It is intentionally a single
// value rather than a list: Hazakura Local Assist is one provider
// (the on-device Foundation Models binding), so the React side
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
): UseAppleAssistAvailabilityResult {
  const [availability, setAvailability] = useState<AppleAssistAvailability>({
    kind: "unsupported",
  });
  const [probed, setProbed] = useState<boolean>(false);

  useEffect(() => {
    let disposed = false;

    if (!enabled) {
      setAvailability({ kind: "disabled" });
      setProbed(true);
      return () => {
        disposed = true;
      };
    }

    probeAppleAssistAvailability()
      .then((snapshot) => {
        if (!disposed) {
          setAvailability(snapshot);
          setProbed(true);
        }
      })
      .catch((err: unknown) => {
        console.warn("Failed to probe Hazakura Local Assist availability", err);
        if (!disposed) {
          const reason = err instanceof Error ? err.message : String(err);
          // IPC / parse / network failure: safest UX is
          // "unavailable with a reason" so the user understands
          // the feature is not working right now without us
          // claiming the platform is fundamentally unsupported.
          setAvailability({ kind: "unavailable", reason });
          setProbed(true);
        }
      });

    return () => {
      disposed = true;
    };
  }, [enabled]);

  return {
    availability,
    available: availability.kind === "available",
    probed,
  };
}
