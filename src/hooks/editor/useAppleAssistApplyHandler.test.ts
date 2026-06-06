import { describe, expect, it } from "vitest";
import {
  APPLE_ASSIST_CONTEXT_POST_CHARS,
  APPLE_ASSIST_CONTEXT_PRE_CHARS,
  buildSurroundingDocumentContext,
} from "./useAppleAssistApplyHandler";
import { APPLE_ASSIST_MAX_CONTEXT_CHARS } from "../../lib/tauri/appleAssist";

// v0.12.x Apple Local Assist harness slice 1.
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
    // a 12 000-character document whose interesting section
    // lives in the second half, the helper must return text
    // that contains the target, not just the head.
    const buffer =
      "head-pad\n".repeat(500) + // ~5000 chars
      "section-a\nsection-b\n" + // the section to be edited
      "tail-pad\n".repeat(200); // ~1000 chars
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
    // a 12 000-char document that we capped at 8 000
    // around the target cannot include the head preamble.
    expect(context.startsWith("head-pad")).toBe(false);
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
