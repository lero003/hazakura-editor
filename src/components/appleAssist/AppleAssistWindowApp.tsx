import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getMainAppleAssistTarget,
  requestApplyAiEditTransaction,
  setAppleAssistWindowTheme,
} from "../../lib/tauri";
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
import type { AppleAssistAvailability } from "../../lib/tauri/appleAssist";
import { buildApplyEvent } from "../../lib/appleAssist/instruction";
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

// v0.12+ Apple Local Assist Writing Companion.
// `AppleAssistWindowApp` is the root of the detached
// `hazakura apple assist` window — the outside-companion slot
// that replaces the Agent window in the same UX surface
// (see `docs/apple-local-assist-writing-companion-plan.md`).
//
// The user types a rough request ("整えて" / "自然にして" / "続きを書いて" /
// "校正して" / "この章を直して") into a textarea, picks the
// active tab from the main window's broadcast, and clicks
// the request button to emit `APPLY_AI_EDIT_TRANSACTION_EVENT` to the main
// window. The main window is responsible for:
//   - inferring the bounded target (selection → paragraph →
//     block → section) via `REQUEST_AI_EDIT_TARGET_EVENT` round
//     trip (slice 3),
//   - asking the bundled helper for a bounded replacement and
//     applying it to the unsaved buffer,
//     recording an AI edit transaction (slice 4),
//   - showing the change in the Diff / change-review escape
//     hatch (slice 5).
//
// The window only renders a thin shell with:
//   - a header that names the companion and shows the current
//     active document title (mirrored from the main window),
//   - a rough-request textarea + a few preset chips for the
//     common rough requests.
//
// Status / error feedback is shown inline so the mock is
// usable end-to-end without depending on the agent
// workbench / provider surfaces.
//
// Companion-slot mutual exclusion is enforced server-side in
// `open_apple_assist_window` / `open_agent_window`: opening
// the Apple Assist window closes the Agent window, and vice
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

const APPLE_ASSIST_GENERATION_FALLBACK_MS = 365_000;

// v0.17 operation-feedback panel.
//
// The Assist Window keeps a short, current-session list of
// app-known lifecycle events. The list is in React window
// state only and is intentionally not persisted to disk,
// localStorage, logs, diagnostics, or Support Diagnostics.
//
// The cap (`OPERATION_FEEDBACK_MAX_ENTRIES = 6`) matches the
// "latest 5-7 entries" guidance in the v0.17 request doc
// and in `docs/apple-local-assist-writing-companion-plan.md`.
// Older entries are dropped from the head when the cap is
// exceeded so the panel never grows past a screen of
// information.
export const OPERATION_FEEDBACK_MAX_ENTRIES = 6;

