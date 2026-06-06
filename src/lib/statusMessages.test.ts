import { describe, expect, it } from "vitest";
import { localizeStatusMessage } from "./statusMessages";

// v0.15 theme IPC status feedback.
//
// `useAppPreferences` now routes the two reliable theme
// IPC failures (window theme, window background color)
// through the existing status bar via
// `localizeStatusMessage`. The Agent window theme IPC is
// deliberately NOT covered: `setAgentWindowTheme` swallows
// the IPC error internally and resolves with `void`, so a
// status message routed through the outer `.catch` would
// never reach the user. Keeping it out of the status bar
// is the honest move until that helper is reshaped to
// throw on failure.
//
// The tests below pin:
//   - each new exact-match key returns a Japanese string
//     for `ja`,
//   - the Japanese strings carry the failure noun (失敗)
//     so the user understands the action did not take
//     effect,
//   - the English path is unchanged (the raw English key is
//     returned for `en`),
//   - the two keys stay distinct so future copy edits do
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

  it("mentions the failure noun (失敗) so the user sees the action did not take effect", () => {
    expect(localizeStatusMessage("Failed to update window theme", "ja"))
      .toMatch(/失敗/);
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "ja",
      ),
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
  });

  it("returns distinct Japanese messages for the two keys (no copy collapse)", () => {
    const a = localizeStatusMessage("Failed to update window theme", "ja");
    const b = localizeStatusMessage(
      "Failed to update window background color",
      "ja",
    );
    expect(new Set([a, b]).size).toBe(2);
  });
});
