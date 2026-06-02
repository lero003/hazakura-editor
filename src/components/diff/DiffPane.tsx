import type { CompareCase, CompareViewState, MenuLanguage } from "../../types";
import { ChangeReviewView } from "../review/ChangeReviewView";
import { FileCompareView } from "./FileCompareView";

// Right-pane compare router. The candidate preview lives in the
// Review Surface and is rendered through DiffBody directly; this
// router is intentionally restricted to file / changes cases so the
// right-pane route never silently tries to render a manual
// candidate.
type RightPaneCompareCase = Extract<CompareCase, { kind: "file" | "changes" }>;

export function DiffPane({
  compareCase,
  menuLanguage,
  onClose,
  view,
}: {
  compareCase: RightPaneCompareCase;
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
