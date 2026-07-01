import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEditorTabsPathRekey } from "./useEditorTabsPathRekey";
import type {
  CompareAnchor,
  CompareCase,
  CompareViewState,
  DraftRecord,
  EditorTab,
  RecentEntry,
} from "../../types";

function makeTab(path: string, name: string, overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    id: path,
    sessionId: `session:${path}`,
    path,
    name,
    contents: "hello",
    lastSavedContents: "hello",
    lastSavedLineEnding: "lf",
    lastSavedEncoding: "utf-8",
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
    line_ending: "lf",
    encoding: "utf-8",
    size: 5,
    modified_ms: null,
    fingerprint: "fp",
    large_file_warning: false,
    ...overrides,
  };
}

function makeOptions(overrides: Partial<Parameters<typeof useEditorTabsPathRekey>[0]> = {}) {
  return {
    getCompareCaseByKey: vi.fn(),
    setActiveTabId: vi.fn(),
    setCompareAnchor: vi.fn(),
    setCompareTarget: vi.fn(),
    setCompareView: vi.fn(),
    setPendingDrafts: vi.fn(),
    setRecentFiles: vi.fn(),
    setTabs: vi.fn(),
    ...overrides,
  };
}

const fileCompareCase = (
  key: string,
  leftPath: string,
  rightPath: string,
): Extract<CompareCase, { kind: "file" }> => ({
  anchor: {
    label: "Source",
    name: leftPath.split("/").pop() ?? leftPath,
    path: leftPath,
  },
  kind: "file",
  key,
  leftPath,
  rightPath,
  target: {
    label: "Target",
    name: rightPath.split("/").pop() ?? rightPath,
    path: rightPath,
  },
});

