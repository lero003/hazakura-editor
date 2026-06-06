import type { LModeCopy } from "../../lib/locale";
import { LModeClasses } from "../../features/editor/lMode";

type LModeExitPillProps = {
  copy: LModeCopy;
  onExit: () => void;
};

// Fixed top-right pill that exits L Mode. The pill is rendered
// unconditionally in the AppShell; the CSS hides it unless
// `:root[data-l-mode="on"]` is set, so React doesn't need to
// know whether L Mode is active to render the affordance — the
// DOM is the single source of truth for visibility.
//
// The pill is a small monogram ("L" inside a tinted circle) +
// a short label, sitting on a blurred surface. The mark is a
// visual echo of the same monogram used by the empty-document
// placeholder, so the chrome has a coherent identity.
export function LModeExitPill({ copy, onExit }: LModeExitPillProps) {
  return (
    <button
      aria-label={copy.exitPillTitle}
      className={`${LModeClasses.exitPill} lmode-surface`}
      onClick={onExit}
      title={copy.exitPillTitle}
      type="button"
    >
      <span className={LModeClasses.exitPillMonogram} aria-hidden="true">
        L
      </span>
      <span className={LModeClasses.exitPillLabel}>{copy.exitPillLabel}</span>
    </button>
  );
}
