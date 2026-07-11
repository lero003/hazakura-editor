import { describe, expect, it } from "vitest";
import type { DraftRecord, EditorTab } from "../../types";
import {
  draftMatchesTab,
  draftRecordFromTab,
  draftStorageKey,
  isPathlessDraft,
  pruneDraftRecords,
  tabsEligibleForDraftPersistence,
  PATHLESS_DRAFT_TTL_MS,
  PATHLESS_DRAFT_MAX_CHARS,
  PATHLESS_DRAFT_STORE_MAX_RECORDS,
} from "./pathlessDraftRecovery";

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "hello",
    encoding: "utf-8",
    error: null,
    externalFingerprint: null,
    fingerprint: "",
    id: "untitled:1",
    sessionId: "session:1",
    recoveryId: "550e8400-e29b-41d4-a716-446655440010",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "untitled.md",
    path: "",
    saveStatus: "idle",
    size: 5,
    ...overrides,
  };
}

describe("pathlessDraftRecovery", () => {
  it("keys pathless drafts by recovery UUID, not session counters", () => {
    const draft: DraftRecord = {
      path: "",
      recoveryId: "550e8400-e29b-41d4-a716-446655440010",
      contents: "x",
      line_ending: "lf",
      savedFingerprint: "",
      updatedAt: Date.now(),
      name: "untitled.md",
      origin: "untitled",
    };
    expect(isPathlessDraft(draft)).toBe(true);
    expect(draftStorageKey(draft)).toBe(
      "pathless:550e8400-e29b-41d4-a716-446655440010",
    );
  });

  it("builds a pathless recovery record from tab.recoveryId", () => {
    const record = draftRecordFromTab(
      makeTab({
        contents: "# draft",
        recoveryId: "550e8400-e29b-41d4-a716-446655440011",
        name: "import-scan.md",
      }),
    );
    expect(record).toMatchObject({
      path: "",
      recoveryId: "550e8400-e29b-41d4-a716-446655440011",
      origin: "import-assist",
      contents: "# draft",
    });
  });

  it("never matches pathless drafts to path-backed tabs", () => {
    const draft = draftRecordFromTab(
      makeTab({ recoveryId: "550e8400-e29b-41d4-a716-446655440012" }),
    );
    // After relaunch, a path tab might get session:1 — must not match.
    const pathTab = makeTab({
      id: "/workspace/note.md",
      path: "/workspace/note.md",
      sessionId: "session:1",
      recoveryId: undefined,
      name: "note.md",
    });
    expect(draftMatchesTab(draft, pathTab)).toBe(false);
  });

  it("matches pathless drafts only by recoveryId on pathless tabs", () => {
    const recoveryId = "550e8400-e29b-41d4-a716-446655440013";
    const draft = draftRecordFromTab(makeTab({ recoveryId }));
    expect(
      draftMatchesTab(draft, makeTab({ recoveryId, sessionId: "session:99" })),
    ).toBe(true);
    expect(
      draftMatchesTab(
        draft,
        makeTab({
          recoveryId: "550e8400-e29b-41d4-a716-446655440099",
          sessionId: "session:1",
        }),
      ),
    ).toBe(false);
  });

  it("skips empty pathless buffers", () => {
    expect(tabsEligibleForDraftPersistence([makeTab({ contents: "" })])).toEqual(
      [],
    );
    expect(
      tabsEligibleForDraftPersistence([
        makeTab({ contents: "ok", lastSavedContents: "" }),
      ]),
    ).toHaveLength(1);
  });

  it("prunes expired pathless candidates but not path-backed by TTL", () => {
    const now = Date.now();
    const kept = pruneDraftRecords(
      [
        {
          path: "",
          recoveryId: "old",
          contents: "stale",
          line_ending: "lf",
          savedFingerprint: "",
          updatedAt: now - PATHLESS_DRAFT_TTL_MS - 1,
        },
        {
          path: "/workspace/note.md",
          contents: "path-old",
          line_ending: "lf",
          savedFingerprint: "fp",
          updatedAt: now - PATHLESS_DRAFT_TTL_MS - 1,
        },
        {
          path: "",
          recoveryId: "new",
          contents: "fresh",
          line_ending: "lf",
          savedFingerprint: "",
          updatedAt: now,
        },
      ],
      now,
    );
    expect(kept.map((d) => d.recoveryId ?? d.path).sort()).toEqual([
      "/workspace/note.md",
      "new",
    ]);
  });

  it("drops oversized pathless drafts during prune", () => {
    const now = Date.now();
    const kept = pruneDraftRecords(
      [
        {
          path: "",
          recoveryId: "big",
          contents: "x".repeat(PATHLESS_DRAFT_MAX_CHARS + 1),
          line_ending: "lf",
          savedFingerprint: "",
          updatedAt: now,
        },
      ],
      now,
    );
    expect(kept).toEqual([]);
  });

  it("keeps path-backed recovery capacity separate from pathless record count", () => {
    const now = Date.now();
    const pathless = Array.from(
      { length: PATHLESS_DRAFT_STORE_MAX_RECORDS },
      (_, index): DraftRecord => ({
        path: "",
        recoveryId: `pathless-${index}`,
        contents: "draft",
        line_ending: "lf",
        savedFingerprint: "",
        updatedAt: now - index,
      }),
    );
    const pathBacked: DraftRecord = {
      path: "/workspace/older.md",
      contents: "changed",
      line_ending: "lf",
      savedFingerprint: "fp",
      updatedAt: now - 10_000,
    };

    expect(pruneDraftRecords([...pathless, pathBacked], now)).toContainEqual(
      pathBacked,
    );
  });
});
