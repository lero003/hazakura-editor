import { describe, expect, it } from "vitest";
import { classifyLocalAssistError } from "./errors";

describe("Local Assist legacy error classification", () => {
  it.each([
    ["Foundation Models input is too large for this request. Try a smaller selection.", "context"],
    ["Foundation Models generation failed: exceededContextWindowSize", "context"],
    ["Document context exceeds the maximum length of 8000 characters.", "context"],
    ["Selected text exceeds the maximum length of 4000 characters.", "selection"],
    ["Hazakura Local Assist current proposal exceeds the maximum length of 4000 characters.", "proposal"],
    ["proposal exceeds the continuation limit of 4000 characters.", "proposal"],
    ["Apple Foundation Models assets are unavailable.", "unavailable"],
    ["Foundation Models requires macOS 26 or later.", "unavailable"],
    ["Apple Foundation Models does not support this language or current locale for generation yet.", "language"],
    ["Apple Foundation Models is busy with another request. Try again shortly.", "throttled"],
    ["Apple Foundation Models is rate limited. Try again shortly.", "throttled"],
    ["helper request timed out after 360s", "timeout"],
    ["cancelled by user", "cancelled"],
    ["target text no longer matches the active buffer", "stale"],
    ["Apple Foundation Models refused this request (guardrail)", "guardrail"],
    ["Unable to generate candidate", "unknown"],
    ["separate response could not be decoded", "unknown"],
  ] as const)("classifies %s", (message, expected) => {
    expect(classifyLocalAssistError(new Error(message))).toBe(expected);
    expect(classifyLocalAssistError(message)).toBe(expected);
  });
  it("recognizes AbortError without guessing from its message", () => {
    expect(classifyLocalAssistError(new DOMException("operation ended", "AbortError"))).toBe("cancelled");
  });
});
