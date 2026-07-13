import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlashMenu } from "./SlashMenu";
import type { SlashMenuState } from "../../types/slash";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const copy = {
  agentBadge: "Agent",
  categoryAgent: "Agent",
  categoryMarkdown: "Markdown",
  categoryReview: "Review",
  categoryShortcut: "Shortcut",
  empty: "No commands",
  markdownBadge: "MD",
  menuLabel: "Slash command menu",
  reviewBadge: "Review",
  shortcutBadge: "Key",
};

function renderMenu(rect: SlashMenuState["rect"]) {
  render(
    <SlashMenu
      activeIndex={0}
      copy={copy}
      filteredCommands={[]}
      onClose={vi.fn()}
      onRun={vi.fn()}
      onSetActiveIndex={vi.fn()}
      state={{
        query: "",
        rect,
        slashFrom: 0,
        slashTo: 0,
        source: "context",
        visible: true,
      }}
    />,
  );

  return screen.getByRole("listbox");
}

describe("SlashMenu viewport containment", () => {
  it("positions the menu above an invocation near the bottom edge", () => {
    vi.stubGlobal("innerHeight", 600);
    vi.stubGlobal("innerWidth", 1000);

    const menu = renderMenu({ bottom: 580, left: 100, top: 560 });

    expect(menu.style.bottom).toBe("46px");
    expect(menu.style.top).toBe("");
  });

  it("aligns from the right edge when the minimum menu width would overflow", () => {
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("innerWidth", 800);

    const menu = renderMenu({ bottom: 120, left: 760, top: 100 });

    expect(menu.style.right).toBe("8px");
    expect(menu.style.left).toBe("");
  });

  it("keeps a left-edge invocation inside the viewport inset", () => {
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("innerWidth", 800);

    const menu = renderMenu({ bottom: 120, left: -20, top: 100 });

    expect(menu.style.left).toBe("8px");
    expect(menu.style.right).toBe("");
  });
});
