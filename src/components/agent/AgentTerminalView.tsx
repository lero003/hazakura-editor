import { useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { AgentTerminalSize } from "../../types";
import type { AgentWorkbenchOutputChunk } from "../../lib/tauri";
import { AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS } from "../../types";

function normalizeTerminalLineEndings(text: string): string {
  return text.replace(/\r?\n/g, "\r\n");
}

interface XtermTheme {
  background: string;
  black: string;
  blue: string;
  brightBlack: string;
  brightBlue: string;
  brightCyan: string;
  brightGreen: string;
  brightMagenta: string;
  brightRed: string;
  brightWhite: string;
  brightYellow: string;
  cyan: string;
  cursor: string;
  foreground: string;
  green: string;
  magenta: string;
  red: string;
  selectionBackground: string;
  white: string;
  yellow: string;
}

// xterm theme is read from CSS custom properties on the active
// `:root[data-theme="..."]` block in `src/styles/themes.css`. Each
// theme defines 20 `--xterm-*` tokens (bg, fg, cursor, selection-bg,
// 8 normal + 8 bright ANSI colors). The `theme` prop is used as the
// effect's dependency so this re-runs when the user switches theme;
// the actual palette comes from the cascade, not a JS-side map.
function readXtermTheme(): XtermTheme {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    background: v("--xterm-bg"),
    black: v("--xterm-black"),
    blue: v("--xterm-blue"),
    brightBlack: v("--xterm-bright-black"),
    brightBlue: v("--xterm-bright-blue"),
    brightCyan: v("--xterm-bright-cyan"),
    brightGreen: v("--xterm-bright-green"),
    brightMagenta: v("--xterm-bright-magenta"),
    brightRed: v("--xterm-bright-red"),
    brightWhite: v("--xterm-bright-white"),
    brightYellow: v("--xterm-bright-yellow"),
    cyan: v("--xterm-cyan"),
    cursor: v("--xterm-cursor"),
    foreground: v("--xterm-fg"),
    green: v("--xterm-green"),
    magenta: v("--xterm-magenta"),
    red: v("--xterm-red"),
    selectionBackground: v("--xterm-selection-bg"),
    white: v("--xterm-white"),
    yellow: v("--xterm-yellow"),
  };
}

