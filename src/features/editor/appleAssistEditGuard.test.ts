import { describe, expect, it } from "vitest";
import type { AppleAssistGenerationLock } from "../../types";
import {
  APPLE_ASSIST_TAB_LOCKED_STATUS_MESSAGE,
  assertTabEditable,
  isAppleAssistTabLocked,
} from "./appleAssistEditGuard";

const lock: AppleAssistGenerationLock = {
  requestId: "req-1",
  tabId: "/ws/a.md",
  tabPath: "/ws/a.md",
  request: "整える",
};

describe("isAppleAssistTabLocked", () => {
  it("returns false without a lock", () => {
    expect(isAppleAssistTabLocked(null, "/ws/a.md", "/ws/a.md")).toBe(false);
  });

  it("matches tabId", () => {
    expect(isAppleAssistTabLocked(lock, "/ws/a.md", "/other")).toBe(true);
  });

  it("matches tabPath when id differs (rekey)", () => {
    expect(isAppleAssistTabLocked(lock, "/ws/b.md", "/ws/a.md")).toBe(true);
  });

  it("does not lock unrelated tabs", () => {
    expect(isAppleAssistTabLocked(lock, "/ws/b.md", "/ws/b.md")).toBe(false);
  });
});

describe("assertTabEditable", () => {
  it("allows null tab and unlocked tab", () => {
    expect(assertTabEditable(lock, null)).toEqual({ editable: true });
    expect(
      assertTabEditable(lock, { id: "/ws/b.md", path: "/ws/b.md" }),
    ).toEqual({ editable: true });
  });

  it("blocks the locked document with a stable status message", () => {
    expect(
      assertTabEditable(lock, { id: "/ws/a.md", path: "/ws/a.md" }),
    ).toEqual({
      editable: false,
      reason: "apple-assist-generating",
      statusMessage: APPLE_ASSIST_TAB_LOCKED_STATUS_MESSAGE,
    });
  });
});
