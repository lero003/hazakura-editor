import React, { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getMainAppleAssistTarget,
  requestApplyAiEditTransaction,
  setAppleAssistWindowTheme,
} from "../../lib/tauri";
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
import type { AppleAssistAvailability } from "../../lib/tauri/appleAssist";
import {
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
  THEME_STORAGE_KEY,
  type AppleAssistApplyEvent,
  type AppleAssistTargetSnapshot,
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
// "Apply" to emit `APPLY_AI_EDIT_TRANSACTION_EVENT` to the main
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
//     common rough requests,
//   - a "Refresh document" affordance to re-pull the active
//     tab from the main window.
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

const ROUGH_REQUEST_PRESETS: { id: string; label: string; prompt: string }[] =
  [
    { id: "tidy", label: "整えて", prompt: "整えて" },
    { id: "natural", label: "自然にして", prompt: "自然にして" },
    { id: "continue", label: "続きを書いて", prompt: "続きを書いて" },
    { id: "proofread", label: "校正して", prompt: "校正して" },
    { id: "rewrite-section", label: "この章を直して", prompt: "この章を直して" },
  ];

function readInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return (stored as ThemePreference) ?? "dark";
}

export function AppleAssistWindowApp() {
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);
  const [roughRequest, setRoughRequest] = useState<string>("");
  const [status, setStatus] = useState<string>(
    "Ready. Changes are generated in the main editor and kept unsaved.",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [target, setTarget] = useState<AppleAssistTargetSnapshot | null>(null);
  const { availability, available } = useAppleAssistAvailability();
  const availabilityMessage = renderAvailabilityMessage(availability);

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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && event.newValue) {
        setTheme(event.newValue as ThemePreference);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
      })
      .catch((err) => {
        console.warn("Failed to read initial apple assist target", err);
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
      setError("Type a rough request first.");
      return;
    }
    if (!isTauriEventAvailable()) {
      setError(
        "Apple Assist window is running outside the Tauri runtime; cannot reach the main window.",
      );
      return;
    }
    if (!available) {
      setError(availabilityMessage);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Re-read the latest target snapshot at the moment of
      // apply — the cached one might be stale by a few
      // hundred ms. The main window is still free to
      // re-infer from its own state, but the payload
      // carries the user's expectation.
      const latestTarget =
        (await getMainAppleAssistTarget().catch(() => null)) ?? target;
      const payload: AppleAssistApplyEvent = {
        request,
        requestedAtMs: Date.now(),
        target: latestTarget,
      };
      await requestApplyAiEditTransaction(payload);
      setStatus(`Sent rough request: ${request}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [available, availabilityMessage, roughRequest, target]);

  const onPickPreset = useCallback((prompt: string) => {
    setRoughRequest(prompt);
    setError(null);
  }, []);

  return (
    <div className="apple-assist-window-shell" data-testid="apple-assist-shell">
      <header className="apple-assist-window-header">
        <div className="apple-assist-window-title">Apple Assist</div>
        <div className="apple-assist-window-subtitle">
          Writing Companion
          <span className="apple-assist-window-mode">Local</span>
        </div>
        <div className="apple-assist-window-disclosure">
          {available
            ? "Uses Apple Foundation Models when available on this Mac."
            : availabilityMessage}
        </div>
        <div className="apple-assist-window-doc">
          {target?.activeDocumentName
            ? `Active: ${target.activeDocumentName}`
            : "No active document detected yet."}
        </div>
        <div className="apple-assist-window-target" data-testid="apple-assist-target">
          {renderTargetSummary(target)}
        </div>
      </header>

      <section className="apple-assist-window-presets" aria-label="Rough request presets">
        {ROUGH_REQUEST_PRESETS.map((preset) => (
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
      </section>

      <section className="apple-assist-window-form" aria-label="Rough request">
        <label
          htmlFor="apple-assist-rough-request"
          className="apple-assist-window-label"
        >
          Rough request
        </label>
        <textarea
          id="apple-assist-rough-request"
          className="apple-assist-window-textarea"
          value={roughRequest}
          onChange={(event) => {
            setRoughRequest(event.target.value);
            setError(null);
          }}
          rows={6}
          placeholder="整えて / 自然にして / 続きを書いて / 校正して / この章を直して"
          disabled={busy || !available}
        />
        <button
          type="button"
          className="apple-assist-window-apply"
          onClick={() => void applyRoughRequest()}
          disabled={busy || !available || roughRequest.trim().length === 0}
        >
          {busy ? "Sending…" : "Apply"}
        </button>
      </section>

      <footer className="apple-assist-window-footer">
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

function renderAvailabilityMessage(availability: AppleAssistAvailability): string {
  if (availability.kind === "available") {
    return "Apple Assist is available.";
  }
  if (availability.kind === "unavailable") {
    return `Apple Assist is not available for the current app language or runtime: ${availability.reason}`;
  }
  if (availability.kind === "disabled") {
    return "Apple Assist is disabled in this app session.";
  }
  return "Apple Assist is not available for the current app language or runtime.";
}

function isTauriEventAvailable(): boolean {
  return Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}

function renderTargetSummary(
  target: AppleAssistTargetSnapshot | null,
): string {
  if (!target) {
    return "No active target.";
  }
  if (target.kind === "selection") {
    return `Apply to selection (${target.text.length} chars)`;
  }
  if (target.kind === "paragraph") {
    return `Apply to paragraph (${target.text.length} chars)`;
  }
  if (target.kind === "block") {
    return target.label
      ? `Apply to ${target.label}`
      : `Apply to code block (${target.text.length} chars)`;
  }
  if (target.kind === "section") {
    return target.label
      ? `Apply to ${target.label}`
      : `Apply to section (${target.text.length} chars)`;
  }
  return `Apply to whole document (${target.text.length} chars)`;
}
