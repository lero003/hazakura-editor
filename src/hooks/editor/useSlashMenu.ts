import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { EditorView } from "@codemirror/view";
import {
  HIDDEN_SLASH_STATE,
  type SlashCommand,
  type SlashMenuState,
} from "../../types/slash";

const SLASH_TRIGGER_REGEX = /^\/([^\s/]*)$/;

type UseSlashMenuOptions = {
  commands: readonly SlashCommand[];
  enabled: boolean;
  viewRef: RefObject<EditorView | null>;
};

type UseSlashMenuResult = {
  activeIndex: number;
  closeMenu: () => void;
  commands: SlashCommand[];
  runCommand: (command: SlashCommand) => void;
  setActiveIndex: (index: number) => void;
  state: SlashMenuState;
};

function findSlashMatch(
  view: EditorView,
): { from: number; to: number; query: string } | null {
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return null;
  }
  const head = selection.head;
  const line = view.state.doc.lineAt(head);
  const before = view.state.doc.sliceString(line.from, head);
  const match = SLASH_TRIGGER_REGEX.exec(before);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  const slashStart = head - 1 - query.length;
  if (slashStart !== line.from) {
    return null;
  }
  return { from: slashStart, query, to: head };
}

function scoreCommand(command: SlashCommand, query: string): number {
  if (!query) {
    return 0;
  }
  const normalized = query.toLowerCase();
  for (const key of command.searchKeys) {
    if (key.toLowerCase() === normalized) {
      return 1000;
    }
  }
  for (const key of command.searchKeys) {
    if (key.toLowerCase().startsWith(normalized)) {
      return 500 - key.length;
    }
  }
  for (const key of command.searchKeys) {
    if (key.toLowerCase().includes(normalized)) {
      return 200 - key.indexOf(normalized);
    }
  }
  if (command.label.toLowerCase().includes(normalized)) {
    return 100 - command.label.toLowerCase().indexOf(normalized);
  }
  let commandIndex = 0;
  let queryIndex = 0;
  while (
    commandIndex < command.label.length &&
    queryIndex < normalized.length
  ) {
    if (
      command.label[commandIndex]?.toLowerCase() === normalized[queryIndex]
    ) {
      queryIndex += 1;
    }
    commandIndex += 1;
  }
  return queryIndex === normalized.length ? 10 - commandIndex : -1;
}

function isComposing(view: EditorView): boolean {
  try {
    return view.composing === true;
  } catch {
    return false;
  }
}

function readCursorRect(view: EditorView, head: number) {
  const coords = view.coordsAtPos(head);
  if (!coords) {
    return null;
  }
  return { bottom: coords.bottom, left: coords.left, top: coords.top };
}

export function useSlashMenu({
  commands,
  enabled,
  viewRef,
}: UseSlashMenuOptions): UseSlashMenuResult {
  const [state, setState] = useState<SlashMenuState>(HIDDEN_SLASH_STATE);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const filteredCommandsRef = useRef<SlashCommand[]>([]);

  const commandList = useMemo(() => [...commands], [commands]);

  const filteredCommands = useMemo(() => {
    if (!state.visible) {
      return commandList;
    }
    if (!state.query) {
      return commandList;
    }
    return commandList
      .map((command) => ({ command, score: scoreCommand(command, state.query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command);
  }, [commandList, state.query, state.visible]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredCommands.length, state.query]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    filteredCommandsRef.current = filteredCommands;
  }, [filteredCommands]);

  const closeMenu = useCallback(() => {
    setState((current) =>
      current.visible
        ? { ...current, query: "", rect: null, visible: false }
        : current,
    );
    const view = viewRef.current;
    if (view) {
      view.focus();
    }
  }, [viewRef]);

  const runCommand = useCallback(
    (command: SlashCommand) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      if ("insertText" in command) {
        const match = findSlashMatch(view);
        if (!match) {
          return;
        }
        view.dispatch({
          changes: { from: match.from, to: match.to, insert: command.insertText },
          selection: {
            anchor: match.from + command.insertText.length,
          },
        });
        view.focus();
      } else {
        const match = findSlashMatch(view);
        if (match) {
          view.dispatch({
            changes: { from: match.from, to: match.to, insert: "" },
          });
        }
        view.focus();
        command.action();
      }
      setState(HIDDEN_SLASH_STATE);
    },
    [viewRef],
  );

  useEffect(() => {
    if (!enabled) {
      setState(HIDDEN_SLASH_STATE);
      return;
    }
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const update = () => {
      if (isComposing(view)) {
        setState((current) =>
          current.visible
            ? { ...current, rect: null, visible: false }
            : current,
        );
        return;
      }
      const match = findSlashMatch(view);
      if (!match) {
        setState((current) =>
          current.visible
            ? { ...current, query: "", rect: null, visible: false }
            : current,
        );
        return;
      }
      const rect = readCursorRect(view, match.to);
      setState({
        query: match.query,
        rect,
        slashFrom: match.from,
        slashTo: match.to,
        visible: true,
      });
    };

    update();
    const dom = view.contentDOM;
    const onCompositionStart = () => {
      setState((current) =>
        current.visible
          ? { ...current, rect: null, visible: false }
          : current,
      );
    };
    const onCompositionEnd = () => {
      update();
    };
    const onSelectionChange = () => {
      update();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (state.visible) {
        const consumeEvent = () => {
          event.preventDefault();
          event.stopImmediatePropagation();
        };
        if (event.key === "ArrowDown") {
          consumeEvent();
          setActiveIndex((index) =>
            Math.min(
              index + 1,
              Math.max(filteredCommandsRef.current.length - 1, 0),
            ),
          );
          return;
        }
        if (event.key === "ArrowUp") {
          consumeEvent();
          setActiveIndex((index) => Math.max(index - 1, 0));
          return;
        }
        if (
          event.key === "Enter" ||
          (event.key === "Tab" && !event.shiftKey)
        ) {
          const command =
            filteredCommandsRef.current[activeIndexRef.current] ?? null;
          consumeEvent();
          if (command) {
            runCommand(command);
          }
          return;
        }
        if (event.key === "Escape") {
          consumeEvent();
          closeMenu();
          return;
        }
      }
      if (event.key === "Backspace" || event.key === "Escape") {
        setTimeout(update, 0);
      }
    };
    dom.addEventListener("compositionstart", onCompositionStart);
    dom.addEventListener("compositionend", onCompositionEnd);
    dom.addEventListener("input", onSelectionChange);
    dom.addEventListener("keyup", onSelectionChange);
    dom.addEventListener("keydown", onKeyDown, true);
    return () => {
      dom.removeEventListener("compositionstart", onCompositionStart);
      dom.removeEventListener("compositionend", onCompositionEnd);
      dom.removeEventListener("input", onSelectionChange);
      dom.removeEventListener("keyup", onSelectionChange);
      dom.removeEventListener("keydown", onKeyDown, true);
    };
  }, [closeMenu, enabled, runCommand, state.visible, viewRef]);

  return {
    activeIndex,
    closeMenu,
    commands: filteredCommands,
    runCommand,
    setActiveIndex,
    state,
  };
}
