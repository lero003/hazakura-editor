import { describe, expect, it } from "vitest";
import { localAssistReasonKey } from "./localAssistFailureReason";

describe("localAssistReasonKey", () => {
  it("maps the app-side character limits to the target-size reason", () => {
    expect(localAssistReasonKey("Selected text exceeds the maximum length")).toBe("reasonTooLong");
    expect(localAssistReasonKey("Proposal exceeds the maximum length")).toBe("reasonTooLong");
  });

  it("separates the model context window from the app limit", () => {
    expect(localAssistReasonKey("ExceededContextWindowSize")).toBe("reasonContext");
    expect(localAssistReasonKey("Document context exceeds the allowed size")).toBe("reasonContext");
  });

  it("maps availability, congestion, timeout and format failures", () => {
    expect(localAssistReasonKey("Apple Intelligence is not available on this Mac")).toBe("reasonUnavailable");
    expect(localAssistReasonKey("The model is busy with another request")).toBe("reasonThrottled");
    expect(localAssistReasonKey("The request timed out")).toBe("reasonTimeout");
    expect(localAssistReasonKey("Ambiguous proposal formatting detected")).toBe("reasonFormat");
  });

  it("stays silent for messages it cannot classify", () => {
    expect(localAssistReasonKey("Some unexpected future error: xyz")).toBeNull();
    expect(localAssistReasonKey("")).toBeNull();
    expect(localAssistReasonKey(null)).toBeNull();
    expect(localAssistReasonKey(undefined)).toBeNull();
  });
});
