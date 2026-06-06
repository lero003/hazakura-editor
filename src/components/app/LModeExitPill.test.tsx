import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LModeExitPill } from "./LModeExitPill";
import { getLModeCopy } from "../../lib/locale/lMode";

afterEach(cleanup);

describe("LModeExitPill", () => {
  it("renders the exit label and the tooltip from the copy", () => {
    render(
      <LModeExitPill copy={getLModeCopy("en")} onExit={vi.fn()} />,
    );

    const button = screen.getByRole("button", { name: "Switch to Safe Edit mode" });
    expect(button).toBeTruthy();
    // The pill renders a monogram + label; the label is the
    // single piece of translated copy, the monogram is the
    // fixed "L" mark.
    expect(button.textContent).toBe("LSafe Edit");
    expect(button.getAttribute("title")).toBe("Switch to Safe Edit mode");
  });

  it("invokes onExit when the pill is clicked", () => {
    const onExit = vi.fn();
    render(<LModeExitPill copy={getLModeCopy("en")} onExit={onExit} />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to Safe Edit mode" }));

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("renders the Japanese copy when the menu language is Japanese", () => {
    render(
      <LModeExitPill copy={getLModeCopy("ja")} onExit={vi.fn()} />,
    );

    const button = screen.getByRole("button", { name: "Safe Edit に切り替え" });
    expect(button.textContent).toBe("LSafe Editへ");
  });
});
