import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { FindReplaceBar } from "./FindReplaceBar";
import { getEditorChromeCopy } from "../../lib/locale";
import type { MenuLanguage, SearchOptions } from "../../types";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const defaultSearchOptions: SearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

const noopKeyDown = (_event: ReactKeyboardEvent<HTMLInputElement>) => {};

// FindReplaceBar の3トグル (caseSensitive / wholeWord / regex) は実ユーザパス
// (検索オプション) でありながら長らくテスト未カバーだった。これらは
// event.target.checked を読んで setSearchOptions の updater を呼ぶ実装で、
// jsdom の fireEvent.click(checkbox) が checked を確実には反転させない既知の
// 罠に巻き込まれやすいパターン。SettingsPreferencesPane のトグルテストと同じく、
// 本物の useState を通した最終状態検証で実装の内部形式によらず検証する。
function renderFindBar(
  initial: SearchOptions,
  menuLanguage: MenuLanguage = "en",
) {
  function TestComponent() {
    const [options, setOptions] = useState<SearchOptions>(initial);
    return (
      <FindReplaceBar
        activeMatchIndex={0}
        copy={getEditorChromeCopy(menuLanguage)}
        findInputRef={{ current: null }}
        findMatchCount={0}
        findQuery=""
        goToLineValue=""
        invalidRegex={false}
        onClose={vi.fn()}
        onFindKeyDown={noopKeyDown}
        onGoToLine={vi.fn()}
        onGoToLineKeyDown={noopKeyDown}
        onNextMatch={vi.fn()}
        onPreviousMatch={vi.fn()}
        onReplaceAll={vi.fn()}
        onReplaceKeyDown={noopKeyDown}
        onReplaceOne={vi.fn()}
        replaceQuery=""
        searchOptions={options}
        setFindQuery={vi.fn()}
        setGoToLineValue={vi.fn()}
        setReplaceQuery={vi.fn()}
        // Dispatch<SetStateAction<SearchOptions>> を本物の useState にそのまま
        // 接続する。実装が updater 関数渡しか値渡しに変わっても React が正しく
        // 適用するため、テストは実装の内部形式に依存しない。
        setSearchOptions={setOptions}
      />
    );
  }
  render(<TestComponent />);
}

describe("FindReplaceBar search option toggles", () => {
  it("toggles caseSensitive on", () => {
    renderFindBar(defaultSearchOptions);

    const toggle = screen.getByRole("checkbox", {
      name: /Case/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    // 本物の useState 経由で caseSensitive が false -> true に反転した結果、
    // 制御された checkbox の checked が true になっていることを最終状態で検証する。
    expect(toggle.checked).toBe(true);
  });

  it("toggles wholeWord on", () => {
    renderFindBar(defaultSearchOptions);

    const toggle = screen.getByRole("checkbox", {
      name: /Word/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(toggle.checked).toBe(true);
  });

  it("toggles regex on", () => {
    renderFindBar(defaultSearchOptions);

    const toggle = screen.getByRole("checkbox", {
      name: /Regex/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(toggle.checked).toBe(true);
  });

  it("keeps other options unchanged when toggling one", () => {
    // 既に caseSensitive が ON の状態から wholeWord をトグルしても、
    // caseSensitive が意図せずリセットされないことを最終状態で固定する。
    const initial: SearchOptions = {
      caseSensitive: true,
      wholeWord: false,
      regex: false,
    };
    renderFindBar(initial);

    const caseSensitiveToggle = screen.getByRole("checkbox", {
      name: /Case/i,
    }) as HTMLInputElement;
    const wholeWordToggle = screen.getByRole("checkbox", {
      name: /Word/i,
    }) as HTMLInputElement;

    expect(caseSensitiveToggle.checked).toBe(true);
    expect(wholeWordToggle.checked).toBe(false);

    fireEvent.click(wholeWordToggle);

    // wholeWord が ON になり、caseSensitive は ON のまま残る。
    expect(caseSensitiveToggle.checked).toBe(true);
    expect(wholeWordToggle.checked).toBe(true);
  });

  it("uses the corrected kana label for the previous-match button", () => {
    renderFindBar(defaultSearchOptions, "kana");

    expect(screen.getByRole("button", { name: "まえへ" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "まへへ" })).toBeNull();
  });
});
