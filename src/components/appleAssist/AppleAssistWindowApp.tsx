import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  getMainAppleAssistTarget,
  requestApplyAiEditTransaction,
  setAppleAssistWindowTheme,
} from "../../lib/tauri";
import { useAppleAssistAvailability } from "../../hooks/agent/useAppleAssistAvailability";
import type { AppleAssistAvailability } from "../../lib/tauri/appleAssist";
import {
  APPLE_ASSIST_APPLY_STATUS_EVENT,
  MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT,
  MENU_LANGUAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type AppleAssistApplyEvent,
  type AppleAssistApplyStatusEvent,
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

const APPLE_ASSIST_GENERATION_FALLBACK_MS = 365_000;

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
  const { availability, available } = useAppleAssistAvailability();
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
      const payload: AppleAssistApplyEvent = {
        request,
        requestedAtMs: Date.now(),
        target: latestTarget,
      };
      await requestApplyAiEditTransaction(payload);
      setStatus(copy.generatingInMain(request));
    } catch (err: unknown) {
      clearGenerationFallback();
      setBusy(false);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [
    available,
    availabilityMessage,
    clearGenerationFallback,
    copy,
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
        <div className="apple-assist-window-title">Apple Assist</div>
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

      <section className="apple-assist-window-presets" aria-label={copy.presetsLabel}>
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
      </section>

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
          rows={6}
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

type AppleAssistWindowCopy = {
  activeDocument: (name: string) => string;
  appliedStatus: (request: string) => string;
  applyButton: string;
  availableDisclosure: string;
  disabledStatus: string;
  emptyRequestError: string;
  generatingButton: string;
  generatingChange: string;
  generatingInMain: (request: string) => string;
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
  sendingRequest: string;
  subtitle: string;
  tauriUnavailableError: string;
  targetBlock: (chars: number) => string;
  targetDocument: (chars: number) => string;
  targetLabel: (label: string) => string;
  targetParagraph: (chars: number) => string;
  targetSection: (chars: number) => string;
  targetSelection: (chars: number) => string;
  unsupportedStatus: string;
  workingLocally: string;
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

function getAppleAssistWindowCopy(lang: MenuLanguage): AppleAssistWindowCopy {
  if (lang === "kana") {
    return {
      activeDocument: (name) => `いまのふみ: ${name}`,
      appliedStatus: (request) => `Apple Assist が かへました: ${request}`,
      applyButton: "つかう",
      availableDisclosure:
        "この Mac の Apple Foundation Models を つかひます。",
      disabledStatus: "Apple Assist は このせっしょんで むこうです。",
      emptyRequestError: "おねがひを かいてください。",
      generatingButton: "つくっています...",
      generatingChange: "Apple Assist が かきかへを つくっています...",
      generatingInMain: (request) => `ほんぶんで つくっています: ${request}`,
      localRuntimeUnavailable: (reason) =>
        `Apple Assist は いま つかへません: ${reason}`,
      longRunningStatus:
        "Apple Assist が まだ かんがへています。まってもよいし、ほんぶんがはの じょうたいを みてもよいです。",
      modeLabel: "ろーかる",
      noActiveDocument: "ひらいている ふみが まだ みつかりません。",
      noTarget: "たいしょうが ありません。",
      placeholder: "整えて / 自然にして / 続きを書いて / 校正して / この章を直して",
      presets: [
        { id: "tidy", label: "ととのえて", prompt: "整えて" },
        { id: "natural", label: "しぜんに", prompt: "自然にして" },
        { id: "continue", label: "つづきを", prompt: "続きを書いて" },
        { id: "proofread", label: "こうせい", prompt: "校正して" },
        { id: "rewrite-section", label: "このしょうを", prompt: "この章を直して" },
      ],
      presetsLabel: "ざっくりした おねがひ",
      readyStatus: "じゅんびできました。かへたところは ほぞんせず、ほんぶんに のこします。",
      roughRequestLabel: "おねがひ",
      sendingRequest: "ほんぶんがはへ おねがひを おくっています...",
      subtitle: "かくための あしすと",
      targetBlock: (chars) => `ぶろっくに つかふ (${chars} もじ)`,
      targetDocument: (chars) => `ふみぜんたいに つかふ (${chars} もじ)`,
      targetLabel: (label) => `${label} に つかふ`,
      targetParagraph: (chars) => `だんらくに つかふ (${chars} もじ)`,
      targetSection: (chars) => `しょうに つかふ (${chars} もじ)`,
      targetSelection: (chars) => `えらんだところに つかふ (${chars} もじ)`,
      tauriUnavailableError:
        "Apple Assist window が Tauri runtime のそとで うごいています。",
      unsupportedStatus:
        "Apple Assist は いまの ことば または うごくばしょでは つかへません。",
      workingLocally: "この Mac で さぎょうちゅう",
    };
  }

  if (lang === "ja") {
    return {
      activeDocument: (name) => `対象: ${name}`,
      appliedStatus: (request) => `Apple Assist が本文を変更しました: ${request}`,
      applyButton: "適用",
      availableDisclosure:
        "この Mac の Apple Foundation Models を使います。",
      disabledStatus: "Apple Assist はこのセッションでは無効です。",
      emptyRequestError: "依頼文を入力してください。",
      generatingButton: "生成中...",
      generatingChange: "Apple Assist が変更案を生成しています...",
      generatingInMain: (request) => `本文側で生成中: ${request}`,
      localRuntimeUnavailable: (reason) =>
        `Apple Assist は現在使えません: ${reason}`,
      longRunningStatus:
        "Apple Assist の応答に時間がかかっています。待つか、メインエディタ側の状態を確認してください。",
      modeLabel: "ローカル",
      noActiveDocument: "対象の文書がまだ見つかりません。",
      noTarget: "対象がありません。",
      placeholder: "整えて / 自然にして / 続きを書いて / 校正して / この章を直して",
      presets: [
        { id: "tidy", label: "整えて", prompt: "整えて" },
        { id: "natural", label: "自然にして", prompt: "自然にして" },
        { id: "continue", label: "続きを書いて", prompt: "続きを書いて" },
        { id: "proofread", label: "校正して", prompt: "校正して" },
        { id: "rewrite-section", label: "この章を直して", prompt: "この章を直して" },
      ],
      presetsLabel: "ざっくり依頼",
      readyStatus:
        "準備できました。変更はメインエディタの未保存バッファに反映されます。",
      roughRequestLabel: "依頼文",
      sendingRequest: "メインエディタへ依頼を送信しています...",
      subtitle: "執筆コンパニオン",
      targetBlock: (chars) => `ブロックに適用 (${chars} 文字)`,
      targetDocument: (chars) => `文書全体に適用 (${chars} 文字)`,
      targetLabel: (label) => `${label} に適用`,
      targetParagraph: (chars) => `段落に適用 (${chars} 文字)`,
      targetSection: (chars) => `章に適用 (${chars} 文字)`,
      targetSelection: (chars) => `選択範囲に適用 (${chars} 文字)`,
      tauriUnavailableError:
        "Apple Assist window が Tauri runtime の外で動作しています。",
      unsupportedStatus:
        "Apple Assist は現在のアプリ言語または実行環境では使えません。",
      workingLocally: "この Mac で処理中",
    };
  }

  return {
    activeDocument: (name) => `Active: ${name}`,
    appliedStatus: (request) => `Apple Assist applied: ${request}`,
    applyButton: "Apply",
    availableDisclosure:
      "Uses Apple Foundation Models when available on this Mac.",
    disabledStatus: "Apple Assist is disabled in this app session.",
    emptyRequestError: "Type a rough request first.",
    generatingButton: "Generating...",
    generatingChange: "Apple Assist is generating a change...",
    generatingInMain: (request) => `Generating in the main editor: ${request}`,
    localRuntimeUnavailable: (reason) =>
      `Apple Assist is not available for the current app language or runtime: ${reason}`,
    longRunningStatus:
      "Apple Assist is still taking a long time. You can try again or check the main editor status.",
    modeLabel: "Local",
    noActiveDocument: "No active document detected yet.",
    noTarget: "No active target.",
    placeholder:
      "Make it cleaner / Make it natural / Continue this / Proofread this / Rewrite this section",
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
    presetsLabel: "Rough request presets",
    readyStatus:
      "Ready. Changes are generated in the main editor and kept unsaved.",
    roughRequestLabel: "Rough request",
    sendingRequest: "Sending request to the main editor...",
    subtitle: "Writing Companion",
    targetBlock: (chars) => `Apply to code block (${chars} chars)`,
    targetDocument: (chars) => `Apply to whole document (${chars} chars)`,
    targetLabel: (label) => `Apply to ${label}`,
    targetParagraph: (chars) => `Apply to paragraph (${chars} chars)`,
    targetSection: (chars) => `Apply to section (${chars} chars)`,
    targetSelection: (chars) => `Apply to selection (${chars} chars)`,
    tauriUnavailableError:
      "Apple Assist window is running outside the Tauri runtime; cannot reach the main window.",
    unsupportedStatus:
      "Apple Assist is not available for the current app language or runtime.",
    workingLocally: "Working locally",
  };
}
