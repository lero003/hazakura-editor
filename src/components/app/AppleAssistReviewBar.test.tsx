import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppleAssistReviewBar } from "./AppleAssistReviewBar";
import { getLModeCopy } from "../../lib/locale/lMode";
import { aiEditTransactionStore } from "../../features/editor/aiEditTransactions";
import type { AppleAssistTargetSnapshot } from "../../types";

afterEach(() => {
  cleanup();
  // Drain the store between tests so the latest transaction
  // does not leak across cases.
  for (const tabId of ["tabA", "tabB"]) {
    aiEditTransactionStore.clear(tabId);
  }
});

function target(
  start: number,
  end: number,
  text: string,
  kind: AppleAssistTargetSnapshot["kind"] = "paragraph",
): AppleAssistTargetSnapshot {
  return {
    kind,
    start,
    end,
    text,
    label: "",
    activeDocumentPath: "/tmp/note.md",
    activeDocumentName: "note.md",
    capturedAtMs: 0,
  };
}

function recordPending(tabId: string, request: string) {
  aiEditTransactionStore.record({
    id: `tx-${tabId}`,
    tabId,
    tabName: "note.md",
    tabPath: "/tmp/note.md",
    request,
    target: target(0, 5, "hello"),
    before: "hello",
    after: "【整え】\nhello\n【/整え】",
    beforeBuffer: "prefix\nhello\nsuffix",
    afterBuffer: "prefix\n【整え】\nhello\n【/整え】\nsuffix",
    appliedAtMs: 0,
    diff: {
      caseKey: `tx-${tabId}`,
      lines: [],
      additions: 1,
      removals: 0,
    },
  });
}

describe("AppleAssistReviewBar", () => {
  it("renders nothing when no transaction is pending for the active tab", () => {
    const { container } = render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("surfaces a summary line for the latest transaction on the active tab", () => {
    recordPending("tabA", "整えて");
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Apple Local Assist changed your text/),
    ).toBeTruthy();
    expect(screen.getByText(/整えて \(paragraph\)/)).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("does not surface a transaction that belongs to a different tab", () => {
    recordPending("tabA", "整えて");
    const { container } = render(
      <AppleAssistReviewBar
        activeTabId="tabB"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("invokes onDiscard with the tab id and the full before-buffer snapshot", () => {
    recordPending("tabA", "整えて");
    const onDiscard = vi.fn();
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledWith("tabA", "prefix\nhello\nsuffix");
  });

  it("close button dismisses the bar without calling onDiscard", () => {
    recordPending("tabA", "整えて");
    const onDiscard = vi.fn();
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={onDiscard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDiscard).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Apple Local Assist changed your text/),
    ).toBeNull();
  });

  it("toggles the inline diff preview on demand", () => {
    recordPending("tabA", "整えて");
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        diffInitiallyOpen={false}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );

    const openDiff = screen.getByRole("button", { name: "Open diff" });
    fireEvent.click(openDiff);
    // The diff table renders a "Before" / "After" header row
    // when the inline preview is visible.
    expect(screen.getByText("Before")).toBeTruthy();
    expect(screen.getByText("After")).toBeTruthy();
  });

  it("opens the inline diff preview by default for a new AI edit", () => {
    recordPending("tabA", "整えて");
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.getByText("Before")).toBeTruthy();
    expect(screen.getByText("After")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close diff" })).toBeTruthy();
  });

  it("can start with the inline diff preview closed by preference", () => {
    recordPending("tabA", "整えて");
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        diffInitiallyOpen={false}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.getByRole("button", { name: "Open diff" })).toBeTruthy();
  });

  it("changes the diff toggle label when the inline diff is open", () => {
    recordPending("tabA", "整えて");
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("en")}
        menuLanguage="en"
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close diff" }));
    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.getByRole("button", { name: "Open diff" })).toBeTruthy();
  });

  it("uses localized labels in Japanese", () => {
    recordPending("tabA", "整えて");
    render(
      <AppleAssistReviewBar
        activeTabId="tabA"
        copy={getLModeCopy("ja")}
        diffInitiallyOpen={false}
        menuLanguage="ja"
        onDiscard={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Apple Local Assist が本文を変更しました/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "差分を開く" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "取り消す" })).toBeTruthy();
  });
});
