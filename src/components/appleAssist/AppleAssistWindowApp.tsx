import { requestLocalAssistReview } from "../../lib/tauri/localAssistReview";
import { acceptsReviewOutcome, matchesReviewIdentity, matchesReviewNavigation, LOCAL_ASSIST_REVIEW_RESULT_EVENT,
  type LocalAssistReviewIdentity, type LocalAssistReviewRequest, type LocalAssistReviewResult } from "../../features/editor/localAssistReviewIdentity";
import { getAssistConversationCopy } from "../../lib/locale/assistConversation";
import { AssistModelPicker } from "./AssistModelPicker";
import { AssistConversationMessages } from "./AssistConversationMessages";
import { ChevronIcon, DiffIcon, TextFileIcon } from "../app/Icons";
import { classifyLocalAssistError } from "../../lib/appleAssist/errors";
import { appleAssistTargetExcerpt } from "../../features/editor/appleAssistText";
import {
  DOCUMENT_CONTENT_LANG,
  documentLanguageForMenuLanguage,
  isMenuLanguage,
  readStoredMenuLanguage,
} from "../../features/app/documentLanguage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getMainAppleAssistTarget,
  requestAppleAssistProposal,
  setAppleAssistWindowTheme,
  cancelAppleAssistProposal,
} from "../../lib/tauri";
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
import {
  applyDetachedWindowThemeToDocument,
  readInitialDetachedWindowTheme,
} from "../../features/app/detachedWindowTheme";
import { useCoreAiModelCatalog } from "../../hooks/app/useCoreAiModelCatalog";
import type { AppleAssistAvailability } from "../../lib/tauri/appleAssist";
import {
  getAppleAssistWindowCopy,
  type AppleAssistWindowCopy,
  type OperationFeedbackKind,
  type OperationFeedbackPayload,
} from "../../lib/locale/appleAssistWindow";
export {
  getAppleAssistWindowCopy,
  type AppleAssistWindowCopy,
  type OperationFeedbackKind,
  type OperationFeedbackPayload,
} from "../../lib/locale/appleAssistWindow";
import { openLocalAssistModelSettings, selectLocalAssistModel } from "../../lib/tauri/coreAiModels";
import {
  buildProposalEvent,
  isLocalAssistActionId,
  resolveLocalAssistActionId,
  type LocalAssistActionId,
  type LocalAssistConversationRequest,
  type LocalAssistPreset,
} from "../../lib/appleAssist/instruction";
import {
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
  MENU_LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type AppleAssistApplyStatusEvent,
  type AppleAssistProposalStatusEvent,
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
// emit `REQUEST_AI_EDIT_PROPOSAL_EVENT` to the main window.
// UI labels stay display-only; `actionId` only routes the
// helper operation while the request text remains visible and
// editable. The main window is responsible for:
//   - inferring the bounded target (selection → paragraph →
//     block → section) via `REQUEST_AI_EDIT_TARGET_EVENT` round
//     trip (slice 3),
//   - asking the bundled helper for a bounded result,
//   - owning the current proposal, Diff review, and explicit Apply to the
//     unsaved buffer. This window renders conversation and progress only.
//
// Conversation/pinned target live here in memory. The proposal store and
// Apply handler live in main; this window retains candidate text solely for
// bounded follow-up requests. No conversation is persisted to disk.
// Companion-slot mutual exclusion is enforced by the native window commands.
// See docs/v3-local-assist-ownership.md for the current ownership contract.
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

export function createAppleAssistConversationId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isApplyStatusForActiveRequest(
  activeRequestId: string | null,
  payload: Pick<AppleAssistApplyStatusEvent, "requestId">,
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

type LocalAssistConversationSession = {
  id: string;
  turnIndex: number;
  pinnedTarget: AppleAssistTargetSnapshot;
  originalText: string;
  currentProposalText: string | null;
  turns: string[];
  revisionHistory: string[];
};

export function AppleAssistWindowApp() {
  const [theme, setTheme] = useState<ThemePreference>(readInitialDetachedWindowTheme);
  const [menuLanguage, setMenuLanguage] =
    useState<MenuLanguage>(readStoredMenuLanguage);
  const copy = useMemo(
    () => getAppleAssistWindowCopy(menuLanguage),
    [menuLanguage],
  );
  // Event subscriptions live for the window lifetime. Language changes only
  // update presentation, never detach the transport for in-flight outcomes.
  const copyRef = useRef(copy);
  copyRef.current = copy;
  const [selectedActionId, setSelectedActionId] =
    useState<LocalAssistActionId | null>(null);
  const [requestText, setRequestText] = useState<string>("");
  const [status, setStatus] = useState<string>(
    () => getAppleAssistWindowCopy(readStoredMenuLanguage()).readyStatus,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  // True between the user clicking Cancel and the "cancelled" status
  // arriving. Disables the Cancel button so a user cannot fire
  // multiple stop commands in a row (the Rust path is idempotent, but
  // repeated clicks read as a stuck UI).
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [target, setTarget] = useState<AppleAssistTargetSnapshot | null>(null);
  const { catalog: modelCatalog, runCatalogRequest } = useCoreAiModelCatalog();
  const selectedModelIdRef = useRef(modelCatalog.selectedModelId);
  const selectedModel = modelCatalog.models.find((model) => model.id === modelCatalog.selectedModelId);
  const selectedModelSignature = `${modelCatalog.selectedModelId}:${selectedModel?.status ?? "missing"}:${selectedModel?.assetPackVersion ?? "none"}`;
  const selectedModelSignatureRef = useRef(selectedModelSignature);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [modelSwitching, setModelSwitching] = useState(false);
  // This window already follows the catalog directly; avoid a second probe
  // subscription for the same model-change event.
  const { availability, available, probed } = useAppleAssistAvailability(true, availabilityRefreshKey, false);
  const { feedback, pushFeedback, clearFeedback } = useOperationFeedback();
  const [sentRequests, setSentRequests] = useState<Array<{ id: string; at: number; text: string }>>([]);
  const followChatRef = useRef(true);
  const ui = getAssistConversationCopy(menuLanguage);
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
  const availabilityMessage = renderAvailabilityMessage(
    availability,
    probed,
    copy,
  );
  const generationFallbackRef = useRef<number | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const cancellingRequestIdRef = useRef<string | null>(null);
  const submissionRef = useRef<{ requestId: string; promise: Promise<void> } | null>(null);
  const activeActionIdRef = useRef<LocalAssistActionId | null>(null);
  const [streamPreview, setStreamPreview] = useState<string>("");
  const [streamOriginalText, setStreamOriginalText] = useState<string>("");
  const [conversation, setConversation] =
    useState<LocalAssistConversationSession | null>(null);
  const targetRef = useRef<AppleAssistTargetSnapshot | null>(target);
  // Keep the last completed identity through failed/cancelled follow-up generation.
  // The main store decides whether its restored proposal is still reviewable.
  const [reviewIdentity, setReviewIdentity] = useState<LocalAssistReviewIdentity | null>(null);
  const reviewIdentityRef = useRef<LocalAssistReviewIdentity | null>(null);
  const [reviewNavigation, setReviewNavigation] = useState<LocalAssistReviewRequest | null>(null);
  const reviewPending = reviewNavigation !== null;
  const reviewNavigationRef = useRef<LocalAssistReviewRequest | null>(null);
  const [reviewUnavailable, setReviewUnavailable] = useState(false);
  const clearReviewNavigation = useCallback(() => {
    reviewNavigationRef.current = null;
    setReviewNavigation(null);
    setReviewUnavailable(false);
  }, []);
  const conversationRef = useRef<LocalAssistConversationSession | null>(null);
  conversationRef.current = conversation;
  targetRef.current = target;
  const displayedTarget = conversation?.pinnedTarget ?? target;

  useEffect(() => {
    if (selectedModelSignature === selectedModelSignatureRef.current) return;
    selectedModelSignatureRef.current = selectedModelSignature;
    selectedModelIdRef.current = modelCatalog.selectedModelId;
    availabilityReportedRef.current = false;
    setAvailabilityRefreshKey((current) => current + 1);
  }, [modelCatalog.selectedModelId, selectedModelSignature]);

  const selectModel = useCallback(async (modelId: string) => {
    if (busy || modelSwitching || !probed) return;
    if (modelId === selectedModelIdRef.current) {
      availabilityReportedRef.current = false;
      setAvailabilityRefreshKey((current) => current + 1);
      return;
    }
    setModelSwitching(true);
    setError(null);
    try {
      await runCatalogRequest(() => selectLocalAssistModel(modelId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setModelSwitching(false);
    }
  }, [busy, modelSwitching, probed, runCatalogRequest]);

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
      setStatus(copyRef.current.longRunningStatus);
    }, APPLE_ASSIST_GENERATION_FALLBACK_MS);
  }, [clearGenerationFallback]);

  useEffect(() => {
    if (followChatRef.current) scrollOperationFeedbackToEnd(feedbackSectionRef.current);
  }, [feedback.length, sentRequests.length, streamPreview, status]);

  // Apply theme to the Hazakura Local Assist window's document so the
  // CSS variable surface matches the main window. Mirrors the
  // detached Agent window's pattern. The `storage` event fires
  // only in OTHER windows, which is what we want — the Apple
  // Assist window never mutates the theme, so it just listens
  // for cross-window changes from the main window's theme
  // toggle.
  useEffect(() => {
    applyDetachedWindowThemeToDocument(theme);
    void setAppleAssistWindowTheme(theme).catch((err) => {
      console.warn("Failed to update Hazakura Local Assist window OS theme", err);
    });
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang =
      documentLanguageForMenuLanguage(menuLanguage);
  }, [menuLanguage]);

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

    void listen<AppleAssistProposalStatusEvent>(
      APPLE_ASSIST_PROPOSAL_STATUS_EVENT,
      (event) => {
        if (disposed) {
          return;
        }
        const copy = copyRef.current;
        const payload = event.payload;
        if (!isApplyStatusForActiveRequest(activeRequestIdRef.current, payload)) {
          return;
        }
        if (payload.phase === "cancelling") {
          cancellingRequestIdRef.current = payload.requestId;
          clearGenerationFallback();
          setBusy(true);
          setCancelling(true);
          setStreamPreview("");
          setError(null);
          setStatus(copy.cancellingStatus);
          return;
        }
        if ((payload.phase === "partial" || payload.phase === "started") &&
            cancellingRequestIdRef.current === payload.requestId) return;
        if (payload.phase === "started") {
          if (isLocalAssistActionId(payload.actionId)) {
            activeActionIdRef.current = payload.actionId;
          }
          setBusy(true);
          setCancelling(false);
          setError(null);
          setStreamPreview("");
          if (payload.originalText !== undefined) {
            setStreamOriginalText(payload.originalText);
          }
          setStatus(copy.generatingChange);
          pushFeedback({ kind: "generation-started" });
          scheduleGenerationFallback();
          return;
        }
        if (payload.phase === "partial") {
          setBusy(true);
          setError(null);
          // Partial text is presentation only. Hide snapshots containing
          // internal delimiters; only final candidates reach Diff/Apply.
          setStreamPreview(sanitizeStreamPreviewText(payload.partialText ?? ""));
          return;
        }
        clearGenerationFallback();
        setBusy(false);
        cancellingRequestIdRef.current = null;
        setCancelling(false);
        setActiveRequestId(null);
        activeRequestIdRef.current = null;
        activeActionIdRef.current = null;
        if (payload.phase === "completed" && payload.candidateText) {
          // v2.6 B2: the main window owns the proposal review. The detached
          // window only keeps the current-proposal text so a follow-up turn
          // revises the right candidate.
          const conversationId = payload.conversationId;
          const sessionId = payload.target?.activeDocumentSessionId;
          if (conversationId && sessionId && conversationRef.current?.id === conversationId &&
              conversationRef.current.pinnedTarget.activeDocumentSessionId === sessionId) {
            const identity = { requestId: payload.requestId, conversationId, documentSessionId: sessionId };
            clearReviewNavigation();
            reviewIdentityRef.current = identity;
            setReviewIdentity(identity);
            setReviewUnavailable(false);
          }
          if (conversationId) {
            setConversation((current) => {
              if (!current || current.id !== conversationId) {
                return current;
              }
              const nextConversation: LocalAssistConversationSession = {
                ...current,
                turnIndex: payload.conversationTurnIndex ?? current.turnIndex,
                currentProposalText: payload.candidateText ?? null,
                revisionHistory: [
                  ...current.revisionHistory,
                  payload.request,
                ].slice(-4),
              };
              conversationRef.current = nextConversation;
              return nextConversation;
            });
          }
        }
        setStreamPreview("");
        setStreamOriginalText("");
        const presentation = getProposalStatusPresentation(payload, copy);
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
        console.warn("Failed to listen for Hazakura Local Assist proposal status", err);
        if (!disposed) {
          setError(copyRef.current.targetReadFailed);
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
  }, [clearGenerationFallback, clearReviewNavigation, pushFeedback, scheduleGenerationFallback]);

  // v2.6 B2: the main window owns Apply/Discard and reports the outcome here
  // so the detached window can reset its conversation and show a short status.
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
        const copy = copyRef.current;
        const payload = event.payload;
        if (!acceptsReviewOutcome(reviewIdentityRef.current, payload, conversationRef.current?.id,
          conversationRef.current?.pinnedTarget.activeDocumentSessionId, activeRequestIdRef.current)) return;
        if (payload.phase !== "completed" && payload.phase !== "discarded" && payload.phase !== "failed") return;
        if (payload.phase === "completed" || payload.phase === "discarded") {
          conversationRef.current = null;
          clearReviewNavigation();
          reviewIdentityRef.current = null; setReviewIdentity(null);
          setConversation(null);
          setStreamPreview("");
          setStreamOriginalText("");
        }
        // Failure is feedback only: keep the pinned conversation and draft.
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
      });

    return () => {
      disposed = true;
      if (unlisten) {
        void unlisten();
        unlisten = null;
      }
    };
  }, [clearReviewNavigation, pushFeedback]);

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
          setError(copyRef.current.targetReadFailed);
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
          setError(copyRef.current.targetReadFailed);
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
    if (modelSwitching || !probed) return;
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
    setStreamOriginalText("");
    setStatus(copy.sendingRequest);
    scheduleGenerationFallback();
    const requestId = createAppleAssistRequestId();
    followChatRef.current = true;
    setSentRequests((current) => [...current, { id: requestId, at: Date.now(), text: request }].slice(-20));
    const actionId =
      selectedActionId ?? resolveLocalAssistActionId(request, copy.presets);
    activeActionIdRef.current = actionId;
    const previousConversation = conversationRef.current;
    const hadCurrentProposal = previousConversation?.currentProposalText != null;
    let createdConversation = false;
    setActiveRequestId(requestId);
    activeRequestIdRef.current = requestId;
    try {
      let requestConversation = conversationRef.current;
      if (!requestConversation) {
        // Pin the target only once, on the first request. Follow-up turns
        // never re-read the live cursor/selection, so moving the editor does
        // not silently redirect the conversation.
        const latestTarget =
          (await getMainAppleAssistTarget().catch(() => null)) ?? target;
        if (activeRequestIdRef.current !== requestId) return;
        if (!latestTarget) {
          throw new Error("No Hazakura Local Assist target is available.");
        }
        requestConversation = {
          id: createAppleAssistConversationId(),
          turnIndex: 0,
          pinnedTarget: { ...latestTarget },
          originalText: latestTarget.text,
          currentProposalText: null,
          turns: [request],
          revisionHistory: [],
        } satisfies LocalAssistConversationSession;
        createdConversation = true;
      } else {
        requestConversation = {
          ...requestConversation,
          turnIndex: hadCurrentProposal
            ? requestConversation.turnIndex + 1
            : requestConversation.turnIndex,
          turns: [...requestConversation.turns, request].slice(-4),
        };
      }
      conversationRef.current = requestConversation;
      setConversation(requestConversation);
      const pinnedTarget = requestConversation.pinnedTarget;
      // v0.17 operation-feedback: report the target the
      // user is actually about to send to, *before* the
      // `request-sent` entry. The header / target summary
      // area is explicitly pinned after the first request. A follow-up
      // reports the same target rather than the live cursor target.
      pushFeedback({
        kind: "target-acquired",
        payload: {
          targetKind: pinnedTarget.kind,
          targetChars: pinnedTarget.text.length,
        },
      });
      pushFeedback({ kind: "request-sent" });
      // `buildProposalEvent` keeps the display label, fixed
      // `actionId`, and visible request text separate. The
      // helper maps the action id to a bounded operation while
      // the visible request text is passed as prompt data, not
      // system instruction.
      const payload = buildProposalEvent({
        requestId,
        actionId,
        requestText: request,
        target: pinnedTarget,
        requestedAtMs: Date.now(),
        conversation: {
          conversationId: requestConversation.id,
          turnIndex: requestConversation.turnIndex,
          originalText: requestConversation.originalText,
          proposalText: hadCurrentProposal
            ? requestConversation.currentProposalText ?? undefined
            : undefined,
          revisionHistory: requestConversation.revisionHistory,
        } satisfies LocalAssistConversationRequest,
      });
      const submission = { requestId, promise: requestAppleAssistProposal(payload) };
      submissionRef.current = submission;
      await submission.promise;
      if (activeRequestIdRef.current !== requestId) return;
      setStatus(copy.generatingInMain(payload.request));
    } catch (err: unknown) {
      if (activeRequestIdRef.current !== requestId) return;
      clearGenerationFallback();
      setBusy(false);
      setActiveRequestId(null);
      activeRequestIdRef.current = null;
      activeActionIdRef.current = null;
      setStreamPreview("");
      setStreamOriginalText("");
      if (createdConversation) {
        conversationRef.current = previousConversation;
        setConversation(previousConversation);
      }
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
    modelSwitching,
    probed,
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

  // Cancel by request id through main's ownership guard, never by killing
  // whichever native helper happens to be running when this click arrives.
  const cancelGeneration = useCallback(async () => {
    const requestId = activeRequestIdRef.current;
    if (!busy || cancelling || !requestId) return;
    cancellingRequestIdRef.current = requestId;
    setCancelling(true);
    setStreamPreview("");
    setStatus(copy.cancellingStatus);
    const submission = submissionRef.current;
    if (submission?.requestId !== requestId) {
      // Still acquiring the initial target: no request has reached main.
      activeRequestIdRef.current = null;
      setActiveRequestId(null);
      setBusy(false);
      cancellingRequestIdRef.current = null;
      setCancelling(false);
      clearGenerationFallback();
      setStatus(copy.cancelledStatus);
      pushFeedback({ kind: "cancelled" });
      return;
    }
    try {
      // Ensure the request was forwarded before its cancellation event.
      await submission.promise;
      if (activeRequestIdRef.current === requestId) await cancelAppleAssistProposal(requestId);
    } catch (err) {
      if (activeRequestIdRef.current !== requestId) return;
      cancellingRequestIdRef.current = null;
      setCancelling(false);
      setError(classifyApplyError(err, copy));
    }
  }, [busy, cancelling, copy, clearGenerationFallback, pushFeedback]);

  useEffect(() => {
    if (!isTauriEventAvailable()) return;
    let disposed = false;
    const subscription = listen<LocalAssistReviewResult>(LOCAL_ASSIST_REVIEW_RESULT_EVENT, ({ payload }) => {
      if (disposed || !matchesReviewNavigation(reviewNavigationRef.current, payload)) return;
      reviewNavigationRef.current = null;
      setReviewNavigation(null);
      if (matchesReviewIdentity(reviewIdentityRef.current, payload) &&
          conversationRef.current?.id === payload.conversationId) setReviewUnavailable(!payload.accepted);
    }).catch(() => null);
    return () => { disposed = true; void subscription.then((unlisten) => unlisten?.()); };
  }, []);
  useEffect(() => {
    if (!reviewNavigation) return;
    const timer = setTimeout(() => {
      if (reviewNavigationRef.current !== reviewNavigation) return;
      reviewNavigationRef.current = null;
      setReviewNavigation(null);
      setReviewUnavailable(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [reviewNavigation]);
  const openReview = async () => {
    const identity = reviewIdentityRef.current;
    if (busy || reviewNavigationRef.current || !identity || conversationRef.current?.id !== identity.conversationId) return;
    const attempt = { ...identity, navigationId: crypto.randomUUID() };
    reviewNavigationRef.current = attempt;
    setReviewNavigation(attempt); setReviewUnavailable(false);
    try { await requestLocalAssistReview(attempt); }
    catch {
      if (reviewNavigationRef.current !== attempt) return;
      reviewNavigationRef.current = null; setReviewNavigation(null); setReviewUnavailable(true);
    }
  };

  const chatItems = [
    ...sentRequests.map((entry) => ({ ...entry, role: "user" as const, kind: undefined })),
    ...feedback.filter((entry) => !["ready", "unavailable", "target-acquired", "request-sent", "generation-started"].includes(entry.kind))
      .map((entry) => ({ id: entry.id, at: entry.at, role: "assistant" as const, kind: entry.kind,
        text: copy.feedbackEntry(entry.kind, entry.payload) })),
  ].sort((left, right) => left.at - right.at).slice(-48);

  return (
    <div className="apple-assist-window-shell" data-testid="apple-assist-shell">
      <header className="apple-assist-window-header">
        {/* Keep the target visible; expanded help retains the processing and apply/save boundary. */}
        {conversation || !available || modelSwitching ? <div className="apple-assist-window-toolbar">
          {/* Keep failures visible outside collapsed help, with no reserved ready-state panel. */}
          {!available || modelSwitching ? <p className="apple-assist-model-status"
            id="apple-assist-availability" role="status">
            {modelSwitching || !probed ? <span className="apple-assist-window-spinner" aria-hidden="true" /> : null}
            <span>{modelSwitching ? ui.switching : !probed ? ui.checking : availabilityMessage}</span>
          </p> : null}
          {conversation ? <button type="button" className="apple-assist-window-new-conversation" disabled={busy}
            onClick={() => {
              setConversation(null); conversationRef.current = null;
              clearReviewNavigation();
              reviewIdentityRef.current = null; setReviewIdentity(null);
              setStreamPreview(""); setStreamOriginalText(""); setError(null);
              setSentRequests([]); clearFeedback(); setStatus(copy.newConversationStatus);
            }}>{copy.newConversationButton}</button> : null}
        </div> : null}
        <details className="apple-assist-target-details">
          <summary>
            <span className="sr-only">{ui.target}: </span>
            <span className="apple-assist-target-file">
              <span aria-hidden="true"><TextFileIcon /></span>
              <span className="apple-assist-target-name" lang={displayedTarget?.activeDocumentName ? DOCUMENT_CONTENT_LANG : undefined}>
                {displayedTarget?.activeDocumentName || ui.noDocument}
              </span>
            </span>
            <span className="apple-assist-target-meta">
              {displayedTarget ? <span className="apple-assist-target-scope">
                {ui.scope[displayedTarget.kind]} · {ui.characters(displayedTarget.text.length)}
              </span> : null}
              {conversation ? <span className="apple-assist-target-pinned" data-testid="apple-assist-conversation-state">{ui.pinned}</span> : null}
              <span className="apple-assist-target-chevron" aria-hidden="true"><ChevronIcon expanded={false} /></span>
            </span>
          </summary>
          <div className="apple-assist-window-target" data-testid="apple-assist-target">
            <p className="apple-assist-window-target-summary">{renderTargetSummary(displayedTarget, copy)}</p>
            {displayedTarget?.text ? <p className="apple-assist-window-target-excerpt" lang={DOCUMENT_CONTENT_LANG}>{appleAssistTargetExcerpt(displayedTarget.text)}</p> : null}
          </div>
        </details>
        <details className="apple-assist-help">
          <summary>{ui.details}</summary>
          <p>{copy.availableDisclosure}</p>
          {!available ? <p>{availabilityMessage}</p> : null}
        </details>
      </header>

      <div className="apple-assist-chat" ref={feedbackSectionRef} role="log" aria-label={ui.chat}
        aria-live="polite" aria-relevant="additions text" data-testid="apple-assist-feedback-section"
        onScroll={(event) => {
          const element = event.currentTarget;
          followChatRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
        }}>
        {chatItems.length ? <AssistConversationMessages items={chatItems} emptyText={ui.empty} /> : null}
        {reviewIdentity && conversation?.id === reviewIdentity.conversationId ?
          <div className="apple-assist-review-link">
            <button type="button" className="apple-assist-review-button" disabled={busy || reviewPending}
              onClick={() => void openReview()}><span aria-hidden="true"><DiffIcon /></span>{reviewPending ? ui.reviewOpening : ui.review}</button>
            {reviewUnavailable ? <p role="status">{ui.reviewUnavailable}</p> : null}
          </div> : null}
        {!cancelling && (busy || streamPreview) ? <StreamPreview busy={busy} copy={copy} streamPreview={streamPreview} /> : null}
        {busy ? <div className="apple-assist-window-progress" role="status"><span className="apple-assist-window-spinner" aria-hidden="true" />{status}</div> : null}
        {error ? <div className="apple-assist-window-error" role="alert">{error}</div> : null}
      </div>

      <section className="apple-assist-window-form" aria-label={copy.roughRequestLabel}>
        <div className="apple-assist-presets-list" role="group" aria-label={copy.presetsLabel}>{copy.presets.map((preset) =>
            <button key={preset.actionId} type="button" className="apple-assist-preset" aria-pressed={selectedActionId === preset.actionId && requestText === preset.requestText}
              onClick={() => onPickPreset(preset)} disabled={busy || modelSwitching || !available}>{preset.label}</button>
        )}</div>
        <div className="apple-assist-composer">
          <label htmlFor="apple-assist-rough-request" className="apple-assist-window-label">{ui.composer}</label>
          <textarea id="apple-assist-rough-request" className="apple-assist-window-textarea"
            lang={DOCUMENT_CONTENT_LANG}
            aria-describedby={available && !modelSwitching ? undefined : "apple-assist-availability"}
            value={requestText} onChange={(event) => { setRequestText(event.target.value); setError(null); }}
            rows={3} placeholder={copy.placeholder} disabled={busy || modelSwitching || !available}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault(); if (!busy) void applyRoughRequest();
              }
            }} />
          <div className="apple-assist-window-actions">
            <AssistModelPicker language={menuLanguage}
              disabled={busy || modelSwitching || !probed || Boolean(modelCatalog.managementError) || Boolean(modelCatalog.selectionLocked)}
              modelId={availability.modelId ?? modelCatalog.selectedModelId}
              models={modelCatalog.models} onSelect={selectModel}
              onManage={() => openLocalAssistModelSettings().catch((reason) => {
                setError(reason instanceof Error ? reason.message : String(reason));
              })} />
            <button type="button" className="apple-assist-window-apply"
              onClick={() => { if (busy) void cancelGeneration(); else void applyRoughRequest(); }}
              disabled={busy ? cancelling : modelSwitching || !available || requestText.trim().length === 0}>
              {busy ? (cancelling ? copy.cancellingStatus : copy.cancelButton) : copy.applyButton}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

type StreamPreviewProps = {
  streamPreview: string;
  busy: boolean;
  copy: AppleAssistWindowCopy;
};

// v2.6 B2: the detached window keeps only the in-progress draft preview. The
// authoritative original-vs-proposal Diff and the Apply/Discard actions now
// live in the main window (`LocalAssistProposalReview`).
function StreamPreview({ streamPreview, busy, copy }: StreamPreviewProps) {
  const presentation = getStreamPreviewPresentation(streamPreview, busy, copy);
  return (
    <section
      className="apple-assist-window-stream-preview"
      aria-label={copy.streamPreviewHeading}
      data-testid="apple-assist-stream-preview"
    >
      <p className="apple-assist-stream-preview-heading">
        {copy.streamPreviewHeading}
      </p>
      {presentation.kind === "content" ? (
        <p
          className="apple-assist-stream-preview-body"
          data-testid="apple-assist-stream-preview-body"
          lang={DOCUMENT_CONTENT_LANG}
        >
          {presentation.text}
        </p>
      ) : (
        <p className="apple-assist-stream-preview-placeholder">
          {presentation.text}
        </p>
      )}
    </section>
  );
}


// Lifecycle event kinds for the v0.17 operation-feedback
// panel. The component keeps the list bounded, in window
// state only, and never persists entries to disk, logs,
// diagnostics, or Support Diagnostics.


export type ApplyStatusPresentation = {
  status: string;
  error: string | null;
  feedbackKind: Extract<
    OperationFeedbackKind,
    "applied" | "cancelled" | "failed"
  >;
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
      feedbackKind: "cancelled",
    };
  }

  if (payload.phase === "discarded") {
    return {
      status: copy.proposalDiscardedStatus,
      error: null,
      feedbackKind: "cancelled",
    };
  }

  return {
    status: copy.failedStatus,
    error: classifyApplyError(payload.message, copy),
    feedbackKind: "failed",
  };
}

export type ProposalStatusPresentation = {
  status: string;
  error: string | null;
  feedbackKind: Extract<
    OperationFeedbackKind,
    "proposal-ready" | "cancelled" | "failed"
  >;
};

export function getProposalStatusPresentation(
  payload: AppleAssistProposalStatusEvent,
  copy: AppleAssistWindowCopy,
): ProposalStatusPresentation {
  if (payload.phase === "completed") {
    return {
      status: copy.proposalReadyStatus,
      error: null,
      feedbackKind: "proposal-ready",
    };
  }

  if (payload.phase === "cancelled") {
    return {
      status: copy.cancelledStatus,
      error: null,
      feedbackKind: "cancelled",
    };
  }

  return {
    status: copy.failedStatus,
    error: classifyApplyError(payload.message, copy),
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
  // Suppress the entire partial instead of trying to reconstruct model text.
  // Final candidate validation and exact Diff review remain separate.
  if (/HAZAKURA_(?:TEXT|CONTEXT|ORIGINAL)_(?:START|END)/u.test(rawPreview)) return "";
  return rawPreview.trim();
}

export function renderAvailabilityMessage(
  availability: AppleAssistAvailability,
  probed: boolean,
  copy: AppleAssistWindowCopy,
): string {
  if (!probed) {
    return copy.checkingAvailabilityStatus;
  }
  if (availability.kind === "available") {
    return copy.availableDisclosure;
  }
  if (availability.kind === "unavailable") {
    if (availability.modelId === "apple:core-ai:qwen3-0.6b-test") {
      return copy.localCoreAITestUnavailable(availability.reason);
    }
    if (availability.modelId?.startsWith("local:external:")) {
      return copy.externalFolderUnavailable;
    }
    if (availability.modelId?.startsWith("local:") || availability.modelId?.startsWith("apple:core-ai:")) {
      return copy.coreAIModelUnavailable;
    }
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

  switch (classifyLocalAssistError(err)) {
    // 生成案そのものの長さ超過と、追加依頼で継続した結果の上限超過（R5）。
    // どちらも利用者が次に取る操作は同じ（短い案を依頼する／対象を小さくする）ので、
    // 既存の文言（継続上限の説明を含む）へ寄せる。
    case "proposal":
    case "continuation": return copy.proposalTooLongError;
    case "format": return copy.proposalFormatError;
    case "selection": return copy.selectionTooLongError;
    case "context": return copy.contextTooLongError;
    case "model-context": return copy.modelContextTooLongError;
    case "stale": return copy.targetStaleError;
    case "guardrail": return copy.guardrailError;
    case "throttled": return copy.throttledError;
    case "unavailable": return copy.modelUnavailableError;
    case "language": return copy.modelLanguageError;
    case "timeout": return copy.generationTimeoutError;
    case "cancelled": return copy.cancelledStatus;
    case "unknown": break;
  }
  return copy.unknownError(raw);
}
