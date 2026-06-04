import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LModeActionRail } from "./LModeActionRail";
import { getLModeCopy } from "../../lib/locale/lMode";

afterEach(cleanup);

describe("LModeActionRail", () => {
  it("renders the workspace action without review changes when clean", () => {
    render(
      <LModeActionRail
        copy={getLModeCopy("en")}
        onExitToWorkspace={vi.fn()}
        onReviewChanges={vi.fn()}
        reviewChangesAvailable={false}
      />,
    );

    expect(screen.getByLabelText("L Mode actions")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open workspace/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Review changes/ })).toBeNull();
  });

  it("invokes review and workspace actions", () => {
    const onExitToWorkspace = vi.fn();
    const onReviewChanges = vi.fn();
    render(
      <LModeActionRail
        copy={getLModeCopy("en")}
        onExitToWorkspace={onExitToWorkspace}
        onReviewChanges={onReviewChanges}
        reviewChangesAvailable={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Review changes/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open workspace/ }));

    expect(onReviewChanges).toHaveBeenCalledTimes(1);
    expect(onExitToWorkspace).toHaveBeenCalledTimes(1);
  });
});
