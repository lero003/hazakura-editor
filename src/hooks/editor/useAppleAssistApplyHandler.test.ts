import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLE_ASSIST_CONTEXT_POST_CHARS,
  APPLE_ASSIST_CONTEXT_PRE_CHARS,
  APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS,
  APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS,
  buildSurroundingDocumentContext,
  getAppleAssistContextWindow,
  isSameAppleAssistTargetTab,
  sanitizeAppleAssistCandidateText,
} from "./useAppleAssistApplyHandler";
import { APPLE_ASSIST_MAX_CONTEXT_CHARS } from "../../lib/tauri/appleAssist";

// v0.12.x Hazakura Local Assist harness slice 1.
//
// `buildSurroundingDocumentContext` is the pure helper that
// replaces the previous "first 8000 chars of the document"
// behavior. The previous shape made the model blind to the
// section the user was actually editing when the selection
// was in the second half of a long document, which is the
// single most common cause of off-target AI rewrites. The
// tests below pin the new shape end-to-end so the
// regression cannot return silently.

describe("buildSurroundingDocumentContext", () => {
  it("centers the slice on the target, not on the document head", () => {
    // The previous behavior was `buffer.slice(0, 8000)`. With
    // a long document whose interesting section
    // lives in the second half, the helper must return text
    // that contains the target, not just the head.
    const buffer =
      "DOCUMENT-HEAD\n" +
      "head-pad\n".repeat(1000) + // ~9000 chars
      "section-a\nsection-b\n" + // the section to be edited
      "tail-pad\n".repeat(400); // ~3600 chars
    const targetText = "section-a\nsection-b\n";
    const start = buffer.indexOf(targetText);
    const end = start + targetText.length;

    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      APPLE_ASSIST_CONTEXT_PRE_CHARS,
      APPLE_ASSIST_CONTEXT_POST_CHARS,
      APPLE_ASSIST_MAX_CONTEXT_CHARS,
    );

    expect(context).toContain(targetText);
    // The context must NOT start at the document head, so
    // a long document that we capped at 8 000
    // around the target cannot include the head preamble.
    expect(context).not.toContain("DOCUMENT-HEAD");
  });

  it("preserves heading and following lines around the target", () => {
    const buffer = "# Important Heading\nintro line\nTARGET line\nafter line\n";
    const start = buffer.indexOf("TARGET");
    const end = start + "TARGET".length;

    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      APPLE_ASSIST_CONTEXT_PRE_CHARS,
      APPLE_ASSIST_CONTEXT_POST_CHARS,
      APPLE_ASSIST_MAX_CONTEXT_CHARS,
    );

    expect(context).toBe(buffer);
  });

  it("snaps the pre boundary to the start of the target's line", () => {
    // If the pre slice would otherwise end mid-line, the
    // helper must snap the boundary forward to the line
    // start so the model never sees a half-cut Markdown
    // block on the pre side.
    const buffer = "aaa\nbbb\nccc\n";
    const start = buffer.indexOf("bbb"); // mid-line? no — buffer is short
    // The fixture here is "aaa\nbbb\nccc\n" so position 0
    // = a, position 4 = b. We pin behavior on a longer
    // fixture below; this case covers the trivial "no
    // snap needed" path.
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      start + 3,
      50,
      50,
      200,
    );
    expect(context).toContain("bbb");
  });

  it("snaps forward to a line start when the target starts mid-line", () => {
    // Force the pre window to span a line boundary. The
    // target starts at position 4 (mid "aaaa" in the second
    // line) and the pre window goes back 20 chars. The
    // line containing position 4 starts at the newline
    // after "aaaa" — that is the snap-forward target.
    // Without the snap, the pre slice would end mid-line at
    // position 4, which is exactly the half-cut block we
    // are guarding against.
    const buffer = "first line here\nsecond line starts here\nthird line\n";
    // Target = "starts here\n" inside the second line.
    const start = buffer.indexOf("starts here");
    const end = start + "starts here\n".length;
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      20,
      20,
      200,
    );
    // The pre slice must start no earlier than the second
    // line's line start ("second line ").
    const preBoundary = context.indexOf(buffer.slice(start, end));
    expect(preBoundary).toBeGreaterThan(0);
    const preSlice = context.slice(0, preBoundary);
    // The line containing `start` begins at the newline
    // before "second". The pre slice must begin there or
    // later — never mid-line.
    const lastNewlineBeforeStart = buffer.lastIndexOf("\n", start - 1) + 1;
    expect(preSlice.endsWith(buffer.slice(lastNewlineBeforeStart, start))).toBe(
      true,
    );
  });

  it("snaps the post boundary to the end of the target's line", () => {
    // Force the post window to span a line boundary. The
    // target ends mid-line, and the post window reaches
    // into the next line. The post slice must end at the
    // end of the target's line, not at the start of the
    // next one.
    const buffer = "first line here\nsecond line starts here\nthird line\n";
    const start = buffer.indexOf("second");
    const end = start + "second".length; // ends mid-line
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      20,
      20,
      200,
    );
    // The post slice must not contain "third", which lives
    // on the next line after the target's line.
    expect(context).not.toContain("third");
  });

  it("returns just the pre slice when the target is at the end of the document", () => {
    const buffer = "line one\nline two\nline three";
    const targetText = "line three";
    const start = buffer.indexOf(targetText);
    const end = start + targetText.length;
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      50,
      50,
      200,
    );
    expect(context).toContain(targetText);
    // No post slice because the target ends at the document
    // end (no trailing newline).
    expect(context.endsWith(targetText)).toBe(true);
  });

  it("returns just the post slice when the target is at the start of the document", () => {
    const buffer = "line one\nline two\nline three\n";
    const start = 0;
    const end = "line one".length;
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      50,
      50,
      200,
    );
    expect(context.startsWith("line one")).toBe(true);
  });

  it("never shrinks the target itself when the total exceeds the cap", () => {
    // Construct a fixture where the target plus naive
    // pre / post windows would exceed the cap. The helper
    // must shrink the pre and post slices, never the
    // target.
    const pre = "a".repeat(3000);
    const post = "b".repeat(3000);
    const target = "TARGET";
    const buffer = pre + target + post;
    const start = pre.length;
    const end = start + target.length;
    const maxChars = 2000; // smaller than target + 2 * window
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      APPLE_ASSIST_CONTEXT_PRE_CHARS,
      APPLE_ASSIST_CONTEXT_POST_CHARS,
      maxChars,
    );
    // Target must always be present and contiguous in the
    // returned context.
    expect(context).toContain(target);
    const targetIndex = context.indexOf(target);
    expect(context.indexOf(target, targetIndex + 1)).toBe(-1);
    // Total length is at most the cap.
    expect(context.length).toBeLessThanOrEqual(maxChars);
  });

  it("never returns more characters than the cap allows", () => {
    // Sanity check on a fixture that has plenty of context
    // both sides of the target.
    const pre = "a".repeat(5000);
    const post = "b".repeat(5000);
    const target = "TARGET";
    const buffer = pre + target + post;
    const start = pre.length;
    const end = start + target.length;
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      APPLE_ASSIST_CONTEXT_PRE_CHARS,
      APPLE_ASSIST_CONTEXT_POST_CHARS,
      APPLE_ASSIST_MAX_CONTEXT_CHARS,
    );
    expect(context.length).toBeLessThanOrEqual(APPLE_ASSIST_MAX_CONTEXT_CHARS);
    expect(context).toContain(target);
  });

  it("applies the cap to the actual returned context", () => {
    // This case catches a subtle implementation bug where
    // separate snapped pre/post boundaries were used for
    // length accounting, but the helper still returned the
    // full `buffer.slice(preStart, postEnd)`. A long target
    // line could then make the returned context disagree
    // with the cap calculation.
    const target = "TARGET";
    const buffer = `${"a".repeat(3000)}${target}${"b".repeat(3000)}\n`;
    const start = buffer.indexOf(target);
    const end = start + target.length;
    const maxChars = 2000;

    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      APPLE_ASSIST_CONTEXT_PRE_CHARS,
      APPLE_ASSIST_CONTEXT_POST_CHARS,
      maxChars,
    );

    expect(context.length).toBeLessThanOrEqual(maxChars);
    expect(context).toContain(target);
  });

  it("snaps the returned slice boundaries to full lines when possible", () => {
    const buffer = [
      "prefix line that should be dropped",
      "kept heading",
      "kept intro",
      "TARGET line",
      "kept after",
      "suffix line that should be dropped",
    ].join("\n");
    const start = buffer.indexOf("TARGET");
    const end = start + "TARGET".length;

    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      34,
      32,
      200,
    );

    expect(context).toBe("kept heading\nkept intro\nTARGET line\nkept after\n");
  });

  it("clamps the pre window to the document start", () => {
    // preChars is larger than the available prefix, and
    // the target is mid-line so the snap-forward does not
    // erase the pre slice. The helper must still include
    // the prefix in the returned context, not silently
    // jump past it.
    const buffer = "pre text here\nTARGET\npost";
    const start = 4; // mid "pre text here"
    const end = buffer.indexOf("TARGET") + "TARGET".length;
    const context = buildSurroundingDocumentContext(
      buffer,
      start,
      end,
      5000,
      5000,
      10000,
    );
    expect(context).toContain("pre");
    expect(context).toContain("TARGET");
  });
});

