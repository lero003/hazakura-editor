import { describe, expect, it } from "vitest";
import { localizeStatusMessage } from "./statusMessages";

// v0.15 theme IPC status feedback.
//
// `useAppPreferences` now routes the three theme-related IPC
// failures (window theme, window background color, agent window
// theme) through the existing status bar via
// `localizeStatusMessage`. The tests below pin:
//   - each new exact-match key returns a Japanese string for
//     `ja`,
//   - the Japanese strings carry the failure noun (失敗)
//     so the user understands the action did not take effect,
//   - the English path is unchanged (the raw English key is
//     returned for `en`).
//   - the three keys stay distinct so future copy edits do
//     not collapse them.

describe("localizeStatusMessage: theme IPC failure keys (v0.15)", () => {
  it("localizes the window theme failure to Japanese", () => {
    expect(localizeStatusMessage("Failed to update window theme", "ja"))
      .toBe("ウィンドウのテーマ更新に失敗しました");
  });

  it("localizes the window background color failure to Japanese", () => {
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "ja",
      ),
    ).toBe("ウィンドウの背景色更新に失敗しました");
  });

  it("localizes the Agent window theme failure to Japanese", () => {
    expect(
      localizeStatusMessage("Failed to update Agent window theme", "ja"),
    ).toBe("Agent ウィンドウのテーマ更新に失敗しました");
  });

  it("mentions the failure noun (失敗) so the user sees the action did not take effect", () => {
    expect(localizeStatusMessage("Failed to update window theme", "ja"))
      .toMatch(/失敗/);
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "ja",
      ),
    ).toMatch(/失敗/);
    expect(
      localizeStatusMessage("Failed to update Agent window theme", "ja"),
    ).toMatch(/失敗/);
  });

  it("returns the raw English key when menu language is English", () => {
    expect(localizeStatusMessage("Failed to update window theme", "en"))
      .toBe("Failed to update window theme");
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "en",
      ),
    ).toBe("Failed to update window background color");
    expect(
      localizeStatusMessage("Failed to update Agent window theme", "en"),
    ).toBe("Failed to update Agent window theme");
  });

  it("returns distinct Japanese messages for the three keys (no copy collapse)", () => {
    const a = localizeStatusMessage("Failed to update window theme", "ja");
    const b = localizeStatusMessage(
      "Failed to update window background color",
      "ja",
    );
    const c = localizeStatusMessage(
      "Failed to update Agent window theme",
      "ja",
    );
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
