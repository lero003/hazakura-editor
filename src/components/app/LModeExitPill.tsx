import type { LModeCopy } from "../../lib/locale";

type LModeExitPillProps = {
  copy: LModeCopy;
  onExit: () => void;
};

// Fixed top-right pill that exits L Mode. The pill is rendered
// unconditionally in the AppShell; the CSS hides it unless
// `:root[data-l-mode="on"]` is set, so React doesn't need to
// know whether L Mode is active to render the affordance — the
// DOM is the single source of truth for visibility.
export function LModeExitPill({ copy, onExit }: LModeExitPillProps) {
  return (
    <button
      aria-label={copy.exitPillTitle}
      className="l-mode-exit-pill"
      onClick={onExit}
      title={copy.exitPillTitle}
      type="button"
    >
      {copy.exitPillLabel}
    </button>
  );
}
