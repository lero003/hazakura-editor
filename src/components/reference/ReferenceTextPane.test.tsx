import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import { ReferenceTextPane } from "./ReferenceTextPane";

describe("ReferenceTextPane", () => {
  it("shows read-only text with line numbers and closes on request", () => {
    const onClose = vi.fn();
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        menuLanguage="ja"
        onClose={onClose}
        reference={{
          kind: "text",
          path: "/ws/style.md",
          name: "style.md",
          contents: "line one\nline two",
          encoding: "utf-8",
        }}
      />,
    );

    expect(screen.getByTestId("reference-role").textContent).toContain("参照");
    expect(screen.getByText("style.md")).toBeTruthy();
    expect(screen.getByText("読み取り専用")).toBeTruthy();
    expect(screen.getByText("line one")).toBeTruthy();
    expect(screen.getByText("line two")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("参照を閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers diff action when both sides are text-capable", () => {
    const onShowDiff = vi.fn();
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        menuLanguage="ja"
        onClose={vi.fn()}
        onShowDiff={onShowDiff}
        reference={{
          kind: "text",
          path: "/ws/a.md",
          name: "a.md",
          contents: "a",
          encoding: "utf-8",
        }}
        showDiffEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "差分を見る" }));
    expect(onShowDiff).toHaveBeenCalledTimes(1);
  });

  it("shows external-change notice with explicit reload", () => {
    const onReloadReference = vi.fn();
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        externalChangePending
        menuLanguage="ja"
        onClose={vi.fn()}
        onReloadReference={onReloadReference}
        reference={{
          kind: "text",
          path: "/ws/a.md",
          name: "a.md",
          contents: "a",
          encoding: "utf-8",
        }}
      />,
    );

    expect(screen.getByTestId("reference-external-change").textContent).toContain(
      "参照ファイルが変更されました",
    );
    fireEvent.click(screen.getByTestId("reference-reload"));
    expect(onReloadReference).toHaveBeenCalledTimes(1);
  });
});
