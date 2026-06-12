// Tests for the v0.17 Support Diagnostics pane.
//
// The pane is the user-facing surface for the existing
// `collectDiagnostics()` helper (see `lib/diagnostics.ts`
// and its tests). The helper is the single point where
// data enters the snapshot, and it is paired with
// `assertNoForbiddenKeys()` so any future regression that
// bleeds document contents, file paths, or secret-looking
// values fails the pane at the structural-check stage
// before the JSON is shown or copied.
//
// The tests below pin:
// - the help-doc chrome (kicker / boundary card / footer)
//   is rendered around the diagnostics body,
// - the rendered JSON contains the live editor settings
//   (auto-backup, L Mode, wrap, theme, Apple Local
//   Assist availability) without forbidden keys or
//   absolute-path-looking strings,
// - the Copy button routes the JSON to the optional
//   `onCopy` override (jsdom has no `navigator.clipboard`),
// - the Refresh button re-derives the snapshot so the
//   `collectedAtMs` timestamp changes,
// - the pane degrades safely when the safety check throws.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DiagnosticsPane } from "./DiagnosticsPane";
import { supportDiagnostics } from "./helpDocs";
import {
  DIAGNOSTICS_FORBIDDEN_KEYS,
  type DiagnosticsSnapshot,
} from "../../lib/diagnostics";

afterEach(() => {
  cleanup();
});

function renderPane(overrides: {
  appleLocalAssistAvailable?: boolean;
  autoBackupEnabled?: boolean;
  lModeEnabled?: boolean;
  wrapLines?: boolean;
  theme?: string;
  onCopy?: (text: string) => void;
  forceSafetyCheckFailure?: boolean;
  onOpenExternalLink?: (href: string) => void;
} = {}) {
  return render(
    <DiagnosticsPane
      appleLocalAssistAvailable={
        overrides.appleLocalAssistAvailable ?? false
      }
      autoBackupEnabled={overrides.autoBackupEnabled ?? true}
      forceSafetyCheckFailure={overrides.forceSafetyCheckFailure ?? false}
      lModeEnabled={overrides.lModeEnabled ?? false}
      onCopy={overrides.onCopy}
      onOpenExternalLink={overrides.onOpenExternalLink}
      theme={overrides.theme ?? "dark"}
      wrapLines={overrides.wrapLines ?? true}
    />,
  );
}

function getJson(): string {
  const node = screen.getByTestId("diagnostics-pane-json");
  return node.textContent ?? "";
}

function parseJson(): DiagnosticsSnapshot {
  const text = getJson();
  return JSON.parse(text) as DiagnosticsSnapshot;
}

