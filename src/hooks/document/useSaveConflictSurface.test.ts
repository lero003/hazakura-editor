import { applyLiveEditorContentsById } from "../../features/editor/editorTabs";
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import type { EditorTab } from "../../types";
import { useSaveConflictSurface } from "./useSaveConflictSurface";
it("dismisses presentation only and reopens for a new conflict or session", () => {
  const tab = { id: "doc", sessionId: "one", path: "/doc.md", contents: "unsaved", externalFingerprint: "disk-one", error: "conflict", saveStatus: "conflict" } as EditorTab;
  const before = { ...tab };
  const { result, rerender } = renderHook(({ value }) => useSaveConflictSurface(value, true), { initialProps: { value: tab } });
  expect(result.current.tab).toBe(tab);
  act(() => result.current.dismiss());
  expect(result.current.tab).toBeNull();
  expect(tab).toEqual(before);
  rerender({ value: { ...tab, contents: "still editing" } });
  expect(result.current.tab).toBeNull();
  act(() => result.current.reopen());
  expect(result.current.tab).not.toBeNull();
  act(() => result.current.dismiss());
  rerender({ value: { ...tab, sessionId: "two" } });
  expect(result.current.tab).not.toBeNull();
  act(() => result.current.dismiss());
  rerender({ value: { ...tab, sessionId: "two", externalFingerprint: "disk-two" } });
  expect(result.current.tab).not.toBeNull();
});

it("retains dismissal across another active tab and uses the live typing reducer", () => {
  const a = { id: "a", sessionId: "a", path: "/a", contents: "a", saveStatus: "conflict", error: "conflict", externalFingerprint: "disk" } as EditorTab;
  const b = { ...a, id: "b", sessionId: "b", saveStatus: "idle", error: null } as EditorTab;
  const { result, rerender } = renderHook(({ tab }) => useSaveConflictSurface(tab, tab.saveStatus === "conflict"), { initialProps: { tab: a } });
  act(() => result.current.dismiss());
  const [typed] = applyLiveEditorContentsById([a], a.id, "a!");
  expect(typed.saveStatus).toBe("conflict");
  expect(typed.error).toBe(a.error);
  rerender({ tab: b }); rerender({ tab: typed });
  expect(result.current.tab).toBeNull();
});