describe("getAppleAssistContextWindow", () => {
  it("uses a tighter context window for explicit selections", () => {
    const contextWindow = getAppleAssistContextWindow("selection");

    expect(contextWindow).toEqual({
      preChars: APPLE_ASSIST_SELECTION_CONTEXT_PRE_CHARS,
      postChars: APPLE_ASSIST_SELECTION_CONTEXT_POST_CHARS,
    });
    expect(contextWindow.preChars).toBeLessThan(APPLE_ASSIST_CONTEXT_PRE_CHARS);
    expect(contextWindow.postChars).toBeLessThan(APPLE_ASSIST_CONTEXT_POST_CHARS);
  });

  it("keeps the broader context window for inferred targets", () => {
    for (const kind of ["paragraph", "block", "section", "document"] as const) {
      expect(getAppleAssistContextWindow(kind)).toEqual({
        preChars: APPLE_ASSIST_CONTEXT_PRE_CHARS,
        postChars: APPLE_ASSIST_CONTEXT_POST_CHARS,
      });
    }
  });
});

describe("sanitizeAppleAssistCandidateText", () => {
  it("strips leaked Hazakura text boundary markers before applying the candidate", () => {
    const candidate = [
      "<<<HAZAKURA_TEXT_START",
      "Translated body",
      "HAZAKURA_TEXT_END>>>",
    ].join("\n");

    expect(sanitizeAppleAssistCandidateText(candidate)).toBe("Translated body");
  });

  it("strips leaked Hazakura context boundary markers if the model echoes the full prompt shape", () => {
    const candidate = [
      "<<<HAZAKURA_CONTEXT_START",
      "Reference context",
      "HAZAKURA_CONTEXT_END>>>",
    ].join("\n");

    expect(sanitizeAppleAssistCandidateText(candidate)).toBe("Reference context");
  });

  it("keeps normal Markdown content intact", () => {
    const candidate = "# Heading\n\n- item\n";

    expect(sanitizeAppleAssistCandidateText(candidate)).toBe(candidate);
  });
});

