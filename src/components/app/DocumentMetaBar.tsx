import {
  EditingModeControl,
  RightPaneToggleControls,
  type RightPaneToggleCopy,
} from "./RightPaneToggleControls";
import { AgentWindowIcon, SparklesIcon } from "./Icons";
import type { AssistSurfacePreference, EditorTab } from "../../types";
import type { LModeCopy } from "../../lib/locale";
import type { AppleAssistAvailability } from "../../lib/tauri";
import { documentBreadcrumbParts } from "../../features/workspace/documentBreadcrumb";

type DocumentMetaBarProps = {
  showCompanion?: boolean;
  activeTab: EditorTab | null;
  agentWorkbenchAvailable: boolean;
  /** Current on-device Assist probe result. Used for honest button titles. */
  appleAssistAvailability?: AppleAssistAvailability;
  /** Whether the result came from an explicit completed probe. */
  appleAssistAvailabilityProbed?: boolean;
  assistSurfaceActive: AssistSurfacePreference;
  diffPaneActive: boolean;
  ebookPaneActive: boolean;
  ebookAvailable?: boolean;
  lModeCopy: LModeCopy;
  lModeEnabled: boolean;
  onOpenAgentWindow: () => void;
  onOpenAppleAssistWindow: () => void;
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
  sidePaneCopy: RightPaneToggleCopy;
};

export function DocumentMetaBar({
  showCompanion = true,
  activeTab,
  agentWorkbenchAvailable,
  appleAssistAvailability = { kind: "unsupported" },
  appleAssistAvailabilityProbed = true,
  assistSurfaceActive,
  diffPaneActive,
  ebookPaneActive,
  ebookAvailable = activeTab !== null,
  lModeCopy,
  lModeEnabled,
  onOpenAgentWindow,
  onOpenAppleAssistWindow,
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
  sidePaneCopy,
}: DocumentMetaBarProps) {
  const showCompanionSection =
    showCompanion && !lModeEnabled &&
    (assistSurfaceActive === "apple-local" ||
      (assistSurfaceActive === "external-cli" && agentWorkbenchAvailable));
  const appleAssistTitle = appleAssistAvailabilityProbed
    ? appleAssistButtonTitle(
        sidePaneCopy.appleAssistWindowTitle,
        appleAssistAvailability,
        sidePaneCopy,
      )
    : sidePaneCopy.appleAssistWindowTitle;
  const companionCopy =
    assistSurfaceActive === "apple-local"
      ? {
          icon: <SparklesIcon />,
          label: sidePaneCopy.appleAssistWindow,
          title: appleAssistTitle,
          unavailable:
            appleAssistAvailabilityProbed &&
            appleAssistAvailability.kind !== "available",
          onClick: onOpenAppleAssistWindow,
        }
      : {
          icon: <AgentWindowIcon />,
          label: sidePaneCopy.agentWindow,
          title: sidePaneCopy.agentWindowTitle,
          unavailable: false,
          onClick: onOpenAgentWindow,
        };

  const documentBreadcrumb = documentBreadcrumbParts(activeTab?.path ?? null);

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
          {/* 画面02: いま開いている文書の場所。モード群の手前＝行の中央に置く（モック準拠）。
              未保存の文書では出さない。 */}
          {documentBreadcrumb.length > 0 ? (
            <>
              <section className="chrome-section" aria-label={activeTab?.path ?? ""}>
                <span className="document-breadcrumb" title={activeTab?.path ?? ""}>
                  {documentBreadcrumb.map((part, index) => (
                    <span className="document-breadcrumb-part" key={`${part}-${index}`}>
                      {index > 0 ? (
                        <span className="document-breadcrumb-sep" aria-hidden="true">
                          /
                        </span>
                      ) : null}
                      {part}
                    </span>
                  ))}
                </span>
              </section>
              <span className="chrome-divider" aria-hidden="true" />
            </>
          ) : null}
          <section className="chrome-section" aria-label={sidePaneCopy.sidePaneMode}>
            <RightPaneToggleControls
              copy={sidePaneCopy}
              diffActive={diffPaneActive}
              diffAvailable
              ebookActive={ebookPaneActive}
              ebookAvailable={ebookAvailable}
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
