import type { CompareCase, CompareViewState, MenuLanguage } from "../types";
import { ChangeReviewView } from "./ChangeReviewView";
import { FileCompareView } from "./FileCompareView";

export function DiffPane({
  compareCase,
  menuLanguage,
  onClose,
  view,
}: {
  compareCase: CompareCase;
  menuLanguage: MenuLanguage;
  onClose: () => void;
  view: CompareViewState;
}) {
  if (compareCase.kind === "file") {
    return (
      <FileCompareView
        compareCase={compareCase}
        menuLanguage={menuLanguage}
        onClose={onClose}
        view={view}
      />
    );
  }

  return (
    <ChangeReviewView
      compareCase={compareCase}
      menuLanguage={menuLanguage}
      onClose={onClose}
      view={view}
    />
  );
}
