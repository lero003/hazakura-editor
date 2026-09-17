import {
  useCallback,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { isImeComposing } from "../../lib/keyboard";
import type { TextMatch } from "../../types";

type UseFindReplaceActionsOptions = {
  activeMatchIndex: number;
  editorPaneRef: RefObject<EditorPaneHandle | null>;
  findMatches: readonly TextMatch[];
  findMatchCount: number;
  // Local Assist 生成ロック中は置換（1件・全件）を止める。検索は使える。
  replaceLocked?: boolean;
  replaceQuery: string;
  // 置換後に、その位置より後ろの最初の一致を選び直す。
  selectMatchAfter: (position: number) => void;
  setActiveMatchIndex: Dispatch<SetStateAction<number>>;
  setFindQuery: Dispatch<SetStateAction<string>>;
  setFindVisible: Dispatch<SetStateAction<boolean>>;
  setReplaceQuery: Dispatch<SetStateAction<string>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useFindReplaceActions({
  activeMatchIndex,
  editorPaneRef,
  findMatches,
  findMatchCount,
  replaceLocked = false,
  replaceQuery,
  selectMatchAfter,
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
    if (replaceLocked) {
      return;
    }

    const activeMatch = findMatches[activeMatchIndex];

    if (!activeMatch) {
      return;
    }

    const replaced = editorPaneRef.current?.replaceCurrent(replaceQuery);

    if (replaced) {
      // 番号を進めるのではなく、置換後の位置から次の一致を選び直す。
      selectMatchAfter(activeMatch.from + replaceQuery.length);
    }
  }, [
    activeMatchIndex,
    editorPaneRef,
    findMatches,
    replaceLocked,
    replaceQuery,
    selectMatchAfter,
  ]);

  const replaceAll = useCallback(() => {
    if (replaceLocked) {
      return;
    }

    editorPaneRef.current?.replaceAll(replaceQuery);
  }, [editorPaneRef, replaceLocked, replaceQuery]);

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
