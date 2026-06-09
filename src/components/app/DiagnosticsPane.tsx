// v0.17 diagnostics-ui slice.
//
// The pane is the user-facing surface for the existing
// `collectDiagnostics()` helper (see `lib/diagnostics.ts`
// and its tests). The helper is the only place data
// enters the snapshot, and it is paired with
// `assertNoForbiddenKeys()` so any future field that
// bleeds document contents, file paths, or secret-looking
// values fails the pane at the structural-check stage
// before the JSON is shown or copied.
//
// The shell mirrors the read-only Help-document chrome
// that `PrivacyPreferencesPane` already paints
// (kicker / boundary card / footer), so the diagnostics
// page reads as one more Help entry from the dialog
// wrapper's point of view. The body itself is not
// markdown — it is the JSON snapshot, a `Refresh` button
// to rebuild it, and a `Copy` button to put it on the
// clipboard. Both buttons are user-initiated; the pane
// has no telemetry, no network call, and no automatic
// upload path.
//
// The `onCopy` prop is optional so tests can capture the
// copied text without depending on `navigator.clipboard`,
// which is not implemented in the jsdom test
// environment. In production the prop is omitted and the
// pane uses the standard `navigator.clipboard.writeText`
// API with a `document.execCommand("copy")` fallback for
// older WebViews.

import { useCallback, useMemo, useState } from "react";
import { assertNoForbiddenKeys } from "../../lib/diagnostics";
import { renderMarkdown } from "../../features/editor/markdown";
import {
  injectHelpDocSectionAnchors,
  supportDiagnostics,
} from "./helpDocs";
import { useDiagnosticsSnapshot } from "../../hooks/app/useDiagnosticsSnapshot";

export type DiagnosticsPaneProps = {
  appleLocalAssistAvailable: boolean;
  autoBackupEnabled: boolean;
  lModeEnabled: boolean;
  wrapLines: boolean;
  theme: string;
  /**
   * Optional override used by tests to capture the
   * copied text without relying on `navigator.clipboard`
   * (which is not implemented in jsdom). In production
   * this prop is omitted and the pane uses the standard
   * clipboard API.
   */
  onCopy?: (text: string) => void;
  /**
   * Test-only escape hatch. When `true`, the pane forces
   * the safety check to throw so the unavailable-state
   * branch can be asserted. Never set in production.
   * The prop is namespaced with the `force` prefix so
   * future code review can spot accidental production
   * use at a glance.
   */
  forceSafetyCheckFailure?: boolean;
};

type CopyState = "idle" | "copied" | "failed";

export function DiagnosticsPane({
  appleLocalAssistAvailable,
  autoBackupEnabled,
  lModeEnabled,
  wrapLines,
  theme,
  onCopy,
  forceSafetyCheckFailure = false,
}: DiagnosticsPaneProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [refreshToken, setRefreshToken] = useState(0);

  // Re-derive the snapshot whenever the underlying
  // settings change OR the user explicitly asks for a
  // fresh snapshot via the Refresh button. The token
  // is intentionally not a timer; refresh is a
  // user-initiated action.
  const snapshot = useDiagnosticsSnapshot(
    {
      appleLocalAssistAvailable,
      autoBackupEnabled,
      lModeEnabled,
      wrapLines,
      theme,
    },
    refreshToken,
  );

  // Re-validate on every render so a future regression
  // in `collectDiagnostics()` that adds a forbidden key
  // surfaces as a console error (and a visible empty
  // body) instead of silently shipping sensitive data.
  // The helper throws; we wrap the call in a try/catch
  // so the pane degrades to a safe "snapshot unavailable"
  // message rather than a hard crash.
  const safeSnapshot = useMemo(() => {
    try {
      if (forceSafetyCheckFailure) {
        throw new Error("forced safety check failure");
      }
      assertNoForbiddenKeys(snapshot);
      return { ok: true as const, snapshot };
    } catch (err) {
      console.error("diagnostics snapshot failed safety check", err);
      return { ok: false as const, snapshot: null };
    }
  }, [snapshot, forceSafetyCheckFailure]);

  const json = useMemo(() => {
    if (!safeSnapshot.ok) return "";
    return JSON.stringify(safeSnapshot.snapshot, null, 2);
  }, [safeSnapshot]);

  const introHtml = useMemo(
    () =>
      injectHelpDocSectionAnchors(
        renderMarkdown(supportDiagnostics.source),
        supportDiagnostics.sections,
      ),
    [],
  );

  const handleCopy = useCallback(async () => {
    if (!json) return;
    let copied = false;
    if (onCopy) {
      try {
        onCopy(json);
        copied = true;
      } catch {
        copied = false;
      }
    } else if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      try {
        await navigator.clipboard.writeText(json);
        copied = true;
      } catch {
        copied = false;
      }
    } else if (typeof document !== "undefined") {
      // Last-resort fallback for older WebViews. Wrap
      // the JSON in a throwaway textarea, select it, and
      // run the deprecated `document.execCommand("copy")`
      // synchronously. This is intentionally the third
      // path; modern macOS WebKit supports the async
      // Clipboard API.
      const textarea = document.createElement("textarea");
      textarea.value = json;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
      document.body.removeChild(textarea);
    }

    setCopyState(copied ? "copied" : "failed");
  }, [json, onCopy]);

  const handleRefresh = useCallback(() => {
    setCopyState("idle");
    setRefreshToken((token) => token + 1);
  }, []);

  return (
    <div className="privacy-preferences">
      <div className="privacy-preferences-meta">
        <p
          className="privacy-preferences-kicker"
          data-testid="help-doc-kicker"
        >
          {supportDiagnostics.kicker}
        </p>
        <aside
          aria-label={supportDiagnostics.boundaryNoteTitle}
          className="privacy-boundary-note"
          data-testid="help-doc-boundary-note"
        >
          <p className="privacy-boundary-note-title">
            {supportDiagnostics.boundaryNoteTitle}
          </p>
          <p className="privacy-boundary-note-body">
            {supportDiagnostics.boundaryNoteBody}
          </p>
        </aside>
      </div>
      <div className="privacy-tab-panel-scroll">
        <article
          aria-label={supportDiagnostics.title}
          className="help-doc diagnostics-help-intro"
          data-testid="help-doc-body"
          dangerouslySetInnerHTML={{ __html: introHtml }}
        />
        <div
          className="diagnostics-pane-actions"
          data-testid="diagnostics-pane-actions"
        >
          <button
            type="button"
            className="diagnostics-pane-copy"
            data-testid="diagnostics-pane-copy"
            disabled={!safeSnapshot.ok}
            onClick={() => void handleCopy()}
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy"}
          </button>
          <button
            type="button"
            className="diagnostics-pane-refresh"
            data-testid="diagnostics-pane-refresh"
            disabled={!safeSnapshot.ok}
            onClick={handleRefresh}
          >
            Refresh
          </button>
        </div>
        <pre
          aria-label="Diagnostics JSON"
          className="diagnostics-pane-json"
          data-testid="diagnostics-pane-json"
        >
          {safeSnapshot.ok ? json : "Snapshot unavailable."}
        </pre>
      </div>
      <footer className="privacy-preferences-footer">
        <p
          className="privacy-preferences-footer-text"
          data-testid="help-doc-footer-note"
        >
          {supportDiagnostics.footerNote}
        </p>
      </footer>
    </div>
  );
}
