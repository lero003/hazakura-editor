import { describe, expect, it } from "vitest";
import { exportFormatSwitchPlan } from "./exportFormatSwitch";

describe("exportFormatSwitchPlan (画面11)", () => {
  it("closes the open format and starts the chosen one", () => {
    expect(exportFormatSwitchPlan("pdf", "epub")).toEqual({
      cancel: "pdf",
      start: "epub",
    });
    expect(exportFormatSwitchPlan("epub", "html")).toEqual({
      cancel: "epub",
      start: "html",
    });
    expect(exportFormatSwitchPlan("html", "pdf")).toEqual({
      cancel: "html",
      start: "pdf",
    });
  });

  it("does nothing when the same format is chosen again", () => {
    // 同じ形式で準備をやり直すと、入力した設定が消える。
    expect(exportFormatSwitchPlan("epub", "epub")).toBeNull();
    expect(exportFormatSwitchPlan("pdf", "pdf")).toBeNull();
    expect(exportFormatSwitchPlan("html", "html")).toBeNull();
  });
});