describe("isSameAppleAssistTargetTab", () => {
  const tab = {
    id: "tab-1",
    sessionId: "session:tab-1",
    name: "note.md",
    path: "/workspace/note.md",
    contents: "body",
  };

  it("requires both tab id and path to remain stable before applying the final candidate", () => {
    expect(isSameAppleAssistTargetTab(tab, { ...tab, contents: "new" })).toBe(
      true,
    );
    expect(
      isSameAppleAssistTargetTab(tab, {
        ...tab,
        id: "tab-2",
      }),
    ).toBe(false);
    expect(
      isSameAppleAssistTargetTab(tab, {
        ...tab,
        path: "/workspace/other.md",
      }),
    ).toBe(false);
  });
});

// Integration coverage for the full apply path. The pure
// helper tests above do not exercise the hook itself, which
// is how the `id`-vs-`sessionId` regression slipped through:
// the apply handler silently no-op'd the buffer write because
// `setActiveTabContents` matches by `sessionId`. These tests
// render the hook, fire the apply event, and assert that the
// buffer write targets the tab by `sessionId` (not `id`).
import { renderHook } from "@testing-library/react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { useAppleAssistApplyHandler } from "./useAppleAssistApplyHandler";
import { aiEditTransactionStore } from "../../features/editor/aiEditTransactions";
import type {
  AppleAssistApplyEvent,
  AppleAssistTargetSnapshot,
} from "../../types";