export function scrollOperationFeedbackToEnd(element: HTMLElement | null): void {
  if (!element) {
    return;
  }
  element.scrollTop = element.scrollHeight;
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
  return (stored as ThemePreference) ?? "dark";
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
  const [roughRequest, setRoughRequest] = useState<string>("");
  const [status, setStatus] = useState<string>(
    () => getAppleAssistWindowCopy(readInitialMenuLanguage()).readyStatus,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [target, setTarget] = useState<AppleAssistTargetSnapshot | null>(null);
  const { availability, available, probed } = useAppleAssistAvailability();
  const { feedback, pushFeedback } = useOperationFeedback();
  const feedbackSectionRef = useRef<HTMLElement | null>(null);
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
      setBusy(false);
      setStatus(copy.longRunningStatus);
    }, APPLE_ASSIST_GENERATION_FALLBACK_MS);
  }, [clearGenerationFallback, copy.longRunningStatus]);

  useEffect(() => {
    scrollOperationFeedbackToEnd(feedbackSectionRef.current);
  }, [feedback.length]);

  // Apply theme to the Apple Assist window's document so the
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
      console.warn("Failed to update Apple Assist window OS theme", err);
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
        if (payload.phase === "started") {
          setBusy(true);
          setError(null);
          setStatus(copy.generatingChange);
          pushFeedback({ kind: "generation-started" });
          scheduleGenerationFallback();
          return;
        }
        clearGenerationFallback();
        setBusy(false);
        setStatus(
          payload.phase === "completed"
            ? copy.appliedStatus(payload.request)
            : payload.message,
        );
        setError(payload.phase === "failed" ? payload.message : null);
        pushFeedback({
          kind: payload.phase === "completed" ? "applied" : "failed",
        });
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
        console.warn("Failed to listen for Apple Assist apply status", err);
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
    const request = roughRequest.trim();
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
    setStatus(copy.sendingRequest);
    scheduleGenerationFallback();
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
      // `buildApplyEvent` keeps the user-facing
      // `payload.request` (the original rough phrase) and
      // the helper-side `payload.instruction` (the preset
      // intent hint) separate, so the AI edit transaction,
      // the main editor status message, and the Apple
      // Assist review bar only ever see what the user
      // actually typed.
      const payload = buildApplyEvent({
        request,
        target: latestTarget,
        requestedAtMs: Date.now(),
        presets: copy.presets,
      });
      await requestApplyAiEditTransaction(payload);
      setStatus(copy.generatingInMain(request));
    } catch (err: unknown) {
      clearGenerationFallback();
      setBusy(false);
      setError(classifyApplyError(err, copy));
      // Push a "failed" entry when the IPC call itself
      // throws. The status-event listener above also
      // pushes "failed" when the main window emits a
      // `failed` phase; in practice exactly one of the
      // two branches fires for a given apply, but a
      // double-fail can leave two "failed" entries in
      // the cap window. That is acceptable for the
      // feedback trail because both lines render the
      // same localized "failed" text and the cap (6)
      // keeps the panel bounded.
      pushFeedback({ kind: "failed" });
    }
  }, [
    available,
    availabilityMessage,
    clearGenerationFallback,
    copy,
    pushFeedback,
    roughRequest,
    scheduleGenerationFallback,
    target,
  ]);

  const onPickPreset = useCallback((prompt: string) => {
    setRoughRequest(prompt);
    setError(null);
  }, []);

  return (
    <div className="apple-assist-window-shell" data-testid="apple-assist-shell">
      <header className="apple-assist-window-header">
        <div className="apple-assist-window-title">Apple Local Assist</div>
        <div className="apple-assist-window-subtitle">
          {copy.subtitle}
          <span className="apple-assist-window-mode">{copy.modeLabel}</span>
        </div>
        <div className="apple-assist-window-disclosure">
          {available
            ? copy.availableDisclosure
            : availabilityMessage}
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
          value={roughRequest}
          onChange={(event) => {
            setRoughRequest(event.target.value);
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
          disabled={busy || !available || roughRequest.trim().length === 0}
        >
          {busy ? copy.generatingButton : copy.applyButton}
        </button>
      </section>

      <section className="apple-assist-window-presets" aria-label={copy.presetsLabel}>
        <p className="apple-assist-presets-heading">{copy.presetsLabel}</p>
        <div className="apple-assist-presets-list">
          {copy.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="apple-assist-preset"
              onClick={() => onPickPreset(preset.prompt)}
              disabled={busy || !available}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section
        ref={feedbackSectionRef}
        className="apple-assist-window-feedback"
        aria-label={copy.feedbackHeading}
        data-testid="apple-assist-feedback-section"
      >
        <p
          className="apple-assist-feedback-heading"
          data-testid="apple-assist-feedback-heading"
          id="apple-assist-feedback-heading-id"
        >
          {copy.feedbackHeading}
        </p>
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
            {feedback.map((entry) => (
              <li
                className={`apple-assist-feedback-entry apple-assist-feedback-entry-kind-${entry.kind}`}
                data-feedback-kind={entry.kind}
                data-testid="apple-assist-feedback-entry"
                key={entry.id}
              >
                {copy.feedbackEntry(entry.kind, entry.payload)}
              </li>
            ))}
          </ul>
        )}
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

type AppleAssistWindowPreset = {
  id: string;
  label: string;
  prompt: string;
};

export type AppleAssistWindowCopy = {
  activeDocument: (name: string) => string;
  appliedStatus: (request: string) => string;
  applyButton: string;
  availableDisclosure: string;
  contextTooLongError: string;
  disabledStatus: string;
  emptyRequestError: string;
  generatingButton: string;
  generatingChange: string;
  generatingInMain: (request: string) => string;
  guardrailError: string;
  localRuntimeUnavailable: (reason: string) => string;
  longRunningStatus: string;
  modeLabel: string;
  noActiveDocument: string;
  noTarget: string;
  placeholder: string;
  presets: AppleAssistWindowPreset[];
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

// `classifyApplyError` turns a raw catch-block error from the
// `requestApplyAiEditTransaction` IPC call (or any exception
// thrown by the listener) into a localized, actionable
// message for the user. The Rust side returns English-only
// error strings, and the Foundation Models Swift helper
// emits English debug descriptions, so without this
// classification the user would see raw English text in a
// Japanese (or kana) Apple Assist window. The classifier
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
      appliedStatus: (request) =>
        `へんしゅう あんを はんえいしました: ${request}。ほぞん まえに さぶんで かくにん できます。`,
      applyButton: "おねがいする",
      availableDisclosure:
        "この Mac だけで ぶんしょう の てなおしを てつだいます。えらんだ ところや いまの だんらくを たいしょうにし、けっかは ほぞん まえの へんしゅう あんとして はいります。",
      contextTooLongError:
        "しゅうへん ぶんしょ が ながすぎ ます。L Mode の たいしょう しゅうへん こんできすと の じょうげん (8000 もじ) を こえました。",
      disabledStatus:
        "この せっしょで あっぷる ろーかる あしす とは むこうです。Preferences > Assist Surface で あっぷる ろーかる あしす と (じっけん) を えらび、あぷりを さいきどうして ください。",
      emptyRequestError:
        "まずは おねがいを かいてください。れい: ととのえて / しぜんに / つづきを / こうせい。",
      generatingButton: "おねがい中...",
      generatingChange:
        "この Mac で へんしゅう あんを つくっています。けっかは ほぞん まえの へんしゅう あんとして はいります。",
      generatingInMain: (request) =>
        `へんしゅう あんを つくっています: ${request}。ほぞん まえに さぶんで かくにん できます。`,
      guardrailError:
        "あっぷる ふぁうんでーしょん もでるず が かーどれーる いはん として この おねがひを きょひ しました。べつ の おねがひ で さいしこう してください。",
      localRuntimeUnavailable: (reason) =>
        `あっぷる ろーかる あしす とは つかえません: ${reason}。System Settings > Apple Intelligence & Siri で あっぷる いんてりじぇんす が ゆうこうか、げんざいの あぷり ことば が ふぁうんでーしょん もでるず に たいおうしているか を かくにん してください。`,
      longRunningStatus:
        "あっぷる ろーかる あしす と は まだ さぎょう ちゅう。ふぁうんでーしょん もでるず は ふつう すうびょうで おうとうしますが、むこうの ときは めいん えでぃた の すてーたす を かくにんするか、うぃんどう を ひらきなおして ください。",
      modeLabel: "Alpha",
      noActiveDocument:
        "めいん えでぃた に ひらいている ふみが ありません。Markdown / テキスト ふぁいる を ひらいて ください。",
      noTarget:
        "たいしょう が まだ えらばれて いません。えでぃた に かーそる を おくか、L Mode を ひらいて たいしょう を せってい して ください。",
      placeholder:
        "どう なおしたいかを かいてください",
      presets: [
        { id: "tidy", label: "ととのえて", prompt: "整えて" },
        { id: "natural", label: "しぜんに", prompt: "自然にして" },
        { id: "continue", label: "つづきを", prompt: "続きを書いて" },
        { id: "proofread", label: "こうせい", prompt: "校正して" },
        { id: "rewrite-section", label: "このしょうを", prompt: "この章を直して" },
      ],
      presetsLabel: "よくつかう おねがい",
      readyStatus:
        "じゅんび できました。たいしょうを えらび、おねがいを かいてください。けっかは ほぞん まえの へんしゅう あんとして はいります。",
      roughRequestLabel: "おねがい",
      selectionTooLongError:
        "えらんだ ところが ながすぎ ます（さいだい 4000 もじ）。あっぷる ふぁうんでーしょん もでるず の こんできすと まど に おさまらないため、もう すこし ちいさく えらんで ください。",
      sendingRequest: "おねがいを うけつけました...",
      subtitle: "けいりょう な おんではばいす ぶんしょう ほじょ",
      targetStaleError:
        "たいしょう が ふるく なって います。あっぷる あしす と うぃんどう を ひらきなおすか、めいん えでぃた で たいしょう を えらびなおして ください。",
      targetReadFailed:
        "たいしょう の よみこみ に しっぱい しました。めいん えでぃた で えらびなおしてから、もう いちど おねがいして ください。",
      tauriUnavailableError:
        "あっぷる ろーかる あしす と うぃんどう が Tauri runtime の そとで うごいています。めいん えでぃた に とどけません。.app ばんどる から あぷり を さいきどうして ください。",
      targetBlock: (chars) => `こーど ぶろっく (${chars} もじ)`,
      targetDocument: (chars) => `ふみ ぜんたい (${chars} もじ)`,
      targetLabel: (label) => `${label}`,
      targetParagraph: (chars) => `だんらく (${chars} もじ)`,
      targetSection: (chars) => `しょう (${chars} もじ)`,
      targetSelection: (chars) => `えらんだ ところ (${chars} もじ)`,
      throttledError:
        "あっぷる ふぁうんでーしょん もでるず が れーと せいげん ちゅう です。すこし まって から さいしこう してください。",
      unknownError: (raw) =>
        `あっぷる ろーかる あしす と の せいせい に しっぱい しました: ${raw}`,
      unsupportedStatus:
        "この はんきょうで あっぷる ろーかる あしす とは つかえません。macOS 26 いこう と、この Mac で ゆうこうかした あっぷる いんてりじぇんす と、ふぁうんでーしょん もでるず たいおう の ことば / ろけーる が ひつようです。",
      workingLocally: "この Mac で ろーかる しょり ちゅう (ねっとわーく よびだし なし)",
      // v0.17 operation-feedback panel copy.
      feedbackHeading: "すすみぐあい",
      feedbackEmpty:
        "まだ おねがいは ありません。たいしょうを えらび、おねがいを かいてください。",
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
        return "あっぷる ろーかる あしす とは この はんきょうで つかえません。";
      },
    };
  }

  if (lang === "ja") {
    return {
      activeDocument: (name) => `対象: ${name}`,
      appliedStatus: (request) =>
        `編集案を反映しました: ${request}。保存前に差分で確認できます。`,
      applyButton: "依頼する",
      availableDisclosure:
        "この Mac 上で文章の手直しを手伝います。選択範囲や現在の段落を対象にし、結果は未保存の編集案として反映します。保存前に差分で確認できます。",
      contextTooLongError:
        "周辺の文書が長すぎます。L Mode の対象周辺コンテキスト上限（8000 文字）を超えました。",
      disabledStatus:
        "このセッションでは Apple Local Assist は無効です。Preferences > Assist Surface で outside companion slot を「Apple Local Assist (Experimental)」に切り替え、アプリを再起動してください。",
      emptyRequestError:
        "まずは依頼内容を入力してください。例: 「整えて」「自然にして」「続きを書いて」「校正して」。",
      generatingButton: "依頼中...",
      generatingChange:
        "この Mac 上で編集案を作っています。結果は未保存の編集案として反映されます。",
      generatingInMain: (request) =>
        `編集案を作っています: ${request}。保存前に差分で確認できます。`,
      guardrailError:
        "Apple Foundation Models がこの依頼をガードレール違反として拒否しました。別の依頼文で再試行してください。",
      localRuntimeUnavailable: (reason) =>
        `Apple Local Assist は使えません: ${reason}。System Settings > Apple Intelligence & Siri で Apple Intelligence が有効か、現在のアプリ言語が Foundation Models に対応しているかを確認してください。`,
      longRunningStatus:
        "Apple Local Assist はまだ処理中です。Foundation Models は通常数秒で応答しますが、応答がない場合はメインエディタ下部のステータスを確認するか、Apple Assist ウィンドウを開き直してください。",
      modeLabel: "Alpha",
      noActiveDocument:
        "メインエディタに開いている文書がありません。Markdown / テキストファイルを開いてください。",
      noTarget:
        "対象がまだ選ばれていません。エディタにカーソルを置くか、L Mode を開いて対象を設定してください。",
      placeholder:
        "どう直したいかを書いてください",
      presets: [
        { id: "tidy", label: "整えて", prompt: "整えて" },
        { id: "natural", label: "自然にして", prompt: "自然にして" },
        { id: "continue", label: "続きを書いて", prompt: "続きを書いて" },
        { id: "proofread", label: "校正して", prompt: "校正して" },
        { id: "rewrite-section", label: "この章を直して", prompt: "この章を直して" },
      ],
      presetsLabel: "よく使う依頼",
      readyStatus:
        "準備完了。対象を選び、依頼内容を入力してください。結果は未保存の編集案として反映されます。",
      roughRequestLabel: "依頼内容",
      selectionTooLongError:
        "選択範囲が大きすぎます（最大 4000 文字）。Apple Foundation Models のコンテキスト窓に収まらないため、もう少し小さく選択してください。",
      sendingRequest: "依頼を受け付けました...",
      subtitle: "軽量なオンデバイス文章補助",
      targetStaleError:
        "対象が古くなっています。Apple Assist ウィンドウを開き直すか、メインエディタで対象を選び直してください。",
      targetReadFailed:
        "対象の読み込みに失敗しました。メインエディタで選び直してから、もう一度依頼してください。",
      tauriUnavailableError:
        "Apple Local Assist ウィンドウが Tauri runtime の外で動作しており、メインエディタに到達できません。.app バンドルからアプリを再起動し、ウィンドウを Tauri 子プロセスとして起動してください。",
      targetBlock: (chars) => `コードブロック (${chars} 文字)`,
      targetDocument: (chars) => `文書全体 (${chars} 文字)`,
      targetLabel: (label) => `${label}`,
      targetParagraph: (chars) => `段落 (${chars} 文字)`,
      targetSection: (chars) => `章 (${chars} 文字)`,
      targetSelection: (chars) => `選択範囲 (${chars} 文字)`,
      throttledError:
        "Apple Foundation Models がレート制限中です。少し待ってから再試行してください。",
      unknownError: (raw) =>
        `Apple Local Assist の生成に失敗しました: ${raw}`,
      unsupportedStatus:
        "この環境では Apple Local Assist は使えません。macOS 26 以降と、この Mac で有効化された Apple Intelligence、そして Foundation Models 対応の言語 / ロケールが必要です。",
      workingLocally: "この Mac 上でローカル処理中（ネットワーク呼び出しなし）",
      // v0.17 operation-feedback panel copy.
      feedbackHeading: "処理の流れ",
      feedbackEmpty:
        "まだ依頼はありません。対象を選び、依頼内容を入力してください。",
      feedbackEntry: (kind, payload) => {
        if (kind === "ready") {
          return "準備完了。";
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
        return "Apple Local Assist はこの環境では使えません。";
      },
    };
  }

  return {
    activeDocument: (name) => `Active: ${name}`,
    appliedStatus: (request) =>
      `Draft edit applied: ${request}. Review the diff before saving.`,
    applyButton: "Send request",
    availableDisclosure:
      "Apple Local Assist helps revise the selected text or current paragraph on this Mac. Results land as an unsaved draft edit, so you can review the diff before saving.",
    contextTooLongError:
      "Document context is too long (L Mode harness caps surrounding text at 8000 characters). Pick a tighter target or break the change into smaller requests.",
    disabledStatus:
      "Apple Local Assist is disabled in this app session. Open Preferences > Assist Surface and switch the outside companion slot to 'Apple Local Assist (Experimental)'. Restart the app to apply.",
    emptyRequestError:
      "Type what you want changed first. Examples: 'Make it cleaner', 'Continue this', 'Proofread this'.",
    generatingButton: "Sending...",
    generatingChange:
      "Creating a draft edit on this Mac. The result lands as an unsaved draft edit in the main editor.",
    generatingInMain: (request) =>
      `Creating a draft edit: ${request}. Review the diff before saving.`,
    guardrailError:
      "Apple Foundation Models refused this request because it hit a guardrail. Try a different request.",
    localRuntimeUnavailable: (reason) =>
      `Apple Local Assist is unavailable: ${reason}. Verify Apple Intelligence is on in System Settings > Apple Intelligence & Siri, and that the current app language is supported by Foundation Models.`,
    longRunningStatus:
      "Apple Local Assist is still working. Foundation Models usually returns in a few seconds; if it has not, check the main editor status line for the underlying error, or re-open the Apple Assist window.",
    modeLabel: "Alpha",
    noActiveDocument:
      "No active document is open in the main editor. Open a Markdown or text file first.",
    noTarget:
      "No active target yet. Place the cursor inside the document, or open L Mode to get a target.",
    placeholder: "Describe what you want changed",
    presets: [
      { id: "tidy", label: "Clean up", prompt: "Make it cleaner" },
      { id: "natural", label: "Natural", prompt: "Make it sound natural" },
      { id: "continue", label: "Continue", prompt: "Continue this" },
      { id: "proofread", label: "Proofread", prompt: "Proofread this" },
      {
        id: "rewrite-section",
        label: "Rewrite section",
        prompt: "Rewrite this section",
      },
    ],
    presetsLabel: "Common requests",
    readyStatus:
      "Ready. Pick a target and type what you want changed. Results land as unsaved draft edits.",
    roughRequestLabel: "Request",
    selectionTooLongError:
      "Selection is too long (max 4000 characters). Apple Foundation Models has a bounded context window; pick a smaller selection, or split the change into multiple requests.",
    sendingRequest: "Request accepted...",
    subtitle: "Lightweight on-device writing help",
    targetStaleError:
      "The active target has changed since the request was prepared. Re-open the Apple Assist window, or pick a new target in the main editor.",
    targetReadFailed:
      "Could not read the target. Pick the text again in the main editor, then send the request again.",
    tauriUnavailableError:
      "Apple Local Assist window is running outside the Tauri runtime; it cannot reach the main editor. Restart the app from the .app bundle so the window launches as a Tauri child process.",
    targetBlock: (chars) => `Code block (${chars} chars)`,
    targetDocument: (chars) => `Whole document (${chars} chars)`,
    targetLabel: (label) => `${label}`,
    targetParagraph: (chars) => `Paragraph (${chars} chars)`,
    targetSection: (chars) => `Section (${chars} chars)`,
    targetSelection: (chars) => `Selection (${chars} chars)`,
    throttledError:
      "Apple Foundation Models is rate limited or busy with another request. Try again shortly.",
    unknownError: (raw) =>
      `Apple Local Assist generation failed: ${raw}`,
    unsupportedStatus:
      "Apple Local Assist is not supported in this environment. It needs macOS 26 or later and Apple Intelligence turned on for this Mac, with a Foundation Models-supported language and locale.",
    workingLocally: "Working locally on this Mac (no network call)",
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
      return "Apple Local Assist is unavailable in this environment.";
    },
  };
}
