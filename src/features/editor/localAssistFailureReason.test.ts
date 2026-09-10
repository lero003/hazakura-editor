import { describe, expect, it } from "vitest";
import { localAssistReasonKey } from "./localAssistFailureReason";

describe("localAssistReasonKey", () => {
  it("separates the input target limit from the proposal limit (R5)", () => {
    // 入力対象の超過 → 範囲を短くする案内。
    expect(localAssistReasonKey("Selected text exceeds the maximum length")).toBe(
      "reasonSelectionTooLong",
    );
    // 生成案の超過 → 入力対象が長いとは言えないので、別の案内。
    expect(localAssistReasonKey("Proposal exceeds the maximum length")).toBe(
      "reasonProposalTooLong",
    );
    // 継続の上限 → やり直しの案内。
    expect(localAssistReasonKey("Proposal exceeds the continuation limit")).toBe(
      "reasonContinuationLimit",
    );
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
