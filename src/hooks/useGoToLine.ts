import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useState,
} from "react";
import { isImeComposing } from "../keyboard";

type EditorLineTarget = {
  goToLine: (line: number) => void;
};

type UseGoToLineOptions = {
  editorPaneRef: RefObject<EditorLineTarget | null>;
  onStatus: (message: string) => void;
};

export function useGoToLine({
  editorPaneRef,
  onStatus,
}: UseGoToLineOptions) {
  const [goToLineValue, setGoToLineValue] = useState("");

  const goToLine = useCallback(() => {
    const requestedLine = Number(goToLineValue);

    if (!Number.isFinite(requestedLine) || requestedLine < 1) {
      onStatus("Enter a valid line number");
      return;
    }

    editorPaneRef.current?.goToLine(requestedLine);
    onStatus(`Moved to line ${Math.trunc(requestedLine)}`);
  }, [editorPaneRef, goToLineValue, onStatus]);

  const handleGoToLineKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (isImeComposing(event.nativeEvent)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        goToLine();
      }
    },
    [goToLine],
  );

  return {
    goToLine,
    goToLineValue,
    handleGoToLineKeyDown,
    setGoToLineValue,
  };
}
