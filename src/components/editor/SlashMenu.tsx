import { useEffect, useRef, useState } from "react";
import type { SlashCommand, SlashMenuState } from "../../types/slash";

export interface SlashMenuCopy {
  agentBadge: string;
  categoryAgent: string;
  categoryMarkdown: string;
  categoryReview: string;
  categoryShortcut: string;
  empty: string;
  markdownBadge: string;
  reviewBadge: string;
  shortcutBadge: string;
}

type SlashMenuProps = {
  activeIndex: number;
  copy: SlashMenuCopy;
  filteredCommands: SlashCommand[];
  onClose: () => void;
  onRun: (command: SlashCommand) => void;
  onSetActiveIndex: (index: number) => void;
  state: SlashMenuState;
};

const CATEGORY_LABEL: Record<SlashCommand["category"], keyof SlashMenuCopy> = {
  agent: "categoryAgent",
  markdown: "categoryMarkdown",
  review: "categoryReview",
  shortcut: "categoryShortcut",
};

const BADGE_LABEL: Record<SlashCommand["category"], keyof SlashMenuCopy> = {
  agent: "agentBadge",
  markdown: "markdownBadge",
  review: "reviewBadge",
  shortcut: "shortcutBadge",
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SlashMenu({
  activeIndex,
  copy,
  filteredCommands,
  onClose,
  onRun,
  onSetActiveIndex,
  state,
}: SlashMenuProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const element = itemRefs.current[activeIndex];
    if (element) {
      element.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!state.visible || !state.rect) {
    return null;
  }

  const ordered = filteredCommands;
  const placeholder = ordered.length === 0;
  const reduceMotion = prefersReducedMotion();

  const viewportHeight =
    typeof window === "undefined" ? 0 : window.innerHeight;
  const flipUp =
    viewportHeight > 0 && state.rect.bottom + 240 > viewportHeight;
  const top = flipUp
    ? Math.max(8, state.rect.top - 8)
    : state.rect.bottom + 6;
  const left = state.rect.left;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onSetActiveIndex(
        Math.min(activeIndex + 1, Math.max(ordered.length - 1, 0)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onSetActiveIndex(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      const command = ordered[activeIndex];
      if (command) {
        event.preventDefault();
        onRun(command);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      aria-label="Slash command menu"
      className={`slash-menu${reduceMotion ? " reduced-motion" : ""}`}
      role="listbox"
      style={{ left, position: "fixed", top }}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="slash-menu-inner">
        {placeholder ? (
          <div className="slash-menu-empty">{copy.empty}</div>
        ) : (
          ordered.map((command, index) => {
            const categoryLabel = copy[CATEGORY_LABEL[command.category]];
            const badgeLabel = copy[BADGE_LABEL[command.category]];
            const isActive = index === activeIndex;
            return (
              <button
                aria-selected={isActive}
                className={`slash-menu-item${isActive ? " active" : ""}`}
                key={command.id}
                onClick={() => onRun(command)}
                onMouseEnter={() => onSetActiveIndex(index)}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                role="option"
                type="button"
              >
                <span
                  className={`slash-menu-badge slash-menu-badge-${command.category}`}
                  title={categoryLabel}
                >
                  {badgeLabel}
                </span>
                <span className="slash-menu-label">{command.label}</span>
                <span className="slash-menu-hint">{command.hint}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
