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
  it("keys pathless drafts by recoveryId", () => {
    const draft: DraftRecord = {
      path: "",
      recoveryId: "session:9",
      contents: "x",
      line_ending: "lf",
      savedFingerprint: "",
      updatedAt: Date.now(),
      name: "untitled.md",
      origin: "untitled",
    };
    expect(isPathlessDraft(draft)).toBe(true);
    expect(draftStorageKey(draft)).toBe("pathless:session:9");
  });

  it("builds a pathless recovery record from a dirty untitled tab", () => {
    const record = draftRecordFromTab(
      makeTab({
        contents: "# draft",
        sessionId: "session:abc",
        name: "import-scan.md",
      }),
    );
    expect(record).toMatchObject({
      path: "",
      recoveryId: "session:abc",
      origin: "import-assist",
      contents: "# draft",
    });
  });

  it("matches pathless drafts to open tabs by sessionId", () => {
    const draft = draftRecordFromTab(makeTab({ sessionId: "session:z" }));
    const tab = makeTab({ sessionId: "session:z", id: "untitled:99" });
    expect(draftMatchesTab(draft, tab)).toBe(true);
    expect(
      draftMatchesTab(draft, makeTab({ sessionId: "session:other" })),
    ).toBe(false);
  });

  it("skips empty pathless buffers and oversized content", () => {
    expect(tabsEligibleForDraftPersistence([makeTab({ contents: "" })])).toEqual(
      [],
    );
    expect(
      tabsEligibleForDraftPersistence([
        makeTab({ contents: "ok", lastSavedContents: "" }),
      ]),
    ).toHaveLength(1);
  });

  it("prunes expired recovery candidates", () => {
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
    expect(kept.map((d) => d.recoveryId)).toEqual(["new"]);
  });
});
