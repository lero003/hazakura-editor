import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from "react";
import type {
  EditorPaneHandle,
  MarkdownFormat,
} from "../components/EditorPane";
import type { EditableLineEnding, EditorTab, MarkdownHeading } from "../types";
import { normalizeTextLineEndings } from "../utils";
import { formatLineEndingKind } from "./useDocumentStatus";
import { markdownFormatStatus } from "../statusMessages";

type UseEditorCommandsOptions = {
  activeTab: EditorTab | null;
  activeTabId: string | null;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  setStatus: (message: string) => void;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
};

export function useEditorCommands({
  activeTab,
  activeTabId,
  editorPaneRef,
  setStatus,
  setTabs,
}: UseEditorCommandsOptions) {
  const handleEditorChange = useCallback(
    (nextValue: string) => {
      if (!activeTabId) {
        return;
      }

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                contents: nextValue,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
    },
    [activeTabId, setTabs],
  );

  const insertMarkdownAtCursor = useCallback(
    (markdown: string) => {
      editorPaneRef.current?.insertText(markdown);
    },
    [editorPaneRef],
  );

  const insertTable = useCallback(() => {
    editorPaneRef.current?.insertTable(3);
  }, [editorPaneRef]);

  const jumpToHeading = useCallback(
    (heading: MarkdownHeading) => {
      editorPaneRef.current?.goToLine(heading.line);
      setStatus(`Moved to line ${heading.line}`);
    },
    [editorPaneRef, setStatus],
  );

  const convertActiveLineEnding = useCallback(
    (lineEnding: EditableLineEnding) => {
      if (!activeTab) {
        setStatus("No active tab to convert");
        return;
      }

      const nextContents = normalizeTextLineEndings(
        activeTab.contents,
        "lf",
      );

      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === activeTab.id
            ? {
                ...tab,
                contents: nextContents,
                line_ending: lineEnding,
                saveStatus: "idle",
                error: null,
              }
            : tab,
        ),
      );
      setStatus(`Line endings set to ${formatLineEndingKind(lineEnding)}`);
    },
    [activeTab, setStatus, setTabs],
  );

  const applyActiveMarkdownFormat = useCallback(
    (format: MarkdownFormat) => {
      if (!activeTab) {
        setStatus("No active tab to format");
        return;
      }

      editorPaneRef.current?.applyMarkdownFormat(format);
      setStatus(markdownFormatStatus(format));
    },
    [activeTab, editorPaneRef, setStatus],
  );

  return {
    applyActiveMarkdownFormat,
    convertActiveLineEnding,
    handleEditorChange,
    insertMarkdownAtCursor,
    insertTable,
    jumpToHeading,
  };
}
