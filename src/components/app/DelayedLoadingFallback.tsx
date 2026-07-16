import { useEffect, useState } from "react";

type DelayedLoadingFallbackProps = {
  label: string;
  /** Avoid flashing on fast loads. Default 180ms. */
  delayMs?: number;
};

/**
 * Suspense fallback that stays blank briefly, then shows a polite status.
 * Does not use assertive live regions (avoids spam during quick loads).
 */
export function DelayedLoadingFallback({
  label,
  delayMs = 180,
}: DelayedLoadingFallbackProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pane-loading-fallback"
      role="status"
    >
      {label}
    </div>
  );
}
