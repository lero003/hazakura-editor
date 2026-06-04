import type { CompareCase, CompareViewState, MenuLanguage } from "../../types";
import { ChangeReviewView } from "../review/ChangeReviewView";
import { FileCompareView } from "./FileCompareView";

// Right-pane compare router. The candidate preview lives in the
// Review Surface and is rendered through DiffBody directly; this
// router is intentionally restricted to file / changes cases so the
// right-pane route never silently tries to render a manual
// candidate.
type RightPaneCompareCase = Extract<CompareCase, { kind: "file" | "changes" }>;

type DiffPaneProps = {
  compareCase: RightPaneCompareCase;
  menuLanguage: MenuLanguage;
  onApplyBackup?: (documentPath: string, backupContents: string) => void;
  onClose: () => void;
  view: CompareViewState;
};

export function DiffPane({
  compareCase,
  menuLanguage,
  onApplyBackup,
  onClose,
  view,
}: DiffPaneProps) {
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
      onApplyBackup={onApplyBackup}
      onClose={onClose}
      view={view}
    />
  );
}
