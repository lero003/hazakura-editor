import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// CommandPalette's `Command` shape is intentionally tiny: the palette
// is a thin command launcher over the existing safe editor / agent /
// file actions, not a plugin surface. Each command declares its
// label, category, optional shortcut hint, optional keywords for
// fuzzy matching, and a `run` callback that fires the underlying
// action. When a precondition is not met, set `disabledReason` to a
// localized string: the command stays visible for discoverability and
// VoiceOver, but Enter / click must not run it (v1.13 Command availability).

export type Command = {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  description?: string;
  /** Localized reason when the command cannot run. Presence means disabled. */
  disabledReason?: string;
  keywords?: readonly string[];
  run: () => void;
};

export function isCommandEnabled(command: Command): boolean {
  return !command.disabledReason;
}

type UseCommandPaletteOptions = {
  commands: Command[];
};

type UseCommandPaletteResult = {
  activeIndex: number;
  closeCommandPalette: () => void;
  commandPaletteVisible: boolean;
  filteredCommands: Command[];
  openCommandPalette: () => void;
  query: string;
  runCommand: (command: Command) => void;
  setActiveIndex: (index: number) => void;
  setQuery: (query: string) => void;
};

function fuzzyScoreCommand(query: string, command: Command): number {
  if (!query) {
    return 0;
  }
  const normalized = query.toLowerCase();
  const label = command.label.toLowerCase();

  if (label === normalized) {
    return 1000;
  }
  const labelIdx = label.indexOf(normalized);
  if (labelIdx >= 0) {
    return 800 - labelIdx;
  }
  for (const word of label.split(/\s+/)) {
    if (word.startsWith(normalized)) {
      return 600 - word.length;
    }
  }
  if (label.includes(normalized)) {
    return 400 - label.indexOf(normalized);
  }
  const category = command.category.toLowerCase();
  if (category.includes(normalized)) {
    return 200 - category.indexOf(normalized);
  }
  for (const keyword of command.keywords ?? []) {
    if (keyword.toLowerCase().includes(normalized)) {
      return 100;
    }
  }
  let labelIndex = 0;
  for (let queryIndex = 0; queryIndex < normalized.length; queryIndex += 1) {
    labelIndex = label.indexOf(normalized[queryIndex], labelIndex);
    if (labelIndex < 0) {
      return -1;
    }
    labelIndex += 1;
  }
  return 10;
}

export function useCommandPalette({
  commands,
}: UseCommandPaletteOptions): UseCommandPaletteResult {
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const filteredCommands = useMemo(() => {
    if (!commandPaletteVisible) {
      return [];
    }
    if (!query.trim()) {
      return commands;
    }
    const normalized = query.toLowerCase();
    return commands
      .map((cmd) => ({ cmd, score: fuzzyScoreCommand(normalized, cmd) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.cmd);
  }, [commands, query, commandPaletteVisible]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredCommands.length, commandPaletteVisible]);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteVisible(true);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteVisible(false);
  }, []);

  const runCommand = useCallback((command: Command) => {
    if (!isCommandEnabled(command)) {
      // Keep the palette open so the disabled reason remains readable.
      return;
    }
    setCommandPaletteVisible(false);
    command.run();
  }, []);

  return {
    activeIndex,
    closeCommandPalette,
    commandPaletteVisible,
    filteredCommands,
    openCommandPalette,
    query,
    runCommand,
    setActiveIndex,
    setQuery,
  };
}
