import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getMainAppleAssistTarget,
  requestApplyAiEditTransaction,
  setAppleAssistWindowTheme,
  stopAppleAssistGeneration,
} from "../../lib/tauri";
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
import type { AppleAssistAvailability } from "../../lib/tauri/appleAssist";
import {
  buildApplyEvent,
  getLocalAssistAction,
  LOCAL_ASSIST_VISIBLE_PRESET_IDS,
  resolveLocalAssistActionId,
  type LocalAssistActionId,
  type LocalAssistPreset,
} from "../../lib/appleAssist/instruction";
import {
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
  MENU_LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type AppleAssistApplyEvent,
  type AppleAssistApplyStatusEvent,
  type AppleAssistTargetKind,
  type AppleAssistTargetSnapshot,
  type MenuLanguage,
  type ThemePreference,
} from "../../types";

// v0.12+ Hazakura Local Assist Writing Companion.
// `AppleAssistWindowApp` is the root of the detached
// `Hazakura Local Assist` window — the outside-companion slot
// that replaces the Agent window in the same UX surface
// (see `docs/apple-local-assist-writing-companion-plan.md`).
//
// The user picks a bounded request preset, edits the visible
// request text if needed, and clicks the request button to
// emit `APPLY_AI_EDIT_TRANSACTION_EVENT` to the main window.
// UI labels stay display-only; `actionId` only routes the
// helper operation while the request text remains visible and
// editable. The main window is responsible for:
//   - inferring the bounded target (selection → paragraph →
//     block → section) via `REQUEST_AI_EDIT_TARGET_EVENT` round
//     trip (slice 3),
//   - asking the bundled helper for a bounded result,
//   - applying document-changing results to the unsaved
//     buffer and recording an AI edit transaction,
//   - showing document-changing results in the Diff /
//     change-review escape hatch.
//
// The window only renders a thin shell with:
//   - a header that shows the local-assist disclosure and current
//     active document title (mirrored from the main window),
//   - a request textarea + preset chips for the supported
//     local writing actions.
//
// Status / error feedback is shown inline so the mock is
// usable end-to-end without depending on the agent
// workbench / provider surfaces.
//
// Companion-slot mutual exclusion is enforced server-side in
// `open_apple_assist_window` / `open_agent_window`: opening
// the Hazakura Local Assist window closes the Agent window, and vice
// versa. The mock itself does not need to coordinate the
// exclusion.
//
// v0.12.x copy enrichment: the original 3-language copy
// blocks were lean and most strings collapsed nuance into
// one short line. The `classifyApplyError` helper and the
// detailed `*Error` strings turn Rust / Foundation Models
// error messages into localized, actionable text so the
// user knows what to do next (shrink the selection, check
// Apple Intelligence, wait for throttling, etc.) instead of
// seeing a raw English string.

const APPLE_ASSIST_GENERATION_FALLBACK_MS = 2_000;

// v0.17 operation-feedback panel.
//
// The Assist Window keeps a short, current-session list of
// app-known lifecycle events. The list is in React window
// state only and is intentionally not persisted to disk,
// localStorage, logs, diagnostics, or Support Diagnostics.
//
// Keep enough in-memory entries for several short requests in one
// companion session while still bounding the React-only log. This is
// UI state only: it is not persisted, exported, or copied into
// diagnostics.
export const OPERATION_FEEDBACK_MAX_ENTRIES = 48;

export function scrollOperationFeedbackToEnd(element: HTMLElement | null): void {
  if (!element) {
    return;
  }
  element.scrollTop = element.scrollHeight;
}

export function createAppleAssistRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isApplyStatusForActiveRequest(
  activeRequestId: string | null,
  payload: AppleAssistApplyStatusEvent,
): boolean {
  return activeRequestId !== null && payload.requestId === activeRequestId;
}

export function useOperationFeedback() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  const pushFeedback = useCallback(
    (entry: { kind: OperationFeedbackKind; payload?: OperationFeedbackPayload }) => {
      setFeedback((current) => {
        const at = Date.now();
        const id = `${at}-${Math.random().toString(36).slice(2, 8)}`;
        // Defense-in-depth sanitizer: the `OperationFeedbackPayload`
        // type only allows `targetKind` and `targetChars`, but
        // the hook is exported (for testability) and a future
        // caller could spread a wider object. The sanitizer
        // below keeps only the two allowed fields so a stray
        // `target.text`, `target.label`, document name, file
        // path, or secret-looking value never reaches the
        // window state. The hook tests verify this behaviour
        // at runtime with a cast.
        const next: FeedbackEntry = {
          kind: entry.kind,
          payload: sanitizeOperationFeedbackPayload(entry.payload),
          id,
          at,
        };
        const updated = [...current, next];
        return updated.length > OPERATION_FEEDBACK_MAX_ENTRIES
          ? updated.slice(-OPERATION_FEEDBACK_MAX_ENTRIES)
          : updated;
      });
    },
    [],
  );

  const clearFeedback = useCallback(() => {
    setFeedback([]);
  }, []);

  return { feedback, pushFeedback, clearFeedback };
}

// Strict allow-list sanitizer. Anything outside
// `targetKind` / `targetChars` is dropped so a stray
// `text` / `label` / `path` / `documentName` field from
// a future refactor does not leak authoring content
// into the feedback trail.
function sanitizeOperationFeedbackPayload(
  payload?: OperationFeedbackPayload,
): OperationFeedbackPayload | undefined {
  if (!payload) {
    return undefined;
  }
  const cleaned: OperationFeedbackPayload = {};
  if (payload.targetKind !== undefined) {
    cleaned.targetKind = payload.targetKind;
  }
  if (
    typeof payload.targetChars === "number" &&
    Number.isFinite(payload.targetChars) &&
    payload.targetChars >= 0
  ) {
    cleaned.targetChars = payload.targetChars;
  }
  return cleaned;
}

type FeedbackEntry = {
  id: string;
  kind: OperationFeedbackKind;
  at: number;
  payload?: OperationFeedbackPayload;
};

function readInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  // migrate: v1.5 "sakura" → v1.6 "edohigan" (メイン窓の readStoredThemePreference
  // と同じ読み取り時変換)。メイン窓の effect が localStorage を上書きするまでの
  // 過渡期に、分離窓でも正しいテーマが適用されるようにする。
  const migrated = stored === "sakura" ? "edohigan" : stored;
  return (migrated as ThemePreference) ?? "dark";
}

function readInitialMenuLanguage(): MenuLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = window.localStorage.getItem(MENU_LANGUAGE_STORAGE_KEY);
  return isMenuLanguage(stored) ? stored : "en";
}

export function AppleAssistWindowApp() {
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);
  const [menuLanguage, setMenuLanguage] =
    useState<MenuLanguage>(readInitialMenuLanguage);
  const copy = useMemo(
    () => getAppleAssistWindowCopy(menuLanguage),
    [menuLanguage],
  );
  const [selectedActionId, setSelectedActionId] =
    useState<LocalAssistActionId | null>(null);
  const [requestText, setRequestText] = useState<string>("");
  const [status, setStatus] = useState<string>(
    () => getAppleAssistWindowCopy(readInitialMenuLanguage()).readyStatus,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  // True between the user clicking Cancel and the "cancelled" status
  // arriving. Disables the Cancel button so a user cannot fire
  // multiple stop commands in a row (the Rust path is idempotent, but
  // repeated clicks read as a stuck UI).
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [target, setTarget] = useState<AppleAssistTargetSnapshot | null>(null);
  const { availability, available, probed } = useAppleAssistAvailability();
  const { feedback, pushFeedback } = useOperationFeedback();
  const feedbackSectionRef = useRef<HTMLDivElement | null>(null);
  // Track whether the availability probe has been reported
  // to the feedback panel so we only push one "ready" /
  // "unavailable" entry, not one per availability re-emit.
  // The initial target snapshot is intentionally NOT
  // pushed to the panel; live target updates are
  // intentionally NOT pushed either — only the target
  // at the moment of apply is, so the trail stays
  // aligned with the IPC payload.
  const availabilityReportedRef = useRef<boolean>(false);
  const availabilityMessage = renderAvailabilityMessage(availability, copy);
  const generationFallbackRef = useRef<number | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const [streamPreview, setStreamPreview] = useState<string>("");

  useEffect(() => {
    activeRequestIdRef.current = activeRequestId;
  }, [activeRequestId]);

  const clearGenerationFallback = useCallback(() => {
    if (generationFallbackRef.current !== null) {
      window.clearTimeout(generationFallbackRef.current);
      generationFallbackRef.current = null;
    }
  }, []);

  const scheduleGenerationFallback = useCallback(() => {
    clearGenerationFallback();
    generationFallbackRef.current = window.setTimeout(() => {
      generationFallbackRef.current = null;
      setStatus(copy.longRunningStatus);
    }, APPLE_ASSIST_GENERATION_FALLBACK_MS);
  }, [clearGenerationFallback, copy.longRunningStatus]);

  useEffect(() => {
    scrollOperationFeedbackToEnd(feedbackSectionRef.current);
  }, [feedback.length]);

  // Apply theme to the Hazakura Local Assist window's document so the
  // CSS variable surface matches the main window. Mirrors the
  // detached Agent window's pattern. The `storage` event fires
  // only in OTHER windows, which is what we want — the Apple
  // Assist window never mutates the theme, so it just listens
  // for cross-window changes from the main window's theme
  // toggle.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = theme;
    void setAppleAssistWindowTheme(theme).catch((err) => {
      console.warn("Failed to update Hazakura Local Assist window OS theme", err);
    });
  }, [theme]);

  // v0.17 operation-feedback: when the availability probe
  // resolves, push exactly one "ready" or "unavailable"
  // entry. The `probed` flag is required so the panel
  // also reports "unavailable" when the probe settles
  // on `unsupported` (genuinely unsupported environment)
  // — `availability.kind === "unsupported"` alone is
  // ambiguous between "probe in flight" and "probe
  // settled on unsupported".
  useEffect(() => {
    if (availabilityReportedRef.current) {
      return;
    }
    if (!probed) {
      return;
    }
    if (availability.kind === "available") {
      pushFeedback({ kind: "ready" });
    } else {
      // `unavailable` / `disabled` / `unsupported` all
      // collapse to a single "unavailable" entry in the
      // panel; the disclosure still carries the more
      // specific copy.
      pushFeedback({ kind: "unavailable" });
    }
    availabilityReportedRef.current = true;
  }, [availability.kind, probed, pushFeedback]);

  // Note: the detached window's system close button relies on the
  // default Tauri close behavior — no `onCloseRequested` handler is
  // registered here. Stopping an in-flight Local Assist generation on
  // window close is handled on the Rust side (`on_window_event` in
  // `lib.rs`) so it does not depend on this window's JS event loop
  // and does not block the close.

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && event.newValue) {
        setTheme(event.newValue as ThemePreference);
      }
      if (event.key === MENU_LANGUAGE_STORAGE_KEY && isMenuLanguage(event.newValue)) {
        setMenuLanguage(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!isTauriEventAvailable()) {
      return;
    }
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void listen<AppleAssistApplyStatusEvent>(
      APPLE_ASSIST_APPLY_STATUS_EVENT,
      (event) => {
        if (disposed) {
          return;
        }
        const payload = event.payload;
        if (!isApplyStatusForActiveRequest(activeRequestIdRef.current, payload)) {
          return;
        }
        if (payload.phase === "started") {
          setBusy(true);
          setCancelling(false);
          setError(null);
          setStreamPreview("");
          setStatus(copy.generatingChange);
          pushFeedback({ kind: "generation-started" });
          scheduleGenerationFallback();
          return;
        }
        if (payload.phase === "partial") {
          setBusy(true);
          setError(null);
          setStreamPreview(payload.partialText ?? "");
          return;
        }
        clearGenerationFallback();
        setBusy(false);
        setCancelling(false);
        setActiveRequestId(null);
        activeRequestIdRef.current = null;
        setStreamPreview("");
        const presentation = getApplyStatusPresentation(payload, copy);
        setStatus(presentation.status);
        setError(presentation.error);
        pushFeedback({ kind: presentation.feedbackKind });
      },
    )
      .then((handle) => {
        if (disposed) {
          void handle();
          return;
        }
        unlisten = handle;
      })
      .catch((err) => {
        console.warn("Failed to listen for Hazakura Local Assist apply status", err);
        if (!disposed) {
          setError(copy.targetReadFailed);
        }
      });

    return () => {
      disposed = true;
      clearGenerationFallback();
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, [clearGenerationFallback, copy, scheduleGenerationFallback]);

  // Pull the initial target snapshot on mount and subscribe
  // to live updates from the main window. The cache is
  // authoritative (it survives main-window reloads within
  // the same Tauri process), and the event fan-out keeps
  // the target panel live as the user moves the cursor.
  useEffect(() => {
    if (!isTauriEventAvailable()) {
      return;
    }
    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    void getMainAppleAssistTarget()
      .then((initial) => {
        if (disposed) {
          return;
        }
        setTarget(initial);
        // The initial snapshot is shown in the header /
        // target summary area; the feedback panel waits
        // for the user's first apply so the panel entry
        // matches the target that was actually sent.
        // Live target updates are intentionally NOT
        // reported to the feedback panel — only the
        // target at the moment of apply is, to keep
        // the trail aligned with the IPC payload.
      })
      .catch((err) => {
        console.warn("Failed to read initial apple assist target", err);
        if (!disposed) {
          setError(copy.targetReadFailed);
        }
      });

    void listen<AppleAssistTargetSnapshot | null>(
      MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
      (event) => {
        if (disposed) {
          return;
        }
        setTarget(event.payload ?? null);
      },
    )
      .then((handle) => {
        if (disposed) {
          void handle();
          return;
        }
        unlisten = handle;
      })
      .catch((err) => {
        console.warn("Failed to listen for target changes", err);
        if (!disposed) {
          setError(copy.targetReadFailed);
        }
      });

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, []);

  const applyRoughRequest = useCallback(async () => {
    const request = requestText.trim();
    if (request.length === 0) {
      setError(copy.emptyRequestError);
      return;
    }
    if (!isTauriEventAvailable()) {
      setError(copy.tauriUnavailableError);
      return;
    }
    if (!available) {
      setError(availabilityMessage);
      return;
    }
    setBusy(true);
    setError(null);
    setStreamPreview("");
    setStatus(copy.sendingRequest);
    scheduleGenerationFallback();
    const requestId = createAppleAssistRequestId();
    setActiveRequestId(requestId);
    activeRequestIdRef.current = requestId;
    try {
      // Re-read the latest target snapshot at the moment of
      // apply — the cached one might be stale by a few
      // hundred ms. The main window is still free to
      // re-infer from its own state, but the payload
      // carries the user's expectation.
      const latestTarget =
        (await getMainAppleAssistTarget().catch(() => null)) ?? target;
      // v0.17 operation-feedback: report the target the
      // user is actually about to send to, *before* the
      // `request-sent` entry. The header / target summary
      // area may have drifted from the cached snapshot
      // (cursor / selection / document change) while the
      // window was open, so a "target-acquired" entry
      // pinned to the apply payload is the only way to
      // keep the feedback trail in sync with what the
      // main window actually received.
      if (latestTarget) {
        pushFeedback({
          kind: "target-acquired",
          payload: {
            targetKind: latestTarget.kind,
            targetChars: latestTarget.text.length,
          },
        });
      }
      pushFeedback({ kind: "request-sent" });
      // `buildApplyEvent` keeps the display label, fixed
      // `actionId`, and visible request text separate. The
      // helper maps the action id to a bounded operation while
      // the visible request text is passed as prompt data, not
      // system instruction.
      const payload = buildApplyEvent({
        requestId,
        actionId:
          selectedActionId ?? resolveLocalAssistActionId(request, copy.presets),
        requestText: request,
        target: latestTarget,
        requestedAtMs: Date.now(),
      });
      await requestApplyAiEditTransaction(payload);
      setStatus(copy.generatingInMain(payload.request));
    } catch (err: unknown) {
      clearGenerationFallback();
      setBusy(false);
      setActiveRequestId(null);
      activeRequestIdRef.current = null;
      setStreamPreview("");
      setError(classifyApplyError(err, copy));
      // Push a "failed" entry when the IPC call itself
      // throws. The status-event listener above also
      // pushes "failed" when the main window emits a
      // `failed` phase; in practice exactly one of the
      // two branches fires for a given apply, but a
      // double-fail can leave two "failed" entries in
      // the bounded session log. That is acceptable for
      // the feedback trail because both lines render the
      // same localized "failed" text and the panel keeps
      // its own fixed scroll area.
      pushFeedback({ kind: "failed" });
    }
  }, [
    available,
    availabilityMessage,
    clearGenerationFallback,
    copy,
    pushFeedback,
    requestText,
    scheduleGenerationFallback,
    selectedActionId,
    target,
  ]);

  const onPickPreset = useCallback((preset: LocalAssistPreset) => {
    setSelectedActionId(preset.actionId);
    setRequestText(preset.requestText);
    setError(null);
  }, []);

  // Cancel an in-flight generation. The Rust stop command kills the
  // helper child; the main window's apply handler then emits a
  // "cancelled" status that clears busy and the active request.
  // Until that status arrives, show a cancelling state so the user
  // sees the click registered.
  const cancelGeneration = useCallback(async () => {
    if (!busy || cancelling) {
      return;
    }
    setCancelling(true);
    setStatus(copy.cancellingStatus);
    try {
      await stopAppleAssistGeneration();
    } catch {
      // Best-effort: the status listener still clears busy when
      // the in-flight generation settles.
    }
  }, [busy, cancelling, copy.cancellingStatus]);
  const streamPreviewPresentation = getStreamPreviewPresentation(
    streamPreview,
    busy,
    copy,
  );

  return (
    <div className="apple-assist-window-shell" data-testid="apple-assist-shell">
      <header className="apple-assist-window-header">
        <div className="apple-assist-window-subtitle">
          {copy.subtitle}
          <span className="apple-assist-window-mode">{copy.modeLabel}</span>
        </div>
        <div className="apple-assist-window-disclosure">
          {available ? copy.availableDisclosure : availabilityMessage}
        </div>
        <div className="apple-assist-window-doc">
          {target?.activeDocumentName
            ? copy.activeDocument(target.activeDocumentName)
            : copy.noActiveDocument}
        </div>
        <div className="apple-assist-window-target" data-testid="apple-assist-target">
          {renderTargetSummary(target, copy)}
        </div>
      </header>

      <section className="apple-assist-window-form" aria-label={copy.roughRequestLabel}>
        <label
          htmlFor="apple-assist-rough-request"
          className="apple-assist-window-label"
        >
          {copy.roughRequestLabel}
        </label>
        <textarea
          id="apple-assist-rough-request"
          className="apple-assist-window-textarea"
          value={requestText}
          onChange={(event) => {
            setRequestText(event.target.value);
            setError(null);
          }}
          rows={3}
          placeholder={copy.placeholder}
          disabled={busy || !available}
        />
        <button
          type="button"
          className="apple-assist-window-apply"
          onClick={() => void applyRoughRequest()}
          disabled={busy || !available || requestText.trim().length === 0}
        >
          {busy ? copy.generatingButton : copy.applyButton}
        </button>
        <button
          type="button"
          className="apple-assist-window-cancel"
          onClick={() => void cancelGeneration()}
          disabled={!busy || cancelling}
        >
          {cancelling ? copy.cancellingStatus : copy.cancelButton}
        </button>
      </section>

      <section className="apple-assist-window-presets" aria-label={copy.presetsLabel}>
        <p className="apple-assist-presets-heading">{copy.presetsLabel}</p>
        <div className="apple-assist-presets-list">
          {copy.presets.map((preset) => (
            <button
              key={preset.actionId}
              type="button"
              className={
                preset.actionId === selectedActionId
                  && preset.requestText === requestText
                  ? "apple-assist-preset apple-assist-preset-active"
                  : "apple-assist-preset"
              }
              onClick={() => onPickPreset(preset)}
              disabled={busy || !available}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section
        className={`apple-assist-window-stream-preview apple-assist-window-stream-preview-${streamPreviewPresentation.kind}`}
        aria-label={copy.streamPreviewHeading}
        data-testid="apple-assist-stream-preview"
      >
        <p className="apple-assist-stream-preview-heading">
          {copy.streamPreviewHeading}
        </p>
        {streamPreviewPresentation.kind === "content" ? (
          <pre className="apple-assist-stream-preview-body">
            {streamPreviewPresentation.text}
          </pre>
        ) : (
          <p className="apple-assist-stream-preview-placeholder">
            {streamPreviewPresentation.text}
          </p>
        )}
      </section>

      <section
        className="apple-assist-window-feedback"
        aria-label={copy.feedbackHeading}
        data-testid="apple-assist-feedback-section"
      >
        <div className="apple-assist-feedback-header">
          <p
            className="apple-assist-feedback-heading"
            data-testid="apple-assist-feedback-heading"
            id="apple-assist-feedback-heading-id"
          >
            {copy.feedbackHeading}
          </p>
        </div>
        <div
          ref={feedbackSectionRef}
          className="apple-assist-feedback-body"
          aria-labelledby="apple-assist-feedback-heading-id"
          aria-live="polite"
          role="log"
        >
          {feedback.length === 0 ? (
            <p
              className="apple-assist-feedback-empty"
              data-testid="apple-assist-feedback-empty"
            >
              {copy.feedbackEmpty}
            </p>
          ) : (
            <ul
              className="apple-assist-feedback-list"
              data-testid="apple-assist-feedback-list"
            >
              {feedback.map((entry, index) => {
                const startsRequestGroup =
                  index > 0 &&
                  (entry.kind === "target-acquired" ||
                    (entry.kind === "request-sent" &&
                      feedback[index - 1]?.kind !== "target-acquired"));
                const className = [
                  "apple-assist-feedback-entry",
                  `apple-assist-feedback-entry-kind-${entry.kind}`,
                  startsRequestGroup
                    ? "apple-assist-feedback-entry-group-start"
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li
                    className={className}
                    data-feedback-kind={entry.kind}
                    data-testid="apple-assist-feedback-entry"
                    key={entry.id}
                  >
                    {copy.feedbackEntry(entry.kind, entry.payload)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <footer className="apple-assist-window-footer">
        {busy ? (
          <div className="apple-assist-window-progress" aria-hidden="true">
            <span className="apple-assist-window-spinner" />
            <span>{copy.workingLocally}</span>
          </div>
        ) : null}
        <div className="apple-assist-window-status">{status}</div>
        {error ? (
          <div className="apple-assist-window-error" role="alert">
            {error}
          </div>
        ) : null}
      </footer>
    </div>
  );
}

export type AppleAssistWindowCopy = {
  activeDocument: (name: string) => string;
  appliedStatus: (request: string) => string;
  applyButton: string;
  availableDisclosure: string;
  cancelButton: string;
  cancelledStatus: string;
  cancellingStatus: string;
  contextTooLongError: string;
  disabledStatus: string;
  emptyRequestError: string;
  generatingButton: string;
  generatingChange: string;
  generatingInMain: (request: string) => string;
  failedStatus: string;
  guardrailError: string;
  localRuntimeUnavailable: (reason: string) => string;
  longRunningStatus: string;
  modeLabel: string;
  noActiveDocument: string;
  noTarget: string;
  placeholder: string;
  presets: LocalAssistPreset[];
  presetsLabel: string;
  readyStatus: string;
  roughRequestLabel: string;
  selectionTooLongError: string;
  sendingRequest: string;
  subtitle: string;
  targetReadFailed: string;
  targetStaleError: string;
  tauriUnavailableError: string;
  targetBlock: (chars: number) => string;
  targetDocument: (chars: number) => string;
  targetLabel: (label: string) => string;
  targetParagraph: (chars: number) => string;
  targetSection: (chars: number) => string;
  targetSelection: (chars: number) => string;
  throttledError: string;
  unknownError: (raw: string) => string;
  unsupportedStatus: string;
  workingLocally: string;
  streamPreviewHeading: string;
  streamPreviewIdle: string;
  streamPreviewWaiting: string;
  // v0.17 operation-feedback panel. The panel shows app-
  // known lifecycle events (target acquired, request sent,
  // generation started, applied, failed, unavailable). It
  // intentionally never receives raw Foundation Models
  // prompts, raw model responses, hidden instructions,
  // provider transcripts, model reasoning, broad document
  // excerpts, filesystem paths, or secrets — see
  // docs/archive/operations/app-store-v0.17/apple-local-assist-operation-feedback-request.md.
  feedbackHeading: string;
  feedbackEmpty: string;
  feedbackEntry: (
    kind: OperationFeedbackKind,
    payload?: OperationFeedbackPayload,
  ) => string;
};

// Lifecycle event kinds for the v0.17 operation-feedback
// panel. The component keeps the list bounded, in window
// state only, and never persists entries to disk, logs,
// diagnostics, or Support Diagnostics.
export type OperationFeedbackKind =
  | "ready"
  | "target-acquired"
  | "request-sent"
  | "generation-started"
  | "applied"
  | "failed"
  | "unavailable";

// Payload fields for the operation-feedback panel. Only
// non-sensitive, non-document fields are allowed. The
// component does not pass `target.text`, `target.label`,
// or `activeDocumentName` through this payload because
// those are broad document excerpts or section labels and
// would leak authoring content into the feedback trail.
export type OperationFeedbackPayload = {
  targetKind?: AppleAssistTargetKind;
  targetChars?: number;
};

export type ApplyStatusPresentation = {
  status: string;
  error: string | null;
  feedbackKind: Extract<OperationFeedbackKind, "applied" | "failed">;
};

export function getApplyStatusPresentation(
  payload: AppleAssistApplyStatusEvent,
  copy: AppleAssistWindowCopy,
): ApplyStatusPresentation {
  if (payload.phase === "completed") {
    return {
      status: copy.appliedStatus(payload.request),
      error: null,
      feedbackKind: "applied",
    };
  }

  if (payload.phase === "cancelled") {
    return {
      status: copy.cancelledStatus,
      error: null,
      feedbackKind: "failed",
    };
  }

  return {
    status: copy.failedStatus,
    error: payload.message,
    feedbackKind: "failed",
  };
}

export type StreamPreviewPresentation = {
  kind: "content" | "placeholder";
  text: string;
};

export function getStreamPreviewPresentation(
  rawPreview: string,
  busy: boolean,
  copy: AppleAssistWindowCopy,
): StreamPreviewPresentation {
  const text = sanitizeStreamPreviewText(rawPreview);
  if (text.length > 0) {
    return { kind: "content", text };
  }
  return {
    kind: "placeholder",
    text: busy ? copy.streamPreviewWaiting : copy.streamPreviewIdle,
  };
}

function sanitizeStreamPreviewText(rawPreview: string): string {
  const trimmed = rawPreview.trim();
  if (!trimmed) {
    return "";
  }
  const boundaryPatterns = [
    /<<<HAZAKURA_TEXT_START\s*\n([\s\S]*?)\n?HAZAKURA_TEXT_END>>>/,
    /<<<HAZAKURA_CONTEXT_START\s*\n([\s\S]*?)\n?HAZAKURA_CONTEXT_END>>>/,
  ];

  for (const pattern of boundaryPatterns) {
    const inner = trimmed.match(pattern)?.[1]?.trim();
    if (inner) {
      return inner;
    }
  }

  const withoutBoundaryStart = trimmed
    .replace(/^<<<HAZAKURA_(TEXT|CONTEXT)_START\s*/u, "")
    .replace(/\s*HAZAKURA_(TEXT|CONTEXT)_END>>>$/u, "")
    .trim();
  if (!withoutBoundaryStart || /^<<<HAZAKURA_[A-Z_]+_START$/u.test(trimmed)) {
    return "";
  }
  return withoutBoundaryStart;
}

function renderAvailabilityMessage(
  availability: AppleAssistAvailability,
  copy: AppleAssistWindowCopy,
): string {
  if (availability.kind === "available") {
    return copy.availableDisclosure;
  }
  if (availability.kind === "unavailable") {
    return copy.localRuntimeUnavailable(availability.reason);
  }
  if (availability.kind === "disabled") {
    return copy.disabledStatus;
  }
  return copy.unsupportedStatus;
}

function isTauriEventAvailable(): boolean {
  return Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}

function renderTargetSummary(
  target: AppleAssistTargetSnapshot | null,
  copy: AppleAssistWindowCopy,
): string {
  if (!target) {
    return copy.noTarget;
  }
  if (target.kind === "selection") {
    return copy.targetSelection(target.text.length);
  }
  if (target.kind === "paragraph") {
    return copy.targetParagraph(target.text.length);
  }
  if (target.kind === "block") {
    return target.label
      ? copy.targetLabel(target.label)
      : copy.targetBlock(target.text.length);
  }
  if (target.kind === "section") {
    return target.label
      ? copy.targetLabel(target.label)
      : copy.targetSection(target.text.length);
  }
  return copy.targetDocument(target.text.length);
}

function isMenuLanguage(value: string | null): value is MenuLanguage {
  return value === "en" || value === "ja" || value === "kana";
}

function buildLocalAssistPresets(lang: MenuLanguage): LocalAssistPreset[] {
  return LOCAL_ASSIST_VISIBLE_PRESET_IDS.map((actionId) => {
    const action = getLocalAssistAction(actionId);
    return {
      actionId: action.id,
      label: action.label[lang],
      requestText: action.requestText,
    };
  });
}

// `classifyApplyError` turns a raw catch-block error from the
// `requestApplyAiEditTransaction` IPC call (or any exception
// thrown by the listener) into a localized, actionable
// message for the user. The Rust side returns English-only
// error strings, and the Foundation Models Swift helper
// emits English debug descriptions, so without this
// classification the user would see raw English text in a
// Japanese (or kana) Hazakura Local Assist window. The classifier
// matches on substrings, not on the exact string, because
// the helper wraps the original error in `Foundation
// Models generation failed: ...` and the Rust `validate_
// request` formats errors with template strings that may
// shift between versions.
export function classifyApplyError(
  err: unknown,
  copy: AppleAssistWindowCopy,
): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (
    raw.includes("Selected text exceeds") ||
    raw.includes("selected text exceeds")
  ) {
    return copy.selectionTooLongError;
  }
  if (
    raw.includes("Document context exceeds") ||
    raw.includes("document context exceeds") ||
    raw.includes("exceededContextWindowSize")
  ) {
    return copy.contextTooLongError;
  }
  if (raw.includes("stale") || raw.includes("no longer matches")) {
    return copy.targetStaleError;
  }
  if (raw.includes("guardrail") || raw.includes("refus")) {
    return copy.guardrailError;
  }
  if (raw.includes("rate") || raw.includes("concurrent")) {
    return copy.throttledError;
  }
  return copy.unknownError(raw);
}

export function getAppleAssistWindowCopy(lang: MenuLanguage): AppleAssistWindowCopy {
  if (lang === "kana") {
    return {
      activeDocument: (name) => `いまのふみ: ${name}`,
      appliedStatus: () =>
        "へんしゅう あんを はんえいしました。ほぞん まえに さぶんで かくにん できます。",
      applyButton: "おねがいする",
      cancelButton: "とりけす",
      cancelledStatus: "いらいを とりけしました。",
      cancellingStatus: "とりけし ちゅう...",
      availableDisclosure:
        "これは ぷれびゅーばんの ろーかる AI ぶんしょう しえんです。この Mac の Apple Intelligence たいおう きのうで ぶんしょうを ととのえますが、しゅつりょく ひんしつは あんてい しないことがあります。へんしゅう あんは ほぞん まえに さぶんで かくにんできます。そとの AI さーびすには おくりません。",
      contextTooLongError:
        "しゅうへん ぶんしょ が ながすぎ ます。L Mode の たいしょう しゅうへん こんできすと の じょうげん (8000 もじ) を こえました。",
      disabledStatus:
        "この せっしょんでは はざくら ろーかる あしす とは むこうです。あしすと せっていで はざくら ろーかる あしす と (ぷれびゅー) を えらび、あぷりを さいきどうして ください。",
      emptyRequestError:
        "まずは おねがいの ないようを かいてください。",
      generatingButton: "おねがい中...",
      generatingChange:
        "ろーかる もでるで しょり中。ほぞん まえに さぶんで かくにん できます。",
      generatingInMain: () =>
        "へんしゅう あんを つくっています。ほぞん まえに さぶんで かくにん できます。",
      failedStatus:
        "おねがいに しっぱいしました。下の めっせーじを みてください。",
      guardrailError:
        "あっぷる ふぁうんでーしょん もでるず が この おねがいを うけつけませんでした。べつの おねがいで さいしこう してください。",
      localRuntimeUnavailable: (reason) =>
        `はざくら ろーかる あしす とは つかえません: ${reason}。めやすは macOS 26 いこう、M1 いこうの Mac、あっぷる いんてりじぇんす の ゆうこうか、たいおう げんご / ちいき です。くわしくは あっぷる こうしき の Apple Intelligence あんないを かくにん してください。`,
      longRunningStatus:
        "はつかいや ながい ぶんでは すこし じかんが かかることがあります。",
      modeLabel: "ぷれびゅー",
      noActiveDocument:
        "めいん えでぃた に ひらいている ふみが ありません。Markdown / テキスト ふぁいる を ひらいて ください。",
      noTarget:
        "たいしょう が まだ えらばれて いません。えでぃた に かーそる を おくか、L Mode を ひらいて たいしょう を せってい して ください。",
      placeholder:
        "ここに おねがいの ないようを かいてください",
      presets: buildLocalAssistPresets("kana"),
      presetsLabel: "よくつかう おねがい",
      readyStatus:
        "じゅんび できました。よくつかう おねがいを えらぶか、おねがいの ないようを かいてください。",
      roughRequestLabel: "おねがいの ないよう",
      selectionTooLongError:
        "えらんだ ところが ながすぎ ます（さいだい 4000 もじ）。あっぷる ふぁうんでーしょん もでるず の こんできすと まど に おさまらないため、もう すこし ちいさく えらんで ください。",
      sendingRequest: "おねがいを うけつけました...",
      subtitle: "この Mac で うごく ろーかる AI ぶんしょう しえん",
      targetStaleError:
        "たいしょう が ふるく なって います。あっぷる あしす と うぃんどう を ひらきなおすか、めいん えでぃた で たいしょう を えらびなおして ください。",
      targetReadFailed:
        "たいしょう の よみこみ に しっぱい しました。めいん えでぃた で えらびなおしてから、もう いちど おねがいして ください。",
      tauriUnavailableError:
        "はざくら ろーかる あしす と うぃんどう が あぷりと せつぞく できません。.app から Hazakura Editor を ひらきなおして ください。",
      targetBlock: (chars) => `こーど ぶろっく (${chars} もじ)`,
      targetDocument: (chars) => `ふみ ぜんたい (${chars} もじ)`,
      targetLabel: (label) => `${label}`,
      targetParagraph: (chars) => `だんらく (${chars} もじ)`,
      targetSection: (chars) => `しょう (${chars} もじ)`,
      targetSelection: (chars) => `えらんだ ところ (${chars} もじ)`,
      throttledError:
        "あっぷる ふぁうんでーしょん もでるず が れーと せいげん ちゅう です。すこし まって から さいしこう してください。",
      unknownError: (raw) =>
        `はざくら ろーかる あしす と の せいせい に しっぱい しました: ${raw}`,
      unsupportedStatus:
        "この はんきょうで はざくら ろーかる あしす とは つかえません。macOS 26 いこう、M1 いこうの Mac、この Mac で ゆうこうかした あっぷる いんてりじぇんす、たいおう げんご / ちいき が ひつようです。",
      workingLocally: "この Mac で しょり ちゅう (そとの AI さーびすには おくりません)",
      streamPreviewHeading: "つくっている あん",
      streamPreviewIdle:
        "おねがいすると、AI が つくっている とちゅうの ぶんが ここに でます。できあがった あんは、ほぞん まえに へんこうてんを かくにん できます。",
      streamPreviewWaiting:
        "つくりはじめています。ぶんが とどくと ここに でます。",
      // v0.17 operation-feedback panel copy.
      feedbackHeading: "しんこうじょうきょう",
      feedbackEmpty:
        "まだ おねがいは ありません。たいしょうを えらび、おねがいの ないようを かいてください。",
      feedbackEntry: (kind, payload) => {
        if (kind === "ready") {
          return "じゅんび できました。";
        }
        if (kind === "target-acquired") {
          const tk = payload?.targetKind;
          const chars = payload?.targetChars ?? 0;
          if (tk === "selection") {
            return `今回のたいしょう: えらんだ ところ、およそ ${chars} もじ`;
          }
          if (tk === "paragraph") {
            return `今回のたいしょう: だんらく、およそ ${chars} もじ`;
          }
          if (tk === "block") {
            return `今回のたいしょう: こーど ぶろっく、およそ ${chars} もじ`;
          }
          if (tk === "section") {
            return `今回のたいしょう: しょう、およそ ${chars} もじ`;
          }
          if (tk === "document") {
            return `今回のたいしょう: ふみ ぜんたい、およそ ${chars} もじ`;
          }
          return "今回のたいしょうを きめました。";
        }
        if (kind === "request-sent") {
          return "おねがいを うけつけました。";
        }
        if (kind === "generation-started") {
          return "この Mac で へんしゅう あんを つくっています。";
        }
        if (kind === "applied") {
          return "へんしゅう あんを はんえいしました。ほぞん まえに かくにん できます。";
        }
        if (kind === "failed") {
          return "うまく いきませんでした。下の すてーたす を みてください。";
        }
        return "はざくら ろーかる あしす とは この はんきょうで つかえません。";
      },
    };
  }

  if (lang === "ja") {
    return {
      activeDocument: (name) => `対象: ${name}`,
      appliedStatus: () =>
        "編集案を反映しました。保存前に差分で確認できます。",
      applyButton: "依頼する",
      cancelButton: "取り消す",
      cancelledStatus: "依頼を取り消しました。",
      cancellingStatus: "取り消し中...",
      availableDisclosure:
        "これはプレビュー版のローカル AI 文章支援です。この Mac の Apple Intelligence 対応機能で文章を整えますが、出力品質は安定しないことがあります。編集案は未保存の変更として扱い、保存前に差分で確認できます。外部 AI サービスには情報を送りません。",
      contextTooLongError:
        "周辺の文書が長すぎます。L Mode の対象周辺コンテキスト上限（8000 文字）を超えました。",
      disabledStatus:
        "このセッションでは Hazakura Local Assist は無効です。アシスト設定で「Hazakura Local Assist (プレビュー)」を選び、アプリを再起動してください。",
      emptyRequestError:
        "まずは依頼内容を入力してください。",
      generatingButton: "依頼中...",
      generatingChange:
        "ローカルモデルで処理中。保存前に差分で確認できます。",
      generatingInMain: () =>
        "編集案を作っています。保存前に差分で確認できます。",
      failedStatus:
        "依頼に失敗しました。下のメッセージを確認してください。",
      guardrailError:
        "Apple Foundation Models がこの依頼を受け付けませんでした。別の依頼内容で再試行してください。",
      localRuntimeUnavailable: (reason) =>
        `Hazakura Local Assist は使えません: ${reason}。目安として macOS 26 以降、M1 以降の Mac、Apple Intelligence の有効化、対応言語 / 地域が必要です。詳しくは Apple 公式の Apple Intelligence 案内を確認してください。`,
      longRunningStatus:
        "初回や長文では少し時間がかかることがあります。",
      modeLabel: "プレビュー",
      noActiveDocument:
        "メインエディタに開いている文書がありません。Markdown / テキストファイルを開いてください。",
      noTarget:
        "対象がまだ選ばれていません。エディタにカーソルを置くか、L Mode を開いて対象を設定してください。",
      placeholder:
        "ここに依頼内容を入力してください",
      presets: buildLocalAssistPresets("ja"),
      presetsLabel: "よく使う依頼",
      readyStatus:
        "準備できました。よく使う依頼を選ぶか、依頼内容を入力してください。",
      roughRequestLabel: "依頼内容",
      selectionTooLongError:
        "選択範囲が大きすぎます（最大 4000 文字）。Apple Foundation Models のコンテキスト窓に収まらないため、もう少し小さく選択してください。",
      sendingRequest: "依頼を受け付けました...",
      subtitle: "この Mac で動くローカル AI 文章支援",
      targetStaleError:
        "対象が古くなっています。Hazakura Local Assist ウィンドウを開き直すか、メインエディタで対象を選び直してください。",
      targetReadFailed:
        "対象の読み込みに失敗しました。メインエディタで選び直してから、もう一度依頼してください。",
      tauriUnavailableError:
        "Hazakura Local Assist ウィンドウがアプリと接続できません。.app から Hazakura Editor を開き直してください。",
      targetBlock: (chars) => `コードブロック (${chars} 文字)`,
      targetDocument: (chars) => `文書全体 (${chars} 文字)`,
      targetLabel: (label) => `${label}`,
      targetParagraph: (chars) => `段落 (${chars} 文字)`,
      targetSection: (chars) => `章 (${chars} 文字)`,
      targetSelection: (chars) => `選択範囲 (${chars} 文字)`,
      throttledError:
        "Apple Foundation Models がレート制限中です。少し待ってから再試行してください。",
      unknownError: (raw) =>
        `Hazakura Local Assist の生成に失敗しました: ${raw}`,
      unsupportedStatus:
        "この環境では Hazakura Local Assist は使えません。macOS 26 以降、M1 以降の Mac、この Mac で有効化された Apple Intelligence、対応言語 / 地域が必要です。",
      workingLocally: "この Mac 上で処理中（外部 AI サービスには送りません）",
      streamPreviewHeading: "作成中の案",
      streamPreviewIdle:
        "依頼すると、AI が作っている途中の文章がここに出ます。完成した案は、保存する前に変更点を確認できます。",
      streamPreviewWaiting:
        "作り始めています。文章が届くとここに出ます。",
      // v0.17 operation-feedback panel copy.
      feedbackHeading: "進行状況",
      feedbackEmpty:
        "まだ依頼はありません。対象を選び、依頼内容を入力してください。",
      feedbackEntry: (kind, payload) => {
        if (kind === "ready") {
          return "準備できました。";
        }
        if (kind === "target-acquired") {
          const tk = payload?.targetKind;
          const chars = payload?.targetChars ?? 0;
          if (tk === "selection") {
            return `今回の対象: 選択範囲、およそ ${chars} 文字`;
          }
          if (tk === "paragraph") {
            return `今回の対象: 段落、およそ ${chars} 文字`;
          }
          if (tk === "block") {
            return `今回の対象: コードブロック、およそ ${chars} 文字`;
          }
          if (tk === "section") {
            return `今回の対象: 章、およそ ${chars} 文字`;
          }
          if (tk === "document") {
            return `今回の対象: 文書全体、およそ ${chars} 文字`;
          }
          return "今回の対象を決めました。";
        }
        if (kind === "request-sent") {
          return "依頼を受け付けました。";
        }
        if (kind === "generation-started") {
          return "この Mac 上で編集案を作っています。";
        }
        if (kind === "applied") {
          return "編集案を反映しました。保存前に確認できます。";
        }
        if (kind === "failed") {
          return "うまくいきませんでした。下のステータスを確認してください。";
        }
        return "Hazakura Local Assist はこの環境では使えません。";
      },
    };
  }

  return {
    activeDocument: (name) => `Active: ${name}`,
    appliedStatus: () =>
      "Draft edit applied. Review the diff before saving.",
    applyButton: "Send request",
    cancelButton: "Cancel",
    cancelledStatus: "Request cancelled.",
    cancellingStatus: "Cancelling...",
    availableDisclosure:
      "This is a preview-quality writing aid. Hazakura Local Assist uses Apple Intelligence-capable features on this Mac, and results may vary. Document-changing results are applied to unsaved text for diff review. Nothing is sent to an external AI service.",
    contextTooLongError:
      "Document context is too long (L Mode harness caps surrounding text at 8000 characters). Pick a tighter target or break the change into smaller requests.",
    disabledStatus:
      "Hazakura Local Assist is disabled in this app session. Open Assist Settings, choose 'Hazakura Local Assist (Preview)', then restart the app.",
    emptyRequestError:
      "Type a request first.",
    generatingButton: "Sending...",
    generatingChange:
      "Processing with the local model. Review the diff before saving.",
    generatingInMain: () =>
      "Creating a draft edit. Review the diff before saving.",
    failedStatus:
      "Request failed. Check the message below.",
    guardrailError:
      "Apple Foundation Models refused this request because it hit a guardrail. Try a different request.",
    localRuntimeUnavailable: (reason) =>
      `Hazakura Local Assist is unavailable: ${reason}. As a guide, it needs macOS 26 or later, a Mac with M1 or later, Apple Intelligence turned on, and a supported language and region. Check Apple's Apple Intelligence support information for current requirements.`,
    longRunningStatus:
      "First runs or longer passages can take a little while.",
    modeLabel: "Preview",
    noActiveDocument:
      "No active document is open in the main editor. Open a Markdown or text file first.",
    noTarget:
      "No active target yet. Place the cursor inside the document, or open L Mode to get a target.",
    placeholder: "Type the request you want to send",
    presets: buildLocalAssistPresets("en"),
    presetsLabel: "Presets",
    readyStatus:
      "Ready. Pick a preset or type a request.",
    roughRequestLabel: "Request",
    selectionTooLongError:
      "Selection is too long (max 4000 characters). Apple Foundation Models has a bounded context window; pick a smaller selection, or split the change into multiple requests.",
    sendingRequest: "Request accepted...",
    subtitle: "Lightweight on-device writing help",
    targetStaleError:
      "The active target has changed since the request was prepared. Re-open the Hazakura Local Assist window, or pick a new target in the main editor.",
    targetReadFailed:
      "Could not read the target. Pick the text again in the main editor, then send the request again.",
    tauriUnavailableError:
      "Hazakura Local Assist cannot connect to the main editor. Reopen Hazakura Editor from the .app bundle and try again.",
    targetBlock: (chars) => `Code block (${chars} chars)`,
    targetDocument: (chars) => `Whole document (${chars} chars)`,
    targetLabel: (label) => `${label}`,
    targetParagraph: (chars) => `Paragraph (${chars} chars)`,
    targetSection: (chars) => `Section (${chars} chars)`,
    targetSelection: (chars) => `Selection (${chars} chars)`,
    throttledError:
      "Apple Foundation Models is rate limited or busy with another request. Try again shortly.",
    unknownError: (raw) =>
      `Hazakura Local Assist generation failed: ${raw}`,
    unsupportedStatus:
      "Hazakura Local Assist is not supported in this environment. It needs macOS 26 or later, a Mac with M1 or later, Apple Intelligence turned on for this Mac, and a supported language and region.",
    workingLocally: "Working locally on this Mac (no third-party AI service)",
    streamPreviewHeading: "Draft in progress",
    streamPreviewIdle:
      "When you send a request, the text being written will appear here. You can check the finished changes before saving.",
    streamPreviewWaiting:
      "Starting the draft. Text will appear here as it arrives.",
    // v0.17 operation-feedback panel copy.
    feedbackHeading: "Progress",
    feedbackEmpty:
      "No requests yet. Pick a target and describe what you want changed.",
    feedbackEntry: (kind, payload) => {
      if (kind === "ready") {
        return "Ready.";
      }
      if (kind === "target-acquired") {
        const tk = payload?.targetKind;
        const chars = payload?.targetChars ?? 0;
        if (tk === "selection") {
          return `This request targets: selection, about ${chars} characters`;
        }
        if (tk === "paragraph") {
          return `This request targets: paragraph, about ${chars} characters`;
        }
        if (tk === "block") {
          return `This request targets: code block, about ${chars} characters`;
        }
        if (tk === "section") {
          return `This request targets: section, about ${chars} characters`;
        }
        if (tk === "document") {
          return `This request targets: whole document, about ${chars} characters`;
        }
        return "Target selected for this request.";
      }
      if (kind === "request-sent") {
        return "Request accepted.";
      }
      if (kind === "generation-started") {
        return "Creating a draft edit on this Mac.";
      }
      if (kind === "applied") {
        return "Draft edit applied. Review before saving.";
      }
      if (kind === "failed") {
        return "That did not work. Check the status below.";
      }
      return "Hazakura Local Assist is unavailable in this environment.";
    },
  };
}
