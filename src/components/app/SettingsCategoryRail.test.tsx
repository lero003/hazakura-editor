import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPreferencesPane } from "./SettingsPreferencesPane";
import { getPreferencesCopy, getLModeCopy } from "../../lib/locale";
import { defaultEditorSettings } from "../../lib/editorSettingsDefaults";
afterEach(cleanup);

function renderSettings() {
  const copy = getPreferencesCopy("ja");
  render(<SettingsPreferencesPane copy={copy} lModeCopy={getLModeCopy("ja")}
    menuLanguage="ja" editorSettings={defaultEditorSettings()}
    themePreference="light" previewVisible onEditorSettingsChange={vi.fn()}
    onMenuLanguageChange={vi.fn()} onPreviewVisibleChange={vi.fn()} onThemePreferenceChange={vi.fn()} />);
  return copy;
}

/**
 * 本文の見出しを 500px 間隔の本文として組み、スクロール位置に応じた rect を返す。
 * 実ブラウザと同じく `scrollTop` は `scrollHeight - clientHeight` で頭打ちにする。
 */
function stubSettingsBody(
  copy: ReturnType<typeof getPreferencesCopy>,
  viewport: { clientHeight: number; scrollHeight: number },
) {
  const scroller = screen.getByRole("button", { name: copy.editor })
    .closest(".settings-layout")!
    .querySelector(".settings-preferences") as HTMLElement;
  const headings = [...scroller.querySelectorAll("h3")] as HTMLElement[];
  const contentOffsets = headings.map((_, index) => index * 500);
  const scrollerTop = 100;
  const rect = (top: number) => () => ({
    top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}),
  }) as DOMRect;
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  let scrollTop = 0;
  Object.defineProperty(scroller, "scrollTop", {
    get: () => scrollTop,
    set: (value: number) => { scrollTop = Math.min(Math.max(value, 0), maxScrollTop); },
    configurable: true,
  });
  Object.defineProperty(scroller, "clientHeight", { get: () => viewport.clientHeight, configurable: true });
  Object.defineProperty(scroller, "scrollHeight", { get: () => viewport.scrollHeight, configurable: true });
  scroller.getBoundingClientRect = rect(scrollerTop);
  const layout = () => headings.forEach((heading, index) => {
    heading.getBoundingClientRect = rect(scrollerTop + contentOffsets[index] - scrollTop);
  });
  layout();
  return { scroller, relayout: layout, maxScrollTop };
}

it("marks the category whose section is on screen as the current one", () => {
  const copy = renderSettings();
  expect(screen.getByRole("button", { name: copy.editor }).getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("button", { name: copy.mediaAndDisplay }).hasAttribute("aria-current")).toBe(false);
  expect(screen.getByRole("button", { name: copy.appearanceAndWriting }).hasAttribute("aria-current")).toBe(false);
});

it("moves the current category when another section is opened", () => {
  const copy = renderSettings();
  fireEvent.click(screen.getByRole("button", { name: copy.appearanceAndWriting }));
  expect(screen.getByRole("button", { name: copy.appearanceAndWriting }).getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("button", { name: copy.editor }).hasAttribute("aria-current")).toBe(false);
});

it("keeps the current category in step with manual scrolling", async () => {
  const copy = renderSettings();
  const { scroller, relayout } = stubSettingsBody(copy, { clientHeight: 474, scrollHeight: 2064 });
  scroller.scrollTop = 520;
  relayout();
  fireEvent.scroll(scroller);
  await waitFor(() => expect(screen.getByRole("button", { name: copy.mediaAndDisplay }).getAttribute("aria-current")).toBe("true"));
  expect(screen.getByRole("button", { name: copy.editor }).hasAttribute("aria-current")).toBe(false);
});

it("keeps the clicked category after the scroll it caused settles", async () => {
  const copy = renderSettings();
  const { scroller, relayout } = stubSettingsBody(copy, { clientHeight: 474, scrollHeight: 2064 });
  fireEvent.click(screen.getByRole("button", { name: copy.appearanceAndWriting }));
  expect(scroller.scrollTop).toBe(1500 - 16);
  relayout();
  fireEvent.scroll(scroller);
  await waitFor(() => expect(screen.getByRole("button", { name: copy.appearanceAndWriting }).getAttribute("aria-current")).toBe("true"));
  expect(screen.getByRole("button", { name: copy.editor }).hasAttribute("aria-current")).toBe(false);
});

it("keeps the last category current when the click can only reach the bottom", async () => {
  const copy = renderSettings();
  // 最終セクションが短く、末尾まで送っても最終見出しは読み位置に届かない本文。
  const { scroller, relayout, maxScrollTop } = stubSettingsBody(copy, {
    clientHeight: 474,
    scrollHeight: 1620,
  });
  fireEvent.click(screen.getByRole("button", { name: copy.appearanceAndWriting }));
  expect(scroller.scrollTop).toBe(maxScrollTop);
  relayout();
  fireEvent.scroll(scroller);
  await waitFor(() => expect(screen.getByRole("button", { name: copy.appearanceAndWriting }).getAttribute("aria-current")).toBe("true"));
  expect(screen.getByRole("button", { name: copy.editor }).hasAttribute("aria-current")).toBe(false);
});
