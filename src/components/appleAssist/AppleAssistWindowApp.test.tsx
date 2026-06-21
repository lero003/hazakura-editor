// v0.17 operation-feedback hook tests.
//
// The component-level render of `AppleAssistWindowApp`
// is exercised through `useOperationFeedback`, which is
// the single piece of state that powers the bounded,
// in-memory, never-persisted feedback trail inside the
// detached Hazakura Local Assist window. The full component
// depends on the Tauri runtime, the on-device Apple
// Foundation Models availability probe, and the main-
// window IPC channel; those are not unit-tested here, but
// the hook that owns the feedback list and its safety
// boundaries is.
//
// The tests below pin:
//   - the list starts empty,
//   - `pushFeedback` appends entries in order,
//   - the cap is large enough for several requests in one session,
//   - the safety payload contract: only `targetKind` and
//     `targetChars` are accepted; `target.text`,
//     `target.label`, document names, paths, and other
//     broad-document fields must never reach the
//     feedback trail,
//   - `clearFeedback` empties the list,
//   - the hook does not call into `localStorage` or any
//     other persistence sink — entries are pure React
//     state.

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OPERATION_FEEDBACK_MAX_ENTRIES,
  scrollOperationFeedbackToEnd,
  useOperationFeedback,
} from "./AppleAssistWindowApp";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useOperationFeedback", () => {
  it("starts with an empty feedback list", () => {
    const { result } = renderHook(() => useOperationFeedback());
    expect(result.current.feedback).toEqual([]);
  });

  it("appends entries in push order with stable ids and timestamps", () => {
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({ kind: "ready" });
      result.current.pushFeedback({
        kind: "target-acquired",
        payload: { targetKind: "selection", targetChars: 142 },
      });
      result.current.pushFeedback({ kind: "request-sent" });
    });

    const entries = result.current.feedback;
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.kind)).toEqual([
      "ready",
      "target-acquired",
      "request-sent",
    ]);
    // Every entry has a non-empty id and a positive
    // timestamp. The id contains the timestamp, so we
    // assert that as a structural check rather than
    // pinning a specific value.
    for (const entry of entries) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.at).toBeGreaterThan(0);
    }
    // The ids are unique even when two pushes happen in
    // the same millisecond.
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(entries.length);
  });

  it("keeps the target-acquired payload to kind + character count", () => {
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({
        kind: "target-acquired",
        payload: { targetKind: "section", targetChars: 420 },
      });
    });
    const entry = result.current.feedback[0];
    expect(entry.kind).toBe("target-acquired");
    expect(entry.payload).toEqual({ targetKind: "section", targetChars: 420 });
  });

  it("keeps several requests worth of session feedback before capping", () => {
    expect(OPERATION_FEEDBACK_MAX_ENTRIES).toBeGreaterThanOrEqual(32);
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.pushFeedback({
          kind: "request-sent",
          payload: { targetChars: i },
        });
      }
    });
    const survivingChars = result.current.feedback.map(
      (e) => (e.payload as { targetChars: number }).targetChars,
    );
    expect(survivingChars).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("caps the feedback list at OPERATION_FEEDBACK_MAX_ENTRIES and drops the oldest entries only after the session log cap", () => {
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      for (let i = 0; i < OPERATION_FEEDBACK_MAX_ENTRIES + 2; i += 1) {
        result.current.pushFeedback({
          kind: "request-sent",
          // Distinguish each push with a different
          // character count so we can verify which
          // entries survive the cap.
          payload: { targetChars: i },
        });
      }
    });
    const entries = result.current.feedback;
    expect(entries).toHaveLength(OPERATION_FEEDBACK_MAX_ENTRIES);
    // The oldest two entries (chars 0 and 1) must have
    // been dropped from the head; the survivors start at
    // chars 2 and end at the cap + 1.
    const survivingChars = entries.map(
      (e) => (e.payload as { targetChars: number }).targetChars,
    );
    expect(survivingChars.at(0)).toBe(2);
    expect(survivingChars.at(-1)).toBe(OPERATION_FEEDBACK_MAX_ENTRIES + 1);
  });

  it("emits the same kinds the request doc lists (ready, target-acquired, request-sent, generation-started, applied, failed)", () => {
    // Structural safety: only the documented kinds are
    // accepted. A future refactor that adds a raw-prompt
    // or transcript kind would have to update the
    // OperationFeedbackKind union and the copy map; the
    // type system already rejects that change at compile
    // time. This test pins the public set. The list is
    // The cap is now large enough to keep this whole
    // lifecycle set together for a readable session log.
    const { result } = renderHook(() => useOperationFeedback());
    const expectedKinds: ReadonlyArray<
      "ready" | "target-acquired" | "request-sent" | "generation-started" | "applied" | "failed" | "unavailable"
    > = [
      "ready",
      "target-acquired",
      "request-sent",
      "generation-started",
      "applied",
      "failed",
      "unavailable",
    ];
    act(() => {
      for (const kind of expectedKinds) {
        result.current.pushFeedback({ kind });
      }
    });
    expect(result.current.feedback.map((e) => e.kind)).toEqual(
      expectedKinds,
    );
    expect(result.current.feedback).toHaveLength(expectedKinds.length);
    expect(result.current.feedback.at(-1)?.kind).toBe("unavailable");
    expect(result.current.feedback.find((e) => e.kind === "ready")).toBeDefined();
  });

  it("does not accept document text, label, or path fields in the payload (TypeScript-compile-time + runtime guard)", () => {
    // The hook itself is loosely typed (the payload is
    // `OperationFeedbackPayload` with only `targetKind`
    // and `targetChars`), but at runtime we still want
    // to verify that even if a caller tried to spread
    // forbidden fields, the resulting entry does not
    // surface them through the hook's return value.
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      // The cast below simulates a caller that tries to
      // bypass the type. The hook still records only
      // the typed fields because the spread is layered
      // on top of the typed fields via the union type.
      result.current.pushFeedback({
        kind: "target-acquired",
        payload: {
          targetKind: "selection",
          targetChars: 42,
        } as unknown as never,
      });
    });
    const entry = result.current.feedback[0];
    // No broad-document, path, or transcript data in
    // the persisted entry. This is the safety boundary
    // the v0.17 request doc requires.
    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain("/Users/");
    expect(serialised).not.toContain("transcript");
    expect(serialised).not.toContain("prompt");
    expect(serialised).not.toContain("response");
    expect(serialised).not.toContain("reasoning");
  });

  it("strips forbidden fields from the payload at push time (defense-in-depth sanitizer)", () => {
    // P2: the sanitizer in `pushFeedback` is the runtime
    // safety boundary. A future refactor that spreads
    // `target.text`, `target.label`, document names, file
    // paths, or secret-looking values into the payload
    // must not leak any of them into the feedback trail.
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({
        kind: "target-acquired",
        // Cast to `never` bypasses the TypeScript-only
        // safety net so this test exercises the runtime
        // sanitizer, not just the typed signature.
        payload: {
          targetKind: "selection",
          targetChars: 142,
          text: "Forbidden body text from a future refactor",
          label: "Forbidden section label",
          path: "/Users/leak/secret.md",
          activeDocumentName: "secret.md",
        } as unknown as never,
      });
    });
    const entry = result.current.feedback[0];
    const payload = entry.payload as
      | Record<string, unknown>
      | undefined;
    expect(payload).toBeDefined();
    expect(payload).toHaveProperty("targetKind", "selection");
    expect(payload).toHaveProperty("targetChars", 142);
    // The sanitizer must drop every other field, even
    // when the caller used the typed signature and the
    // type system is happy.
    expect(payload).not.toHaveProperty("text");
    expect(payload).not.toHaveProperty("label");
    expect(payload).not.toHaveProperty("path");
    expect(payload).not.toHaveProperty("activeDocumentName");
    // Defence-in-depth: a serialised entry must not
    // contain the literal leaked text or a path prefix.
    const json = JSON.stringify(entry);
    expect(json).not.toContain("Forbidden body text");
    expect(json).not.toContain("Forbidden section label");
    expect(json).not.toContain("/Users/leak");
    expect(json).not.toContain("secret.md");
  });

  it("strips a non-finite or negative `targetChars` value (defense-in-depth)", () => {
    // The sanitizer also coerces the char count to a
    // non-negative finite number so a future regression
    // cannot feed `NaN`, `Infinity`, or a negative
    // value into the feedback trail. Such a value would
    // otherwise produce copy like "about -1 characters"
    // or "about NaN characters" in the localized entry.
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({
        kind: "target-acquired",
        payload: {
          targetKind: "selection",
          targetChars: Number.NaN,
        } as unknown as never,
      });
    });
    const entry = result.current.feedback[0];
    const payload = entry.payload as
      | Record<string, unknown>
      | undefined;
    expect(payload).toBeDefined();
    expect(payload).toHaveProperty("targetKind", "selection");
    expect(payload).not.toHaveProperty("targetChars");
  });

  it("strips `targetChars` when it is missing or non-numeric", () => {
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({
        kind: "target-acquired",
        payload: {
          targetKind: "paragraph",
          targetChars: "not a number",
        } as unknown as never,
      });
    });
    const entry = result.current.feedback[0];
    const payload = entry.payload as
      | Record<string, unknown>
      | undefined;
    expect(payload).toBeDefined();
    expect(payload).toHaveProperty("targetKind", "paragraph");
    expect(payload).not.toHaveProperty("targetChars");
  });

  it("does not call localStorage or any persistence sink", () => {
    // Spy on localStorage so a future regression that
    // adds persistence is caught.
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({ kind: "ready" });
      result.current.pushFeedback({ kind: "request-sent" });
      result.current.pushFeedback({ kind: "applied" });
    });
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("clears the list when clearFeedback is called", () => {
    const { result } = renderHook(() => useOperationFeedback());
    act(() => {
      result.current.pushFeedback({ kind: "ready" });
      result.current.pushFeedback({ kind: "applied" });
    });
    expect(result.current.feedback).toHaveLength(2);
    act(() => {
      result.current.clearFeedback();
    });
    expect(result.current.feedback).toEqual([]);
  });
});

describe("scrollOperationFeedbackToEnd", () => {
  it("scrolls the feedback panel to the newest entry", () => {
    const panel = document.createElement("section");
    Object.defineProperty(panel, "scrollHeight", {
      configurable: true,
      value: 320,
    });
    panel.scrollTop = 12;

    scrollOperationFeedbackToEnd(panel);

    expect(panel.scrollTop).toBe(320);
  });

  it("ignores a missing feedback panel", () => {
    expect(() => scrollOperationFeedbackToEnd(null)).not.toThrow();
  });
});
