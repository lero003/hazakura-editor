import {
  useCallback,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type { EditorPaneHandle } from "../../components/EditorPane";
import { isImeComposing } from "../../keyboard";

type UseFindReplaceActionsOptions = {
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  findMatchCount: number;
  replaceQuery: string;
  setActiveMatchIndex: Dispatch<SetStateAction<number>>;
  setFindQuery: Dispatch<SetStateAction<string>>;
  setFindVisible: Dispatch<SetStateAction<boolean>>;
  setReplaceQuery: Dispatch<SetStateAction<string>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useFindReplaceActions({
  editorPaneRef,
  findMatchCount,
  replaceQuery,
  setActiveMatchIndex,
  setFindQuery,
  setFindVisible,
  setReplaceQuery,
  setStatus,
}: UseFindReplaceActionsOptions) {
  const showNextMatch = useCallback(() => {
    if (findMatchCount === 0) {
      return;
    }

    setActiveMatchIndex((current) => (current + 1) % findMatchCount);
  }, [findMatchCount, setActiveMatchIndex]);

  const showPreviousMatch = useCallback(() => {
    if (findMatchCount === 0) {
      return;
    }

    setActiveMatchIndex(
      (current) => (current - 1 + findMatchCount) % findMatchCount,
    );
  }, [findMatchCount, setActiveMatchIndex]);

  const closeFindAndFocusEditor = useCallback(() => {
    setFindQuery("");
    setReplaceQuery("");
    setActiveMatchIndex(0);
    setFindVisible(false);
    editorPaneRef.current?.focus();
    setStatus("Find closed");
  }, [
    editorPaneRef,
    setActiveMatchIndex,
    setFindQuery,
    setFindVisible,
    setReplaceQuery,
    setStatus,
  ]);

  const replaceOne = useCallback(() => {
    const replaced = editorPaneRef.current?.replaceCurrent(replaceQuery);

    if (replaced) {
      showNextMatch();
    }
  }, [editorPaneRef, replaceQuery, showNextMatch]);

  const replaceAll = useCallback(() => {
    editorPaneRef.current?.replaceAll(replaceQuery);
  }, [editorPaneRef, replaceQuery]);

  const handleReplaceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (isImeComposing(event.nativeEvent)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        replaceOne();
      }
    },
    [replaceOne],
  );

  const handleFindKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (isImeComposing(event.nativeEvent)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeFindAndFocusEditor();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();

        if (event.shiftKey) {
          showPreviousMatch();
        } else {
          showNextMatch();
        }
      }
    },
    [closeFindAndFocusEditor, showNextMatch, showPreviousMatch],
  );

  return {
    closeFindAndFocusEditor,
    handleFindKeyDown,
    handleReplaceKeyDown,
    replaceAll,
    replaceOne,
    showNextMatch,
    showPreviousMatch,
  };
}
