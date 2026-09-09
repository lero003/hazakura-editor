import { describe, expect, it } from "vitest";
import { matchesReviewIdentity, acceptsReviewOutcome } from "./localAssistReviewIdentity";

const identity = { requestId: "r2", conversationId: "c1", documentSessionId: "s1" };
describe("exact Local Assist review identity", () => {
  it("requires all three nonempty identities", () => {
    expect(matchesReviewIdentity(identity, { ...identity })).toBe(true);
    for (const key of Object.keys(identity)) {
      expect(matchesReviewIdentity(identity, { ...identity, [key]: "older" })).toBe(false);
      expect(matchesReviewIdentity(identity, { ...identity, [key]: undefined })).toBe(false);
    }
    expect(matchesReviewIdentity(null, identity)).toBe(false);
  });
  it("ignores late outcomes during a newer generation or conversation", () => {
    expect(acceptsReviewOutcome(identity, identity, "c1", "s1", null)).toBe(true);
    expect(acceptsReviewOutcome(identity, identity, "c1", "s1", "r3")).toBe(false);
    expect(acceptsReviewOutcome(identity, identity, "c2", "s1", null)).toBe(false);
    expect(acceptsReviewOutcome(identity, identity, "c1", "s2", null)).toBe(false);
    expect(acceptsReviewOutcome(identity, { ...identity, requestId: "r1" }, "c1", "s1", null)).toBe(false);
  });
});
