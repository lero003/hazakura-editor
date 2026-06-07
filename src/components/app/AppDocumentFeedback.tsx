import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import { FindReplaceBar } from "../find/FindReplaceBar";
import { RecoveryMessages } from "./RecoveryMessages";
import type { EditorChromeCopy, RecoveryCopy } from "../../lib/locale";
import type { DraftRecord, EditorTab, SearchOptions } from "../../types";

type AppDocumentFeedbackProps = {
  activeConflict: boolean;
  activeDraft: DraftRecord | null;
  activeError: string | null;
  activeMatchIndex: number;
  activeSaveError: boolean;
  activeTab: EditorTab | null;
  closeFindAndFocusEditor: () => void;
  closeTabNow: (tabId: string) => void;
  clearSaveError: (tabId: string) => void;
  discardDraft: (draftPath: string) => void;
  editorChromeCopy: EditorChromeCopy;
  findInputRef: RefObject<HTMLInputElement | null>;
  findMatchCount: number;
  findQuery: string;
  findVisible: boolean;
  handleFindKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  handleReplaceKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  invalidRegex: boolean;
  keepEditingAfterConflict: (tabId: string) => void;
  lModeEnabled: boolean;
  recoveryCopy: RecoveryCopy;
  reopenTabFromDisk: (tabId: string) => void;
  replaceAll: () => void;
  replaceOne: () => void;
  replaceQuery: string;
  restoreDraft: (draft: DraftRecord) => void;
  reviewDraftAgainstDisk: (tab: EditorTab, draft: DraftRecord) => void;
  reviewTabAgainstDisk: (tab: EditorTab) => void;
  saveTabById: (tabId: string) => unknown;
  searchOptions: SearchOptions;
  setFindQuery: (value: string) => void;
  setReplaceQuery: (value: string) => void;
  setSearchOptions: Dispatch<SetStateAction<SearchOptions>>;
  showNextMatch: () => void;
  showPreviousMatch: () => void;
};

export function AppDocumentFeedback({
  activeConflict,
  activeDraft,
  activeError,
  activeMatchIndex,
  activeSaveError,
  activeTab,
  closeFindAndFocusEditor,
  closeTabNow,
  clearSaveError,
  discardDraft,
  editorChromeCopy,
  findInputRef,
  findMatchCount,
  findQuery,
  findVisible,
  handleFindKeyDown,
  handleReplaceKeyDown,
  invalidRegex,
  keepEditingAfterConflict,
  lModeEnabled,
  recoveryCopy,
  reopenTabFromDisk,
  replaceAll,
  replaceOne,
  replaceQuery,
  restoreDraft,
  reviewDraftAgainstDisk,
  reviewTabAgainstDisk,
  saveTabById,
  searchOptions,
  setFindQuery,
  setReplaceQuery,
  setSearchOptions,
  showNextMatch,
  showPreviousMatch,
}: AppDocumentFeedbackProps) {
  return (
    <div className="document-feedback-row">
      {findVisible ? (
        <FindReplaceBar
          activeMatchIndex={activeMatchIndex}
          copy={editorChromeCopy}
          findInputRef={findInputRef}
          findMatchCount={findMatchCount}
          findQuery={findQuery}
          invalidRegex={invalidRegex}
          onClose={closeFindAndFocusEditor}
          onFindKeyDown={handleFindKeyDown}
          onNextMatch={showNextMatch}
          onPreviousMatch={showPreviousMatch}
          onReplaceAll={replaceAll}
          onReplaceKeyDown={handleReplaceKeyDown}
          onReplaceOne={replaceOne}
          replaceQuery={replaceQuery}
          searchOptions={searchOptions}
          setFindQuery={setFindQuery}
          setReplaceQuery={setReplaceQuery}
          setSearchOptions={setSearchOptions}
        />
      ) : null}

      <RecoveryMessages
        activeConflict={activeConflict}
        activeDraft={activeDraft}
        activeError={activeError}
        activeSaveError={activeSaveError}
        activeTab={activeTab}
        copy={recoveryCopy}
        draftReviewAvailable={!lModeEnabled}
        onClearSaveError={clearSaveError}
        onCloseTabWithoutSaving={closeTabNow}
        onDiscardDraft={discardDraft}
        onKeepEditingAfterConflict={keepEditingAfterConflict}
        onReopenTabFromDisk={reopenTabFromDisk}
        onRestoreDraft={restoreDraft}
        onReviewDraftAgainstDisk={reviewDraftAgainstDisk}
        onReviewTabAgainstDisk={reviewTabAgainstDisk}
        onTrySaveAgain={(tabId) => void saveTabById(tabId)}
      />
    </div>
  );
}