describe("useEditorTabsPathRekey", () => {
  it("returns a rekeyPath helper", () => {
    const { result } = renderHook(() => useEditorTabsPathRekey(makeOptions()));
    expect(result.current).toHaveProperty("rekeyPath");
  });

  it("updates the matching tab's id, path, and name", () => {
    const setTabs = vi.fn();
    const { result } = renderHook(() => useEditorTabsPathRekey(makeOptions({ setTabs })));

    const oldTab = makeTab("/root/old.md", "old.md");
    const otherTab = makeTab("/root/other.md", "other.md");
    setTabs.mockImplementationOnce(
      (updater: (current: EditorTab[]) => EditorTab[]) =>
        updater([oldTab, otherTab]),
    );
    setActiveTabIdStub(setTabs);

    act(() => {
      result.current.rekeyPath("/root/old.md", "/root/new.md");
    });

    const update = setTabs.mock.calls[0][0] as (
      current: EditorTab[],
    ) => EditorTab[];
    const next = update([oldTab, otherTab]);
    expect(next[0]).toMatchObject({
      id: "/root/new.md",
      path: "/root/new.md",
      name: "new.md",
    });
    expect(next[1]).toBe(otherTab);
  });

  it("rewrites activeTabId when it matches the old path", () => {
    const setActiveTabId = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setActiveTabId })),
    );

    act(() => {
      result.current.rekeyPath("/root/old.md", "/root/new.md");
    });

    const update = setActiveTabId.mock.calls[0][0] as (current: string | null) => string | null;
    expect(update("/root/old.md")).toBe("/root/new.md");
    expect(update("/root/other.md")).toBe("/root/other.md");
    expect(update(null)).toBe(null);
  });

  it("rewrites pending drafts and recent files for the old path", () => {
    const setPendingDrafts = vi.fn();
    const setRecentFiles = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(
        makeOptions({ setPendingDrafts, setRecentFiles }),
      ),
    );

    act(() => {
      result.current.rekeyPath("/root/old.md", "/root/new.md");
    });

    const draftUpdate = setPendingDrafts.mock.calls[0][0] as (
      current: DraftRecord[],
    ) => DraftRecord[];
    const draftNext = draftUpdate([
      { path: "/root/old.md", contents: "x", line_ending: "lf", savedFingerprint: "fp", updatedAt: 0 },
    ]);
    expect(draftNext[0].path).toBe("/root/new.md");

    const recentUpdate = setRecentFiles.mock.calls[0][0] as (
      current: RecentEntry[],
    ) => RecentEntry[];
    const recentNext = recentUpdate([
      { path: "/root/old.md", label: "old.md", openedAt: 0, pinnedAt: null },
    ]);
    expect(recentNext[0].path).toBe("/root/new.md");
    expect(recentNext[0].label).toBe("new.md");
  });

  it("rewrites compare anchor / target when they reference the old path", () => {
    const setCompareAnchor = vi.fn();
    const setCompareTarget = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(
        makeOptions({ setCompareAnchor, setCompareTarget }),
      ),
    );

    act(() => {
      result.current.rekeyPath("/root/old.md", "/root/new.md");
    });

    const anchorUpdate = setCompareAnchor.mock.calls[0][0] as (
      current: CompareAnchor | null,
    ) => CompareAnchor | null;
    expect(anchorUpdate({ path: "/root/old.md", name: "old.md" })).toEqual({
      path: "/root/new.md",
      name: "new.md",
    });
    expect(anchorUpdate({ path: "/root/other.md", name: "other.md" })).toEqual({
      path: "/root/other.md",
      name: "other.md",
    });

    const targetUpdate = setCompareTarget.mock.calls[0][0] as (
      current: CompareAnchor | null,
    ) => CompareAnchor | null;
    expect(targetUpdate({ path: "/root/old.md", name: "old.md" })).toEqual({
      path: "/root/new.md",
      name: "new.md",
    });
  });

  it("clears compareView when its caseKey references the old path", () => {
    const setCompareView = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setCompareView })),
    );

    act(() => {
      result.current.rekeyPath("/root/old.md", "/root/new.md");
    });

    const update = setCompareView.mock.calls[0][0] as (
      current: CompareViewState | null,
    ) => CompareViewState | null;
    const referenced: CompareViewState = {
      caseKey: "file:/root/old.md::/root/other.md",
      lines: [],
      additions: 0,
      removals: 0,
    };
    expect(update(referenced)).toBe(null);
    expect(update(null)).toBe(null);
  });

  it("clears compareView when its CompareCase references the old path", () => {
    const setCompareView = vi.fn();
    const getCompareCaseByKey = vi.fn((key: string) =>
      key === "uuid-case"
        ? fileCompareCase("uuid-case", "/root/old.md", "/root/other.md")
        : undefined,
    );
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(
        makeOptions({ getCompareCaseByKey, setCompareView }),
      ),
    );

    act(() => {
      result.current.rekeyPath("/root/old.md", "/root/new.md");
    });

    const update = setCompareView.mock.calls[0][0] as (
      current: CompareViewState | null,
    ) => CompareViewState | null;
    expect(
      update({
        caseKey: "uuid-case",
        lines: [],
        additions: 0,
        removals: 0,
      }),
    ).toBe(null);
    expect(
      update({
        caseKey: "unrelated-case",
        lines: [],
        additions: 0,
        removals: 0,
      }),
    ).toMatchObject({ caseKey: "unrelated-case" });
  });

  it("returns a rekeyPathPrefix helper", () => {
    const { result } = renderHook(() => useEditorTabsPathRekey(makeOptions()));
    expect(result.current).toHaveProperty("rekeyPathPrefix");
  });

  it("rewrites descendant tab id/path/name on prefix rekey", () => {
    const setTabs = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setTabs })),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const inside = makeTab("/root/notes/today.md", "today.md");
    const outside = makeTab("/root/other/today.md", "today.md");
    const sibling = makeTab("/root/notes-old/today.md", "today.md");
    const update = setTabs.mock.calls[0][0] as (
      current: EditorTab[],
    ) => EditorTab[];

    const next = update([inside, outside, sibling]);

    expect(next[0]).toMatchObject({
      id: "/root/archive/today.md",
      path: "/root/archive/today.md",
      name: "today.md",
    });
    // Outside the renamed folder stays put.
    expect(next[1]).toBe(outside);
    // `notes-old` shares a string prefix with `notes` but is a
    // different folder; the trailing-slash anchor must skip it.
    expect(next[2]).toBe(sibling);
  });

  it("rewrites activeTabId only when it lives under the rekeyed folder", () => {
    const setActiveTabId = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setActiveTabId })),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const update = setActiveTabId.mock.calls[0][0] as (
      current: string | null,
    ) => string | null;
    expect(update("/root/notes/today.md")).toBe("/root/archive/today.md");
    expect(update("/root/other/today.md")).toBe("/root/other/today.md");
    expect(update("/root/notes-old/today.md")).toBe("/root/notes-old/today.md");
    expect(update(null)).toBe(null);
  });

  it("rewrites descendant drafts and recents on prefix rekey", () => {
    const setPendingDrafts = vi.fn();
    const setRecentFiles = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(
        makeOptions({ setPendingDrafts, setRecentFiles }),
      ),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const draftUpdate = setPendingDrafts.mock.calls[0][0] as (
      current: DraftRecord[],
    ) => DraftRecord[];
    const draftNext = draftUpdate([
      { path: "/root/notes/today.md", contents: "x", line_ending: "lf", savedFingerprint: "fp", updatedAt: 0 },
      { path: "/root/other/today.md", contents: "y", line_ending: "lf", savedFingerprint: "fp", updatedAt: 0 },
    ]);
    expect(draftNext[0].path).toBe("/root/archive/today.md");
    expect(draftNext[1].path).toBe("/root/other/today.md");

    const recentUpdate = setRecentFiles.mock.calls[0][0] as (
      current: RecentEntry[],
    ) => RecentEntry[];
    const recentNext = recentUpdate([
      { path: "/root/notes/today.md", label: "today.md", openedAt: 0, pinnedAt: null },
      { path: "/root/notes-old/today.md", label: "today.md", openedAt: 0, pinnedAt: null },
    ]);
    expect(recentNext[0].path).toBe("/root/archive/today.md");
    expect(recentNext[0].label).toBe("today.md");
    // Sibling-prefix match must not be rewritten.
    expect(recentNext[1].path).toBe("/root/notes-old/today.md");
  });

  it("rewrites compare anchor/target only for descendants of the rekeyed folder", () => {
    const setCompareAnchor = vi.fn();
    const setCompareTarget = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(
        makeOptions({ setCompareAnchor, setCompareTarget }),
      ),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const anchorUpdate = setCompareAnchor.mock.calls[0][0] as (
      current: CompareAnchor | null,
    ) => CompareAnchor | null;
    expect(
      anchorUpdate({ path: "/root/notes/today.md", name: "today.md" }),
    ).toEqual({ path: "/root/archive/today.md", name: "today.md" });
    expect(
      anchorUpdate({ path: "/root/other/today.md", name: "today.md" }),
    ).toEqual({ path: "/root/other/today.md", name: "today.md" });
    expect(anchorUpdate(null)).toBe(null);

    const targetUpdate = setCompareTarget.mock.calls[0][0] as (
      current: CompareAnchor | null,
    ) => CompareAnchor | null;
    expect(
      targetUpdate({ path: "/root/notes/today.md", name: "today.md" }),
    ).toEqual({ path: "/root/archive/today.md", name: "today.md" });
  });

  it("clears compareView when its caseKey references the rekeyed folder", () => {
    const setCompareView = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setCompareView })),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const update = setCompareView.mock.calls[0][0] as (
      current: CompareViewState | null,
    ) => CompareViewState | null;
    expect(
      update({
        caseKey: "file:/root/notes/today.md::/root/other.md",
        lines: [],
        additions: 0,
        removals: 0,
      }),
    ).toBe(null);
    expect(
      update({
        caseKey: "file:/root/other.md::/root/different.md",
        lines: [],
        additions: 0,
        removals: 0,
      }),
    ).toMatchObject({ caseKey: "file:/root/other.md::/root/different.md" });
    expect(update(null)).toBe(null);
  });

  it("clears compareView when its CompareCase references the rekeyed folder", () => {
    const setCompareView = vi.fn();
    const getCompareCaseByKey = vi.fn((key: string) =>
      key === "uuid-case"
        ? fileCompareCase(
            "uuid-case",
            "/root/notes/today.md",
            "/root/other.md",
          )
        : undefined,
    );
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(
        makeOptions({ getCompareCaseByKey, setCompareView }),
      ),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const update = setCompareView.mock.calls[0][0] as (
      current: CompareViewState | null,
    ) => CompareViewState | null;
    expect(
      update({
        caseKey: "uuid-case",
        lines: [],
        additions: 0,
        removals: 0,
      }),
    ).toBe(null);
    expect(
      update({
        caseKey: "unrelated-case",
        lines: [],
        additions: 0,
        removals: 0,
      }),
    ).toMatchObject({ caseKey: "unrelated-case" });
  });

  // Regression: after Save As, a tab's `id` follows the new path while
  // `sessionId` preserves the original editor session. When the user later
  // renames the saved file, rekeyPath must match on `tab.path` (not the
  // stale `tab.id`), otherwise the tab's id/path/name drift apart and the
  // active tab can disappear. This test pins the path-match behavior.
  it("rekeys a tab by path even when id was reset by a prior Save As", () => {
    const setTabs = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setTabs })),
    );

    // Save As moved this tab from /root/old.md to /root/saved.md. The tab's
    // id is now the saved path, but the original sessionId is preserved.
    const savedAsTab = makeTab("/root/saved.md", "saved.md", {
      sessionId: "session:original",
    });
    const unrelatedTab = makeTab("/root/other.md", "other.md");
    setTabs.mockImplementationOnce(
      (updater: (current: EditorTab[]) => EditorTab[]) =>
        updater([savedAsTab, unrelatedTab]),
    );

    act(() => {
      result.current.rekeyPath("/root/saved.md", "/root/renamed.md");
    });

    const update = setTabs.mock.calls[0][0] as (
      current: EditorTab[],
    ) => EditorTab[];
    const next = update([savedAsTab, unrelatedTab]);
    expect(next[0]).toMatchObject({
      id: "/root/renamed.md",
      path: "/root/renamed.md",
      name: "renamed.md",
      sessionId: "session:original",
    });
    expect(next[1]).toBe(unrelatedTab);
  });

  it("rekeys a folder prefix by path even when a descendant id was reset by Save As", () => {
    const setTabs = vi.fn();
    const { result } = renderHook(() =>
      useEditorTabsPathRekey(makeOptions({ setTabs })),
    );

    // This tab was saved-as into the /root/notes/ folder, so its id no
    // longer matches whatever path it was opened from. The prefix rekey
    // must still catch it through `tab.path`.
    const savedAsTab = makeTab("/root/notes/saved.md", "saved.md", {
      sessionId: "session:moved",
    });
    setTabs.mockImplementationOnce(
      (updater: (current: EditorTab[]) => EditorTab[]) =>
        updater([savedAsTab]),
    );

    act(() => {
      result.current.rekeyPathPrefix("/root/notes", "/root/archive");
    });

    const update = setTabs.mock.calls[0][0] as (
      current: EditorTab[],
    ) => EditorTab[];
    const next = update([savedAsTab]);
    expect(next[0]).toMatchObject({
      id: "/root/archive/saved.md",
      path: "/root/archive/saved.md",
      name: "saved.md",
      sessionId: "session:moved",
    });
  });
});

// `setTabs` was already consumed by the rekey invocation; the
// following stubs are no-op helpers to keep the test focused on
// the activeTabId path. Kept inline so the test stays self-
// contained.
function setActiveTabIdStub(_setTabs: ReturnType<typeof vi.fn>) {
  // intentionally empty — the activeTabId setter is the only other
  // consumer we exercise in the helper, and the test reads it
  // directly from the closure above.
}
