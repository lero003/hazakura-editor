import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LModeActionRail } from "./LModeActionRail";
import { getLModeCopy } from "../../lib/locale/lMode";

afterEach(cleanup);

describe("LModeActionRail", () => {
  it("renders the workspace and Apple Assist actions without review changes when clean", () => {
    render(
      <LModeActionRail
        copy={getLModeCopy("en")}
        onExitToWorkspace={vi.fn()}
        onOpenAppleAssistWindow={vi.fn()}
        onReviewChanges={vi.fn()}
        reviewChangesAvailable={false}
      />,
    );

    expect(screen.getByLabelText("L Mode actions")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open workspace/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Apple Assist/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Review changes/ })).toBeNull();
  });

  it("invokes review, workspace, and Apple Assist actions", () => {
    const onExitToWorkspace = vi.fn();
    const onOpenAppleAssistWindow = vi.fn();
    const onReviewChanges = vi.fn();
    render(
      <LModeActionRail
        copy={getLModeCopy("en")}
        onExitToWorkspace={onExitToWorkspace}
        onOpenAppleAssistWindow={onOpenAppleAssistWindow}
        onReviewChanges={onReviewChanges}
        reviewChangesAvailable={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apple Assist/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open workspace/ }));

    expect(onReviewChanges).toHaveBeenCalledTimes(1);
    expect(onOpenAppleAssistWindow).toHaveBeenCalledTimes(1);
    expect(onExitToWorkspace).toHaveBeenCalledTimes(1);
  });
});
