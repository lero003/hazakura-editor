import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// CommandPalette's `Command` shape is intentionally tiny: the palette
// is a thin command launcher over the existing safe editor / agent /
// file actions, not a plugin surface. Each command declares its
// label, category, optional shortcut hint, optional keywords for
// fuzzy matching, and a `run` callback that fires the underlying
// action. There is no per-command `enabled` state at this layer —
// existing modal-open guards already block run-after-close races,
// and the underlying actions are expected to be no-ops when their
// preconditions are not met.

export type Command = {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  description?: string;
  keywords?: readonly string[];
  run: () => void;
};

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
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const filteredCommands = useMemo(() => {
    if (!commandPaletteVisible) {
      return [];
    }
    if (!query.trim()) {
      return commandsRef.current;
    }
    const normalized = query.toLowerCase();
    return commandsRef.current
      .map((cmd) => ({ cmd, score: fuzzyScoreCommand(normalized, cmd) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.cmd);
  }, [query, commandPaletteVisible]);

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
