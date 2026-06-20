import { afterEach, describe, expect, it } from "vitest";
import {
  assertNoForbiddenKeys,
  collectDiagnostics,
  DIAGNOSTICS_FORBIDDEN_KEYS,
  type DiagnosticsSnapshot,
} from "./diagnostics";

import { vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

function basicOptions() {
  return {
    appleLocalAssistAvailable: true,
    autoBackupEnabled: true,
    lModeEnabled: false,
    wrapLines: true,
    theme: "dark",
    recentErrorCategories: ["Save conflict", "Metadata check failed"],
  };
}

function assertSnapshotShape(snapshot: DiagnosticsSnapshot) {
  // app identity
  expect(typeof snapshot.app.version).toBe("string");
  expect(snapshot.app.version.length).toBeGreaterThan(0);
  expect(
    snapshot.app.distributionLane === "developer" ||
      snapshot.app.distributionLane === "app-store",
  ).toBe(true);

  // system
  expect(typeof snapshot.system.platform).toBe("string");

  // features
  expect(typeof snapshot.features.appleLocalAssistAvailable).toBe("boolean");
  expect(typeof snapshot.features.autoBackupEnabled).toBe("boolean");
  expect(typeof snapshot.features.lModeEnabled).toBe("boolean");
  expect(typeof snapshot.features.wrapLines).toBe("boolean");
  expect(typeof snapshot.features.theme).toBe("string");

  // errors
  expect(Array.isArray(snapshot.errors.recentCategories)).toBe(true);

  // timestamp
  expect(typeof snapshot.collectedAtMs).toBe("number");
  expect(snapshot.collectedAtMs).toBeGreaterThan(0);
}

describe("collectDiagnostics", () => {
  it("produces a well-shaped snapshot with the selected inputs", () => {
    const snapshot = collectDiagnostics(basicOptions());

    assertSnapshotShape(snapshot);

    expect(snapshot.features.appleLocalAssistAvailable).toBe(true);
    expect(snapshot.features.autoBackupEnabled).toBe(true);
    expect(snapshot.features.lModeEnabled).toBe(false);
    expect(snapshot.features.wrapLines).toBe(true);
    expect(snapshot.features.theme).toBe("dark");

    expect(snapshot.errors.recentCategories).toEqual([
      "Save conflict",
      "Metadata check failed",
    ]);
  });

  it("caps and sanitises recent error categories", () => {
    const snapshot = collectDiagnostics({
      ...basicOptions(),
      recentErrorCategories: [
        "Save conflict",
        "Save failed",
        "Close stopped",
        "Metadata check failed",
        "Export EPUB beta failed",
        "Export HTML failed",
        "External change detected",
        "Reopen failed",
      ],
    });

    // All 8 entries are known-safe, but only the last 5
    // survive the cap.
    expect(snapshot.errors.recentCategories).toEqual([
      "Metadata check failed",
      "Export EPUB beta failed",
      "Export HTML failed",
      "External change detected",
      "Reopen failed",
    ]);
  });

  it("folds unknown or path-like error categories to Other", () => {
    const snapshot = collectDiagnostics({
      ...basicOptions(),
      recentErrorCategories: [
        "Save failed: /Users/me/note.md",
        "token=abc123",
        "Secret leaked",
        "metadata check failed",
        "Save conflict",
      ],
    });

    // Known-good tags survive; unknown / path-bearing /
    // secret-looking strings are folded to "Other".
    expect(snapshot.errors.recentCategories).toEqual([
      "Other",
      "Other",
      "Other",
      "Other",
      "Save conflict",
    ]);
  });

  it("reflects the distribution lane read from the environment", () => {
    vi.stubEnv("VITE_HAZAKURA_DISTRIBUTION_LANE", "app-store");
    const snapshot = collectDiagnostics(basicOptions());

    expect(snapshot.app.distributionLane).toBe("app-store");
    expect(snapshot.app.version).toBe("0.18.0");
  });

  it("excludes document contents, workspace paths, and secret-looking keys", () => {
    const snapshot = collectDiagnostics(basicOptions());
    const json = JSON.stringify(snapshot);

    for (const key of DIAGNOSTICS_FORBIDDEN_KEYS) {
      expect(json).not.toContain(key);
    }

    expect(json).not.toMatch(/"[A-Za-z]:[/\\]/);
  });
});

describe("assertNoForbiddenKeys", () => {
  it("does not throw for a well-formed snapshot", () => {
    const snapshot = collectDiagnostics(basicOptions());
    expect(() => assertNoForbiddenKeys(snapshot)).not.toThrow();
    expect(() =>
      assertNoForbiddenKeys(snapshot as unknown as Record<string, unknown>),
    ).not.toThrow();
  });

  it("throws when a forbidden key is present at the top level", () => {
    const poisoned = {
      app: { version: "1.0.0" },
      workspaceRoot: "/Users/hazakura",
    };

    expect(() => assertNoForbiddenKeys(poisoned)).toThrow(
      /workspaceRoot/,
    );
  });

  it("throws when a forbidden key is nested inside an object", () => {
    const poisoned = {
      app: { version: "1.0.0" },
      preferences: {
        documentContents: "secret note",
      },
    };

    expect(() => assertNoForbiddenKeys(poisoned)).toThrow(
      /documentContents/,
    );
  });

  it("throws when a forbidden key is nested inside an array", () => {
    const poisoned = {
      errors: [
        { hint: "ok" },
        { workspaceRoot: "/Users/hazakura" },
      ],
    };

    expect(() => assertNoForbiddenKeys(poisoned)).toThrow(
      /workspaceRoot/,
    );
  });

  it("throws when an absolute-path-looking string appears", () => {
    const poisoned = {
      app: { version: "1.0.0" },
      hint: "/Users/hazakura/workspace/notes/today.md",
    };

    expect(() => assertNoForbiddenKeys(poisoned)).toThrow(
      /absolute-path/,
    );
  });
});
