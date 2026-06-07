import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import type { SearchOptions } from "../../types";

type FindReplaceBarCopy = {
  caseSensitive: string;
  closeSearch: string;
  find: string;
  findInActiveFile: string;
  findOptions: string;
  go: string;
  goToLine: string;
  invalidRegex: string;
  line: string;
  next: string;
  noMatches: string;
  noSearch: string;
  previous: string;
  regex: string;
  replace: string;
  replaceAll: string;
  replaceOne: string;
  replacePlaceholder: string;
  searchActiveFile: string;
  word: string;
};

type FindReplaceBarProps = {
  activeMatchIndex: number;
  copy: FindReplaceBarCopy;
  findInputRef: RefObject<HTMLInputElement | null>;
  findMatchCount: number;
  findQuery: string;
  goToLineValue: string;
  invalidRegex: boolean;
  onClose: () => void;
  onFindKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onGoToLine: () => void;
  onGoToLineKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onNextMatch: () => void;
  onPreviousMatch: () => void;
  onReplaceAll: () => void;
  onReplaceKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onReplaceOne: () => void;
  replaceQuery: string;
  searchOptions: SearchOptions;
  setFindQuery: (value: string) => void;
  setGoToLineValue: (value: string) => void;
  setReplaceQuery: (value: string) => void;
  setSearchOptions: Dispatch<SetStateAction<SearchOptions>>;
};

export function FindReplaceBar({
  activeMatchIndex,
  copy,
  findInputRef,
  findMatchCount,
  findQuery,
  goToLineValue,
  invalidRegex,
  onClose,
  onFindKeyDown,
  onGoToLine,
  onGoToLineKeyDown,
  onNextMatch,
  onPreviousMatch,
  onReplaceAll,
  onReplaceKeyDown,
  onReplaceOne,
  replaceQuery,
  searchOptions,
  setFindQuery,
  setGoToLineValue,
  setReplaceQuery,
  setSearchOptions,
}: FindReplaceBarProps) {
  return (
    <section className="find-panel" aria-label={copy.findInActiveFile}>
      <button
        type="button"
        className="find-close"
        onClick={onClose}
        aria-label={copy.closeSearch}
        title={copy.closeSearch}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 2L8 8M8 2L2 8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="find-panel__row find-panel__row--main">
        <label className="find-control find-control--main">
          <span className="find-control__label">{copy.find}</span>
          <input
            ref={findInputRef}
            type="search"
            value={findQuery}
            onChange={(event) => setFindQuery(event.target.value)}
            onKeyDown={onFindKeyDown}
            placeholder={copy.searchActiveFile}
          />
        </label>
        <div className="find-actions">
          <button
            type="button"
            onClick={onPreviousMatch}
            disabled={findMatchCount === 0}
            aria-label={copy.previous}
            title={copy.previous}
          >
            {copy.previous}
          </button>
          <button
            type="button"
            onClick={onNextMatch}
            disabled={findMatchCount === 0}
            aria-label={copy.next}
            title={copy.next}
          >
            {copy.next}
          </button>
          <span className="find-count" aria-live="polite">
            {findQuery
              ? invalidRegex
                ? copy.invalidRegex
                : findMatchCount > 0
                  ? `${activeMatchIndex + 1} / ${findMatchCount}`
                  : copy.noMatches
              : copy.noSearch}
          </span>
        </div>
        <div className="find-options" aria-label={copy.findOptions}>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={searchOptions.caseSensitive}
              onChange={(event) =>
                setSearchOptions((current) => ({
                  ...current,
                  caseSensitive: event.target.checked,
                }))
              }
            />
            <span>{copy.caseSensitive}</span>
          </label>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={searchOptions.wholeWord}
              onChange={(event) =>
                setSearchOptions((current) => ({
                  ...current,
                  wholeWord: event.target.checked,
                }))
              }
            />
            <span>{copy.word}</span>
          </label>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={searchOptions.regex}
              onChange={(event) =>
                setSearchOptions((current) => ({
                  ...current,
                  regex: event.target.checked,
                }))
              }
            />
            <span>{copy.regex}</span>
          </label>
        </div>
      </div>

      <div className="find-panel__row find-panel__row--replace">
        <label className="find-control find-control--replace">
          <span className="find-control__label">{copy.replace}</span>
          <input
            type="search"
            value={replaceQuery}
            onChange={(event) => setReplaceQuery(event.target.value)}
            onKeyDown={onReplaceKeyDown}
            placeholder={copy.replacePlaceholder}
          />
        </label>
        <div className="find-actions">
          <button
            type="button"
            onClick={onReplaceOne}
            disabled={findMatchCount === 0}
          >
            {copy.replaceOne}
          </button>
          <button
            type="button"
            onClick={onReplaceAll}
            disabled={findMatchCount === 0}
          >
            {copy.replaceAll}
          </button>
        </div>
      </div>

      <div className="find-panel__row find-panel__row--goto">
        <label className="find-control find-control--goto" htmlFor="go-to-line-input">
          <span className="find-control__label">{copy.line}</span>
          <input
            aria-label={copy.goToLine}
            id="go-to-line-input"
            type="number"
            min="1"
            value={goToLineValue}
            onChange={(event) => setGoToLineValue(event.target.value)}
            onKeyDown={onGoToLineKeyDown}
          />
        </label>
        <button
          aria-label={copy.goToLine}
          type="button"
          onClick={onGoToLine}
          className="find-panel__goto-button"
        >
          {copy.go}
        </button>
      </div>
    </section>
  );
}