type ApplyListener = Parameters<typeof listen<AppleAssistApplyEvent>>[1];

const applyListeners: ApplyListener[] = [];

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(async () => {}),
  listen: vi.fn(async (_eventName: string, handler: ApplyListener) => {
    applyListeners.push(handler);
    return () => {};
  }),
}));

vi.mock("../../lib/tauri/appleAssist", () => ({
  APPLE_ASSIST_MAX_CONTEXT_CHARS: 8000,
  generateAppleAssistCandidateStreaming: vi.fn(async () => ({
    candidateText: "整えた本文",
  })),
}));

function targetSnapshot(
  text: string,
  contents: string,
): AppleAssistTargetSnapshot {
  const start = contents.indexOf(text);
  return {
    kind: "paragraph",
    start,
    end: start + text.length,
    text,
    label: "",
    activeDocumentPath: "/workspace/note.md",
    activeDocumentName: "note.md",
    capturedAtMs: 0,
  };
}

describe("useAppleAssistApplyHandler apply path", () => {
  const originalRAF = window.requestAnimationFrame;

  beforeEach(() => {
    // The handler yields to `requestAnimationFrame` before
    // generating. jsdom's rAF is tied to a frame clock the
    // test never advances, so the generation promise would
    // hang and the buffer write would never run. Route the
    // frame callback through `setTimeout` so a timer pump
    // flushes it deterministically.
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(0), 0)) as unknown as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    applyListeners.length = 0;
    vi.mocked(listen).mockClear();
    vi.mocked(emitTo).mockClear();
    window.requestAnimationFrame = originalRAF;
    aiEditTransactionStore.clear("session:tab-1");
  });

  it("writes the generated text back to the tab matched by sessionId", async () => {
    const contents = "hello world";
    const target = targetSnapshot("hello world", contents);
    const setActiveTabContents = vi.fn();

    renderHook(() =>
      useAppleAssistApplyHandler({
        activeTab: {
          // `id` (path) and `sessionId` are deliberately
          // distinct values. The buffer write must key off
          // `sessionId`; passing `id` would never match.
          id: "/workspace/note.md",
          sessionId: "session:tab-1",
          name: "note.md",
          path: "/workspace/note.md",
          contents,
        },
        setActiveTabContents,
        setStatus: vi.fn(),
      }),
    );

    const payload: AppleAssistApplyEvent = {
      requestId: "req-1",
      request: "整えて",
      target,
      additionalRequest: undefined,
      actionId: "proofread_only",
      requestedAtMs: 0,
    };
    // The listener fires the apply on `void` (the handler does
    // not return the inner promise), so awaiting the listener
    // alone does not drain the generation chain. Pump the timer
    // queue repeatedly to flush the `requestAnimationFrame`
    // yield and the mocked streaming generation.
    applyListeners[0]?.({ payload } as never);
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(setActiveTabContents).toHaveBeenCalledTimes(1);
    // The write MUST be addressed by `sessionId`, not by `id`.
    // If the handler passes `id` ("/workspace/note.md"), the
    // real `setTabs((tabs) => tabs.map((t) => t.sessionId === tabId ...))`
    // finds no tab and the buffer never updates.
    expect(setActiveTabContents).toHaveBeenCalledWith(
      expect.any(String),
      "session:tab-1",
    );
    expect(setActiveTabContents).not.toHaveBeenCalledWith(
      expect.any(String),
      "/workspace/note.md",
    );
  });
});
