import { useEffect, useRef } from "react";
import { isImeComposing } from "../../lib/keyboard";
import { useLatestValueRef } from "../../hooks/app/useLatestValueRef";
import {
  isCommandEnabled,
  type Command,
} from "../../hooks/commandPalette/useCommandPalette";
import type { MenuLanguage } from "../../types";

type CommandPaletteProps = {
  activeIndex: number;
  commands: Command[];
  menuLanguage: MenuLanguage;
  query: string;
  onClose: () => void;
  onRun: (command: Command) => void;
  onSetActiveIndex: (index: number) => void;
  onSetQuery: (query: string) => void;
};

export function CommandPalette({
  activeIndex,
  commands,
  menuLanguage,
  query,
  onClose,
  onRun,
  onSetActiveIndex,
  onSetQuery,
}: CommandPaletteProps) {
  const copy =
    menuLanguage === "kana"
      ? {
          dialogLabel: "こまんどを さがす",
          empty: "ぴったりのこまんどはありません",
          placeholder: "こまんどを いれてください...",
        }
      : menuLanguage === "ja"
        ? {
            dialogLabel: "コマンドパレット",
            empty: "一致するコマンドがありません",
            placeholder: "コマンドを入力...",
          }
        : {
            dialogLabel: "Command palette",
            empty: "No matching commands",
            placeholder: "Type a command...",
          };
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const commandsRef = useLatestValueRef(commands);
  const activeOptionId = commands[activeIndex]
    ? `command-palette-option-${activeIndex}`
    : undefined;

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
      if (command && isCommandEnabled(command)) {
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
        aria-label={copy.dialogLabel}
        aria-modal="true"
        className="command-palette-dialog"
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <input
          ref={inputRef}
          aria-activedescendant={activeOptionId}
          aria-controls="command-palette-results"
          aria-expanded="true"
          aria-haspopup="listbox"
          aria-label={copy.dialogLabel}
          className="command-palette-input"
          onChange={(event) => onSetQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={copy.placeholder}
          role="combobox"
          type="text"
          value={query}
        />
        <div
          className="command-palette-results"
          id="command-palette-results"
          ref={listRef}
          role="listbox"
        >
          {commands.length === 0 ? (
            <div className="command-palette-empty">{copy.empty}</div>
          ) : (
            commands.map((command, index) => {
              const enabled = isCommandEnabled(command);
              const reason = command.disabledReason;
              return (
                <button
                  key={command.id}
                  aria-disabled={enabled ? undefined : true}
                  aria-selected={index === activeIndex}
                  className={`command-palette-item${
                    index === activeIndex ? " active" : ""
                  }${enabled ? "" : " is-disabled"}`}
                  id={`command-palette-option-${index}`}
                  onMouseEnter={() => onSetActiveIndex(index)}
                  onPointerDown={(event) => {
                    if (!enabled) {
                      event.preventDefault();
                      return;
                    }
                    onRun(command);
                  }}
                  role="option"
                  title={reason}
                  type="button"
                >
                  <span className="command-palette-item-main">
                    <span className="command-palette-label">
                      {command.label}
                    </span>
                    {reason ? (
                      <span className="command-palette-disabled-reason">
                        {reason}
                      </span>
                    ) : null}
                  </span>
                  <span className="command-palette-category">
                    {command.category}
                  </span>
                  {command.shortcut ? (
                    <span className="command-palette-shortcut">
                      {command.shortcut}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