describe("DiagnosticsPane", () => {
  beforeEach(() => {
    // Use fake timers only for Date so the snapshot
    // timestamp is stable and the Refresh-button test
    // can prove the timestamp changed. Real timers are
    // kept for everything else (state updates, event
    // listeners) so the Copy click test can complete
    // without a fake-timer drain.
    vi.useFakeTimers({
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the help-doc chrome around the diagnostics body", () => {
    renderPane();
    expect(screen.getByTestId("help-doc-kicker").textContent).toBe(
      supportDiagnostics.kicker,
    );
    expect(screen.getByTestId("help-doc-boundary-note").textContent).toContain(
      supportDiagnostics.boundaryNoteTitle,
    );
    expect(screen.getByTestId("help-doc-footer-note").textContent).toBe(
      supportDiagnostics.footerNote,
    );
    const body = screen.getByTestId("help-doc-body");
    expect(body.querySelector("h1")?.textContent).toBe(
      supportDiagnostics.title,
    );
  });

  it("makes the diagnostics scroll region keyboard reachable", () => {
    renderPane();

    const scrollRegion = screen.getByRole("region", {
      name: `Scrollable Help document: ${supportDiagnostics.title}`,
    });
    expect(scrollRegion.getAttribute("tabindex")).toBe("0");
    expect(scrollRegion.contains(screen.getByTestId("help-doc-body"))).toBe(
      true,
    );
    expect(
      scrollRegion.contains(screen.getByTestId("diagnostics-pane-json")),
    ).toBe(true);
  });

  it("routes Support Diagnostics intro links externally without app WebView navigation", () => {
    const onOpenExternalLink = vi.fn();
    renderPane({ onOpenExternalLink });

    const body = screen.getByTestId("help-doc-body");
    const link = body.querySelector("a[href]");
    expect(link).toBeInstanceOf(HTMLAnchorElement);

    const href = link?.getAttribute("href") ?? "";
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const clickResult = link?.dispatchEvent(event);

    expect(clickResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenExternalLink).toHaveBeenCalledWith(href);
  });

  it("reflects the live editor settings inside the JSON snapshot", () => {
    renderPane({
      appleLocalAssistAvailable: true,
      autoBackupEnabled: true,
      lModeEnabled: true,
      wrapLines: false,
      theme: "sakura",
    });
    const json = parseJson();
    expect(json.app.version).toBe("0.18.0");
    expect(json.app.distributionLane).toBeTruthy();
    expect(json.features.appleLocalAssistAvailable).toBe(true);
    expect(json.features.autoBackupEnabled).toBe(true);
    expect(json.features.lModeEnabled).toBe(true);
    expect(json.features.wrapLines).toBe(false);
    expect(json.features.theme).toBe("sakura");
    expect(json.errors.recentCategories).toEqual([]);
    expect(typeof json.collectedAtMs).toBe("number");
  });

  it("never includes document contents, workspace paths, or secret-looking keys", () => {
    renderPane();
    const json = getJson();
    for (const key of DIAGNOSTICS_FORBIDDEN_KEYS) {
      expect(json).not.toContain(`"${key}"`);
    }
    // The serialised JSON must not contain absolute-path-
    // looking strings either. A future regression that
    // adds, say, a `workingDirectory` field fails here.
    expect(json).not.toMatch(/"[A-Za-z]:[/\\][^"]+"/);
    expect(json).not.toMatch(/"\/Users\/[^"]+"/);
  });

  it("routes the JSON to the onCopy override when Copy is clicked", async () => {
    const onCopy = vi.fn();
    renderPane({ onCopy });
    const button = screen.getByTestId("diagnostics-pane-copy");
    fireEvent.click(button);
    await waitFor(() => {
      expect(onCopy).toHaveBeenCalledTimes(1);
    });
    const text = onCopy.mock.calls[0]?.[0] ?? "";
    expect(text.length).toBeGreaterThan(0);
    const parsed = JSON.parse(text);
    expect(parsed.app.version).toBe("0.18.0");
    expect(button.textContent).toBe("Copied");
  });

  it("keeps the Copy button enabled when the snapshot is well-formed", () => {
    renderPane();
    const button = screen.getByTestId(
      "diagnostics-pane-copy",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("rebuilds the snapshot when Refresh is clicked", () => {
    renderPane();
    const before = parseJson().collectedAtMs;

    // Advance time so the new snapshot has a strictly
    // larger `collectedAtMs` than the first.
    vi.setSystemTime(new Date("2026-06-09T00:00:05Z"));
    const refresh = screen.getByTestId("diagnostics-pane-refresh");
    fireEvent.click(refresh);

    const after = parseJson().collectedAtMs;
    expect(after).toBeGreaterThan(before);
  });

  it("renders an unavailable message when the safety check throws", () => {
    // Suppress the expected console.error from the
    // catch block so the test output stays clean.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderPane({ forceSafetyCheckFailure: true });
      const json = screen.getByTestId("diagnostics-pane-json");
      expect(json.textContent).toBe("Snapshot unavailable.");
      const copy = screen.getByTestId(
        "diagnostics-pane-copy",
      ) as HTMLButtonElement;
      const refresh = screen.getByTestId(
        "diagnostics-pane-refresh",
      ) as HTMLButtonElement;
      expect(copy.disabled).toBe(true);
      expect(refresh.disabled).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
