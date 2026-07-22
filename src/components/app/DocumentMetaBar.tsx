import {
  EditingModeControl,
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import { AgentWindowIcon, SparklesIcon } from "./Icons";
import type { AssistSurfacePreference, EditorTab } from "../../types";
import type { LModeCopy } from "../../lib/locale";
import type { AppleAssistAvailability } from "../../lib/tauri";

type DocumentMetaBarProps = {
  activeDirty: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchAvailable: boolean;
  /** Current on-device Assist probe result. Used for honest button titles. */
  appleAssistAvailability?: AppleAssistAvailability;
  assistSurfaceActive: AssistSurfacePreference;
  diffPaneActive: boolean;
  ebookPaneActive: boolean;
  ebookAvailable?: boolean;
  lModeCopy: LModeCopy;
  lModeEnabled: boolean;
  onOpenAgentWindow: () => void;
  onOpenAppleAssistWindow: () => void;
  onReviewChanges: (tab: EditorTab) => void;
  onToggleDiff: () => void;
  onToggleEbook: () => void;
  onToggleLMode: () => void;
  onToggleOutline: () => void;
  onTogglePreview: () => void;
  onToggleReference: () => void;
  outlinePaneActive: boolean;
  previewPaneActive: boolean;
  referencePaneActive: boolean;
  /** Reference session loaded even when the column is hidden. */
  referenceLoaded?: boolean;
  recoveryReviewChangesLabel: string;
  sidePaneCopy: RightPaneToggleCopy;
};

export function DocumentMetaBar({
  activeDirty,
  activeTab,
  agentWorkbenchAvailable,
  appleAssistAvailability = { kind: "unsupported" },
  assistSurfaceActive,
  diffPaneActive,
  ebookPaneActive,
  ebookAvailable = activeTab !== null,
  lModeCopy,
  lModeEnabled,
  onOpenAgentWindow,
  onOpenAppleAssistWindow,
  onReviewChanges,
  onToggleDiff,
  onToggleEbook,
  onToggleLMode,
  onToggleOutline,
  onTogglePreview,
  onToggleReference,
  outlinePaneActive,
  previewPaneActive,
  referencePaneActive,
  referenceLoaded = false,
  recoveryReviewChangesLabel,
  sidePaneCopy,
}: DocumentMetaBarProps) {
  const showCompanionSection =
    !lModeEnabled &&
    (assistSurfaceActive === "apple-local" ||
      (assistSurfaceActive === "external-cli" && agentWorkbenchAvailable));
  const appleAssistTitle = appleAssistButtonTitle(
    sidePaneCopy.appleAssistWindowTitle,
    appleAssistAvailability,
    sidePaneCopy,
  );
  const companionCopy =
    assistSurfaceActive === "apple-local"
      ? {
          icon: <SparklesIcon />,
          label: sidePaneCopy.appleAssistWindow,
          title: appleAssistTitle,
          unavailable: appleAssistAvailability.kind !== "available",
          onClick: onOpenAppleAssistWindow,
        }
      : {
          icon: <AgentWindowIcon />,
          label: sidePaneCopy.agentWindow,
          title: sidePaneCopy.agentWindowTitle,
          unavailable: false,
          onClick: onOpenAgentWindow,
        };

  return (
    <div className="document-meta">
      {!lModeEnabled ? (
        <>
          <section className="chrome-section" aria-label={lModeCopy.paletteCommand}>
            <EditingModeControl
              active={lModeEnabled}
              label={lModeCopy.preferenceLabel}
              onToggle={onToggleLMode}
              title={lModeCopy.paletteCommand}
            />
          </section>
          <span className="chrome-divider" aria-hidden="true" />
          <section className="chrome-section" aria-label={sidePaneCopy.sidePaneMode}>
            <RightPaneToggleControls
              copy={sidePaneCopy}
              diffActive={diffPaneActive}
              diffAvailable
              ebookActive={ebookPaneActive}
              ebookAvailable={ebookAvailable}
              onReviewChanges={() => {
                if (activeTab) {
                  onReviewChanges(activeTab);
                }
              }}
              onToggleDiff={onToggleDiff}
              onToggleEbook={onToggleEbook}
              onToggleOutline={onToggleOutline}
              onTogglePreview={onTogglePreview}
              onToggleReference={onToggleReference}
              outlineActive={outlinePaneActive}
              outlineAvailable={activeTab !== null}
              previewActive={previewPaneActive}
              referenceActive={referencePaneActive}
              referenceLoaded={referenceLoaded}
              reviewChangesAvailable={activeDirty && activeTab !== null}
              reviewChangesLabel={recoveryReviewChangesLabel}
            />
          </section>
        </>
      ) : null}
      {showCompanionSection ? (
        <>
          <span className="chrome-divider" aria-hidden="true" />
          <section
            className="chrome-section chrome-section-right"
            aria-label={companionCopy.title}
          >
            <button
              aria-label={companionCopy.title}
              className={
                companionCopy.unavailable
                  ? "open-agent-window-button open-agent-window-button-unavailable"
                  : "open-agent-window-button"
              }
              onClick={companionCopy.onClick}
              title={companionCopy.title}
              type="button"
            >
              <span className="open-agent-window-icon" aria-hidden="true">
                {companionCopy.icon}
              </span>
              <span className="open-agent-window-caption">
                {companionCopy.label}
              </span>
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Surface a short reason on the chrome button without inventing a second status surface. */
export function appleAssistButtonTitle(
  openTitle: string,
  availability: AppleAssistAvailability,
  copy: Pick<
    RightPaneToggleCopy,
    "appleAssistUnavailableSession" | "appleAssistUnsupportedMac"
  >,
): string {
  if (availability.kind === "available") {
    return openTitle;
  }
  if (availability.kind === "unavailable") {
    return `${openTitle} — ${availability.reason}`;
  }
  if (availability.kind === "disabled") {
    return `${openTitle} — ${copy.appleAssistUnavailableSession}`;
  }
  return `${openTitle} — ${copy.appleAssistUnsupportedMac}`;
}
