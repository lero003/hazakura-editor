import { useEffect, useRef } from "react";
import { isImeComposing } from "../../lib/keyboard";
import { useLatestValueRef } from "../../hooks/app/useLatestValueRef";
import type { Command } from "../../hooks/commandPalette/useCommandPalette";

type CommandPaletteProps = {
  activeIndex: number;
  commands: Command[];
  query: string;
  onClose: () => void;
  onRun: (command: Command) => void;
  onSetActiveIndex: (index: number) => void;
  onSetQuery: (query: string) => void;
};

export function CommandPalette({
  activeIndex,
  commands,
  query,
  onClose,
  onRun,
  onSetActiveIndex,
  onSetQuery,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const commandsRef = useLatestValueRef(commands);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const item = list.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Mirror the find / global-search rule: Japanese / kana
    // composition emits Enter / Escape / Arrow keys while the
    // IME is still composing, and we must let those pass through
    // to the IME instead of moving the active row, running the
    // command, or closing the modal.
    if (isImeComposing(event.nativeEvent)) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onSetActiveIndex(
        Math.min(activeIndexRef.current + 1, commandsRef.current.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onSetActiveIndex(Math.max(activeIndexRef.current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = commandsRef.current[activeIndexRef.current];
      if (command) {
        onRun(command);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="command-palette-overlay" onPointerDown={onClose}>
      <div
        className="command-palette-dialog"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          aria-label="Command palette"
          className="command-palette-input"
          onChange={(event) => onSetQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          type="text"
          value={query}
        />
        <div className="command-palette-results" ref={listRef}>
          {commands.length === 0 ? (
            <div className="command-palette-empty">No matching commands</div>
          ) : (
            commands.map((command, index) => (
              <button
                key={command.id}
                className={`command-palette-item${
                  index === activeIndex ? " active" : ""
                }`}
                onMouseEnter={() => onSetActiveIndex(index)}
                onPointerDown={() => onRun(command)}
                type="button"
              >
                <span className="command-palette-label">{command.label}</span>
                <span className="command-palette-category">
                  {command.category}
                </span>
                {command.shortcut ? (
                  <span className="command-palette-shortcut">
                    {command.shortcut}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
