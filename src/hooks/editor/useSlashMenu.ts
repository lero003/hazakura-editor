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

// The `/` must be at a word boundary — at the start of the
// buffer, or preceded by whitespace. The lookbehind `(?<!\S)`
// matches both: `^` is implicit at the start of the string, and
// `\S` is "any non-whitespace" so a whitespace char or buffer
// start satisfies the lookbehind. This lets the user type `/`
// at any point in a line (after a space, after punctuation,
// etc.) and still get the menu, but avoids interrupting URIs
// like `https://example.com` where the `/` sits inside a token.
const SLASH_TRIGGER_REGEX = /(?<!\S)\/([^\s/]*)$/;

type UseSlashMenuOptions = {
  commands: readonly SlashCommand[];
  enabled: boolean;
  // Stable identity for the current EditorView. The view is held in
  // a ref so imperative callers can reach it, but the listener
  // effect below needs to re-run when the view is destroyed and
  // replaced on document switch — refs don't change identity, so we
  // take an explicit key (e.g. `documentKey`) that does. Without this
  // the listeners stay bound to the previous view's `contentDOM`,
  // which is detached from the document after the switch and so no
  // longer receives events: typing `/` in the new file would not
  // open the slash menu.
  viewKey: string;
  viewRef: RefObject<EditorView | null>;
};

type UseSlashMenuResult = {
  activeIndex: number;
  closeMenu: () => void;
  commands: SlashCommand[];
  openMenuAtContext: (
    view: EditorView,
    rect: { top: number; left: number; bottom: number },
  ) => void;
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
  viewKey,
  viewRef,
}: UseSlashMenuOptions): UseSlashMenuResult {
  const [state, setState] = useState<SlashMenuState>(HIDDEN_SLASH_STATE);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const filteredCommandsRef = useRef<SlashCommand[]>([]);
  const stateRef = useRef<SlashMenuState>(HIDDEN_SLASH_STATE);

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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setMenuState = useCallback((nextState: SlashMenuState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const closeMenu = useCallback(() => {
    if (stateRef.current.visible) {
      setMenuState(HIDDEN_SLASH_STATE);
    }
    const view = viewRef.current;
    if (view) {
      view.focus();
    }
  }, [setMenuState, viewRef]);

  const openMenuAtContext = useCallback(
    (
      view: EditorView,
      rect: { top: number; left: number; bottom: number },
    ) => {
      const selection = view.state.selection.main;
      setActiveIndex(0);
      setMenuState({
        query: "",
        rect,
        slashFrom: selection.from,
        slashTo: selection.to,
        source: "context",
        visible: true,
      });
      view.focus();
    },
    [setMenuState],
  );

  const runCommand = useCallback(
    (command: SlashCommand) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      const currentState = stateRef.current;
      if ("insertText" in command) {
        const match =
          currentState.source === "context" && currentState.visible
            ? {
                from: view.state.selection.main.from,
                query: "",
                to: view.state.selection.main.to,
              }
            : findSlashMatch(view);
        if (!match) return;
        view.dispatch({
          changes: { from: match.from, to: match.to, insert: command.insertText },
          selection: {
            anchor: match.from + command.insertText.length,
          },
        });
        view.focus();
      } else {
        const match =
          currentState.source === "context" && currentState.visible
            ? null
            : findSlashMatch(view);
        if (match) {
          view.dispatch({
            changes: { from: match.from, to: match.to, insert: "" },
          });
        }
        view.focus();
        command.action();
      }
      setMenuState(HIDDEN_SLASH_STATE);
    },
    [setMenuState, viewRef],
  );

  useEffect(() => {
    if (!enabled) {
      setMenuState(HIDDEN_SLASH_STATE);
      return;
    }
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const update = () => {
      if (
        stateRef.current.visible &&
        stateRef.current.source === "context"
      ) {
        return;
      }
      if (isComposing(view)) {
        const current = stateRef.current;
        if (current.visible) {
          setMenuState({ ...current, rect: null, visible: false });
        }
        return;
      }
      const match = findSlashMatch(view);
      if (!match) {
        const current = stateRef.current;
        if (current.visible) {
          setMenuState({ ...current, query: "", rect: null, visible: false });
        }
        return;
      }
      const rect = readCursorRect(view, match.to);
      setMenuState({
        query: match.query,
        rect,
        slashFrom: match.from,
        slashTo: match.to,
        source: "typed",
        visible: true,
      });
    };

    update();
    const dom = view.contentDOM;
    const onCompositionStart = () => {
      const current = stateRef.current;
      if (current.visible) {
        setMenuState({ ...current, rect: null, visible: false });
      }
    };
    const onCompositionEnd = () => {
      update();
    };
    const onSelectionChange = () => {
      update();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (stateRef.current.visible) {
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
    const onWindowMouseDown = (event: MouseEvent) => {
      if (!stateRef.current.visible) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        closeMenu();
        return;
      }
      if (view.dom.contains(target)) {
        return;
      }
      const menu = document.querySelector(".slash-menu");
      if (menu?.contains(target)) {
        return;
      }
      closeMenu();
    };
    dom.addEventListener("compositionstart", onCompositionStart);
    dom.addEventListener("compositionend", onCompositionEnd);
    dom.addEventListener("input", onSelectionChange);
    dom.addEventListener("keyup", onSelectionChange);
    dom.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onWindowMouseDown, true);
    return () => {
      dom.removeEventListener("compositionstart", onCompositionStart);
      dom.removeEventListener("compositionend", onCompositionEnd);
      dom.removeEventListener("input", onSelectionChange);
      dom.removeEventListener("keyup", onSelectionChange);
      dom.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onWindowMouseDown, true);
    };
  }, [closeMenu, enabled, runCommand, setMenuState, viewKey, viewRef]);

  return {
    activeIndex,
    closeMenu,
    commands: filteredCommands,
    openMenuAtContext,
    runCommand,
    setActiveIndex,
    state,
  };
}