export function AgentTerminalView({
  activeSession,
  outputLabel,
  onData,
  onEngage,
  onRelease,
  onResize,
  output,
  placeholder,
  terminalLabel,
  theme,
}: {
  activeSession: boolean;
  outputLabel: string;
  onData: (data: string) => void;
  onEngage: () => void;
  onRelease: () => void;
  onResize: (size: AgentTerminalSize) => void;
  output: AgentWorkbenchOutputChunk[];
  placeholder: string;
  terminalLabel: string;
  theme: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const lastOutputSeqRef = useRef(0);
  const lastTerminalSizeRef = useRef<AgentTerminalSize | null>(null);
  const activeSessionRef = useRef(activeSession);
  const onDataRef = useRef(onData);
  const onResizeRef = useRef(onResize);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showInactivePlaceholder = !activeSession && output.length === 0;

  // Tick a `now` clock inside the terminal view so the meta row can
  // show "last output 3s ago" without coupling the caller to a
  // re-render. Only re-renders the meta line; xterm output is not
  // touched on this tick.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      disableStdin: !activeSessionRef.current,
      fontFamily:
        '"SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 2000,
      theme: readXtermTheme(),
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    const fitAndNotify = () => {
      fitAddon.fit();
      const dimensions = fitAddon.proposeDimensions();
      if (!dimensions) {
        return;
      }

      const nextSize = {
        columns: Math.max(1, Math.min(500, dimensions.cols)),
        rows: Math.max(1, Math.min(200, dimensions.rows)),
      };
      const previousSize = lastTerminalSizeRef.current;
      if (
        previousSize?.columns === nextSize.columns &&
        previousSize.rows === nextSize.rows
      ) {
        return;
      }

      lastTerminalSizeRef.current = nextSize;
      // Debounce resize notifications (100ms)
      if (resizeTimerRef.current !== null) {
        clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = setTimeout(
        () => onResizeRef.current(nextSize),
        100,
      );
    };
    fitAndNotify();

    const dataDisposable = terminal.onData((data) => {
      if (activeSessionRef.current) {
        onDataRef.current(data);
      }
    });
    const resizeObserver = new ResizeObserver(() => {
      fitAndNotify();
    });
    resizeObserver.observe(host);
    const focusTerminal = () => {
      onEngage();
      if (activeSessionRef.current) {
        terminal.focus();
      }
    };
    const blurTerminal = () => {
      onRelease();
      terminal.blur();
    };
    const blurTerminalWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        blurTerminal();
      }
    };
    host.addEventListener("pointerenter", onEngage);
    host.addEventListener("pointerdown", focusTerminal);
    host.addEventListener("mouseleave", blurTerminal);
    window.addEventListener("blur", blurTerminal);
    document.addEventListener("visibilitychange", blurTerminalWhenHidden);

    terminalRef.current = terminal;

    return () => {
      document.removeEventListener("visibilitychange", blurTerminalWhenHidden);
      window.removeEventListener("blur", blurTerminal);
      host.removeEventListener("mouseleave", blurTerminal);
      host.removeEventListener("pointerdown", focusTerminal);
      host.removeEventListener("pointerenter", onEngage);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      if (resizeTimerRef.current !== null) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      lastOutputSeqRef.current = 0;
      lastTerminalSizeRef.current = null;
    };
  }, []);

  // Update xterm theme when it changes
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const xtermTheme = readXtermTheme();
    terminal.options.theme = xtermTheme;
    // Force a repaint for the cursor color if active
    terminal.refresh(0, terminal.rows - 1);
  }, [theme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (output.length === 0) {
      terminal.clear();
      lastOutputSeqRef.current = 0;
      return;
    }

    for (const chunk of output) {
      if (chunk.seq <= lastOutputSeqRef.current) {
        continue;
      }

      if (chunk.stream === "system") {
        terminal.write(`\r\n${normalizeTerminalLineEndings(chunk.text)}`);
      } else {
        terminal.write(chunk.text);
      }
      lastOutputSeqRef.current = chunk.seq;
    }
  }, [output]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.disableStdin = !activeSession;
    }

    if (!activeSession) {
      terminalRef.current?.blur();
    }
  }, [activeSession]);

  const lastOutputAt = useMemo(() => {
    if (output.length === 0) {
      return null;
    }
    return output[output.length - 1]?.receivedAtMs ?? null;
  }, [output]);

  const lastOutputLabel = useMemo(() => {
    if (lastOutputAt === null) {
      return "—";
    }
    const seconds = Math.max(0, Math.floor((now - lastOutputAt) / 1000));
    if (seconds < 5) {
      return "just now";
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ${seconds % 60}s ago`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }, [lastOutputAt, now]);

  return (
    <div
      className={`agent-terminal-shell ${activeSession ? "active" : "inactive"}`}
    >
      <div className="agent-terminal-meta">
        <span className="agent-terminal-meta-cell">
          {outputLabel}: {output.length} / {AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS}
        </span>
        <span className="agent-terminal-meta-sep" aria-hidden="true">
          ·
        </span>
        <span className="agent-terminal-meta-cell">
          <span className="agent-terminal-meta-key">last</span>
          <span className="agent-terminal-meta-val">{lastOutputLabel}</span>
        </span>
        <span className="agent-terminal-meta-sep" aria-hidden="true">
          ·
        </span>
        <span
          className="agent-terminal-meta-cell"
          data-input={activeSession ? "ready" : "disabled"}
        >
          <span className="agent-terminal-meta-key">input</span>
          <span className="agent-terminal-meta-val">
            {activeSession ? "ready" : "disabled"}
          </span>
        </span>
      </div>
      <div
        aria-label={terminalLabel}
        className="agent-terminal-host"
        ref={hostRef}
      />
      {showInactivePlaceholder ? (
        <div className="agent-terminal-placeholder">{placeholder}</div>
      ) : null}
    </div>
  );
}
