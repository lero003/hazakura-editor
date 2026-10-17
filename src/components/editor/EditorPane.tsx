import {
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { historyField } from "@codemirror/commands";
import {
  Compartment,
  EditorState,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view";
import { SlashMenu, type SlashMenuCopy } from "./SlashMenu";
import { useSlashMenu } from "../../hooks/editor/useSlashMenu";
import {
  pickEditorLanguage,
  type EditorLanguageKind,
} from "../../features/editor/codeMirrorTheme";
import { editorBaseSetup } from "../../features/editor/editorBaseSetup";
import {
  clampEditorViewState,
  type EditorViewState,
  type EditorViewStatePatch,
} from "../../features/editor/documentViewState";
import { lModeExtension, LModeClasses } from "../../features/editor/lMode";
import { DOCUMENT_CONTENT_LANG } from "../../features/app/documentLanguage";
import type { LModeCopy } from "../../lib/locale";
import type { SlashCommand } from "../../types/slash";
import type { MarkdownStructureHeading } from "../../features/editor/markdownStructure";
import {
  buildHeadingLevelChange,
  type HeadingLevelChangeDirection,
} from "../../features/editor/markdownStructureEdits";

import {
  applyMarkdownFormat,
  editorKeyboardShortcuts,
  editorTabIndentation,
  insertTableAtCursor,
  type MarkdownFormat,
} from "../../features/editor/editorEditingCommands";
import {
  editorReadOnlyExtensions,
  editorTheme,
  getEditorWrappingExtensions,
  invisibleCharactersField,
  searchHighlightField,
  setSearchMatchesEffect,
} from "../../features/editor/editorPresentation";
export type { MarkdownFormat } from "../../features/editor/editorEditingCommands";
export { getEditorWrappingExtensions } from "../../features/editor/editorPresentation";
export {
  isScrollerPointerOnScrollbar,
} from "../../features/editor/editorScrollPhysics";
export type { EditorSelectionInfo } from "../../features/editor/editorScrollPhysics";
import {
  captureScrollbarBottomIntent,
  clampScrollRatio,
  holdDraggedScrollTop,
  isEffectivelyEmpty,
  isScrollerPointerOnScrollbar,
  keepBottomAfterScrollbarDrag,
  readScrollRatio,
  readSelectionInfo,
  type EditorSelectionInfo,
} from "../../features/editor/editorScrollPhysics";

type SearchMatch = { from: number; to: number };
type EditorPaneProps = {
  documentKey: string;
  editorSessionKey: string;
  editorViewState?: EditorViewState | null;
  value: string;
  theme: "light" | "dark";
  fontSize: number;
  showInvisibles: boolean;
  spellcheckEnabled: boolean;
  tabSize: number;
  wrapLines: boolean;
  lModeEnabled: boolean;
  lModeCopy: LModeCopy;
  lModeTypewriter?: boolean;
  readOnly?: boolean;
  activeSearchMatchIndex: number;
  searchMatches: SearchMatch[];
  slashCommands: readonly SlashCommand[];
  slashMenuCopy: SlashMenuCopy;
  workspaceRoot?: string;
  onPasteImage?: (
    dataBase64: string,
    fileName: string,
  ) => Promise<string | null>;
  // エディタでユーザーのスクロール操作（ホイール・ポインタ・キー）が始まった。
 onSendToAgent?: (text: string) => void;
  onScrollGestureStart?: () => void;
  onChange: (nextValue: string) => void;
  onEditorViewStateChange?: (patch: EditorViewStatePatch) => void;
  onScrollRatioChange: (ratio: number) => void;
  onSelectionChange: (selection: EditorSelectionInfo) => void;
};

export type EditorPaneHandle = {
  focus: () => void;
  // `focus` defaults to true. Pass `{ focus: false }` when the caller is
  // syncing the editor scroll position from another focused surface (e.g.
  // the e-book reader paging with the keyboard) so the editor does not
  // steal focus on every page turn.
  goToLine: (line: number, options?: { focus?: boolean }) => void;
  changeHeadingLevel: (
    heading: MarkdownStructureHeading,
    direction: HeadingLevelChangeDirection,
  ) => boolean;
  applyMarkdownFormat: (format: MarkdownFormat) => void;
  insertTable: (
    columns: number,
    headerLabels?: readonly string[],
  ) => void;
  insertText: (text: string) => void;
  setScrollRatio: (ratio: number, tolerancePx?: number) => boolean;
  replaceCurrent: (replacement: string) => boolean;
  replaceAll: (replacement: string) => void;
  /**
   * Replace the full document in one CodeMirror transaction (one Undo step).
   * Refuses read-only, Assist-lock surfaces (caller should gate), and IME composition.
   */
  replaceDocumentContents: (next: string) => boolean;
  getSelectionText: () => string;
  // v0.12+ Hazakura Local Assist Writing Companion (slice 3).
  // Returns the active document text plus the selection range
  // as character offsets into that text. The Hazakura Local Assist
  // target sync hook uses this to feed
  // `inferAppleAssistTarget` on every selection / cursor
  // change without going through the React selection state
  // (which only carries `line` / `column` / character
  // count, not the document text). Returns `null` when the
  // editor view is not mounted.
  getActiveDocument: () => { text: string; from: number; to: number } | null;
};

const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane(
    {
      activeSearchMatchIndex,
      documentKey,
      editorSessionKey,
      editorViewState = null,
      fontSize,
      lModeEnabled,
      lModeCopy,
      lModeTypewriter = false,
      readOnly = false,
      searchMatches,
      showInvisibles,
      slashCommands,
      slashMenuCopy,
      spellcheckEnabled,
      tabSize,
      theme,
      value,
      wrapLines,
      onChange,
      onEditorViewStateChange,
      onScrollRatioChange,
      onSelectionChange,
      workspaceRoot,
      onPasteImage,
      onSendToAgent,
      onScrollGestureStart,
    },
    ref,
  ) {
  const editorMountRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const destroyMountedViewRef = useRef<(() => void) | null>(null);
  const onChangeRef = useRef(onChange);
  const onScrollRatioChangeRef = useRef(onScrollRatioChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onEditorViewStateChangeRef = useRef(onEditorViewStateChange);
  const onPasteImageRef = useRef(onPasteImage);
  const onScrollGestureStartRef = useRef(onScrollGestureStart);
  const onSendToAgentRef = useRef<(text: string) => void>(() => {});
  const applyingExternalValueRef = useRef(false);
  const compositionActiveRef = useRef(false);
  const jumpScrollReportFrameRef = useRef<number | null>(null);
  const restoreScrollFrameRef = useRef<number | null>(null);
  // v0.33: scroll イベントは高頻度で発火するため requestAnimationFrame で
  // スロットルし、onScrollRatioChange / scroll HUD の更新を1フレームに1回に抑える。
  const scrollReportFrameRef = useRef<number | null>(null);
  // v0.34: スクロールバー操作中の mouseup ハンドラ。view 破棄時に確実に除去するため ref で保持。
  const scrollbarMouseUpHandlerRef = useRef<
    ((event: MouseEvent) => void) | null
  >(null);
  const themeCompartmentRef = useRef(new Compartment());
  const wrappingCompartmentRef = useRef(new Compartment());
  const invisiblesCompartmentRef = useRef(new Compartment());
  const tabSizeCompartmentRef = useRef(new Compartment());
  const spellcheckCompartmentRef = useRef(new Compartment());
  const lModeCompartmentRef = useRef(new Compartment());
  const readOnlyCompartmentRef = useRef(new Compartment());
  // The active language parser + highlight style are picked
  // from the file extension on every editor mount. The theme
  // compartment reconfigure (theme/fontSize change) needs to
  // re-apply the same highlight, so we mirror it into a ref.
  const currentHighlightRef = useRef<Extension | null>(null);
  // The kind (`markdown` / `html` / `css`) the editor was
  // last mounted with. We re-mount the editor only when the
  // document changes or the kind changes — the same-document
  // Markdown → Markdown case (e.g. L Mode toggle on a `.md`
  // file) must NOT re-mount, otherwise the cursor position
  // test breaks.
  const mountedKindRef = useRef<EditorLanguageKind | null>(null);
  const mountedEditorSessionKeyRef = useRef<string | null>(null);
  // L Mode ON/OFF の変化で再マウントを駆動する。CodeMirror 6.43.3 で
  // 観測された tile tree（行仮想化・描画範囲計算の中核）破損への防御。
  // 当時は 6.43.2 pin で通常 edit を守った。v3.2候補の新しいpinでも
  // L Mode切替の重い decoration 差し替え経路は remount を維持する。
  // 詳細は docs/current-work.md の当該事象記録を参照。
  const mountedLModeEnabledRef = useRef<boolean | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        viewRef.current?.focus();
      },
      goToLine(line, options) {
        const view = viewRef.current;

        if (!view) {
          return;
        }

        const safeLine = Math.min(
          Math.max(Math.trunc(line), 1),
          view.state.doc.lines,
        );
        const lineInfo = view.state.doc.line(safeLine);

        view.dispatch({
          selection: { anchor: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: "center" }),
        });
        const win = view.dom.ownerDocument.defaultView ?? window;
        if (jumpScrollReportFrameRef.current !== null) {
          win.cancelAnimationFrame(jumpScrollReportFrameRef.current);
        }
        // v0.34: CodeMirror の scrollIntoView は非同期(requestMeasure)で処理
        // されるため、1フレーム後でも scrollTop が確定していないことがある。
        // double-rAF (2フレーム待ち) でスクロール確定後に ratio を報告し、
        // プレビュー/HUD の一拍ズレを防ぐ。
        jumpScrollReportFrameRef.current = win.requestAnimationFrame(() => {
          jumpScrollReportFrameRef.current = win.requestAnimationFrame(() => {
            jumpScrollReportFrameRef.current = null;
            if (viewRef.current !== view) {
              return;
            }
            onScrollRatioChangeRef.current(
              readScrollRatio(view.scrollDOM),
            );
            onEditorViewStateChangeRef.current?.({
              scrollRatio: readScrollRatio(view.scrollDOM),
            });
          });
        });
        if (options?.focus !== false) {
          view.focus();
        }
      },
      applyMarkdownFormat(format) {
        const view = viewRef.current;

        if (!view || readOnly) {
          return;
        }

        applyMarkdownFormat(view, format);
        view.focus();
      },
      changeHeadingLevel(heading, direction) {
        const view = viewRef.current;
        if (
          !view ||
          readOnly ||
          compositionActiveRef.current ||
          view.composing
        ) {
          return false;
        }
        const change = buildHeadingLevelChange(
          view.state.doc.toString(),
          heading,
          direction,
        );
        if (!change) {
          return false;
        }

        view.dispatch({
          changes: {
            from: change.from,
            to: change.to,
            insert: change.insert,
          },
          selection: { anchor: change.from + change.insert.length },
          effects: EditorView.scrollIntoView(change.from, { y: "center" }),
        });
        view.focus();
        return true;
      },
      insertTable(columns, headerLabels) {
        const view = viewRef.current;
        if (!view || readOnly) return;
        insertTableAtCursor(view, columns, headerLabels);
        view.focus();
      },
      insertText(text) {
        const view = viewRef.current;
        if (!view || readOnly) return;
        view.dispatch({
          changes: {
            from: view.state.selection.main.from,
            insert: text,
          },
        });
        view.focus();
      },
      replaceDocumentContents(next) {
        const view = viewRef.current;
        if (
          !view ||
          readOnly ||
          compositionActiveRef.current ||
          view.composing
        ) {
          return false;
        }
        const current = view.state.doc.toString();
        if (current === next) {
          return false;
        }
        const selection = view.state.selection.main;
        const anchor = Math.min(selection.anchor, next.length);
        const head = Math.min(selection.head, next.length);
        view.dispatch({
          changes: { from: 0, to: current.length, insert: next },
          selection: { anchor, head },
        });
        view.focus();
        return true;
      },
      setScrollRatio(ratio, tolerancePx = 0) {
        const view = viewRef.current;

        if (!view) {
          return false;
        }

        const scroller = view.scrollDOM;
        const scrollableHeight = scroller.scrollHeight - scroller.clientHeight;
        const nextScrollTop =
          scrollableHeight <= 0
            ? 0
            : scrollableHeight * clampScrollRatio(ratio);

        if (Math.abs(scroller.scrollTop - nextScrollTop) < tolerancePx) {
          return false;
        }

        scroller.scrollTop = nextScrollTop;
        return true;
      },
      getSelectionText() {
        const view = viewRef.current;
        if (!view) return "";
        const sel = view.state.selection.main;
        return sel.empty
          ? view.state.sliceDoc(0)  // full content if no selection
          : view.state.sliceDoc(sel.from, sel.to);
      },
      getActiveDocument() {
        const view = viewRef.current;
        if (!view) return null;
        const sel = view.state.selection.main;
        return {
          text: view.state.doc.toString(),
          from: sel.from,
          to: sel.to,
        };
      },
      replaceCurrent(replacement) {
        const view = viewRef.current;
        if (
          !view ||
          readOnly ||
          view.state.readOnly ||
          compositionActiveRef.current ||
          view.composing ||
          searchMatches.length === 0 ||
          activeSearchMatchIndex < 0
        ) {
          return false;
        }

        const match = searchMatches[activeSearchMatchIndex];
        if (!match) return false;

        if (view.state.sliceDoc(match.from, match.to) === replacement) {
          // 同じ語への置換は本文を変えない（dirty / Undo を作らない）。
          // それでも置換操作としては成立したので、呼び出し側は次の一致へ進める。
          view.dispatch({
            selection: { anchor: match.from + replacement.length },
          });
          view.focus();
          return true;
        }

        view.dispatch({
          changes: { from: match.from, to: match.to, insert: replacement },
          selection: { anchor: match.from + replacement.length },
        });
        view.focus();
        return true;
      },
      replaceAll(replacement) {
        const view = viewRef.current;
        if (
          !view ||
          readOnly ||
          view.state.readOnly ||
          compositionActiveRef.current ||
          view.composing ||
          searchMatches.length === 0
        ) {
          return;
        }

        const changes = searchMatches
          .filter(
            (match) =>
              view.state.sliceDoc(match.from, match.to) !== replacement,
          )
          .map((match) => ({
            from: match.from,
            to: match.to,
            insert: replacement,
          }));

        if (changes.length === 0) {
          // 全一致が同じ語への置換なら、変更なし（dirty / Undo を作らない）。
          view.focus();
          return;
        }

        view.dispatch({ changes });
        view.focus();
      },
    }),
    [activeSearchMatchIndex, readOnly, searchMatches],
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onScrollGestureStartRef.current = onScrollGestureStart;
  }, [onScrollGestureStart]);

  useEffect(() => {
    onScrollRatioChangeRef.current = onScrollRatioChange;
  }, [onScrollRatioChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onEditorViewStateChangeRef.current = onEditorViewStateChange;
  }, [onEditorViewStateChange]);

  useEffect(() => {
    onPasteImageRef.current = onPasteImage;
  }, [onPasteImage]);

  useEffect(() => {
    onSendToAgentRef.current = onSendToAgent ?? (() => {});
  }, [onSendToAgent]);

  useEffect(() => {
    if (!editorMountRef.current) {
      return;
    }

    // Pick the language parser + highlight style for the file
    // extension. The GFM-flavoured `markdownLanguage` base
    // (used for `.md`/unknown) emits `Table` / `TableDelimiter`
    // / `Task` / `TaskMarker` / `Strikethrough` nodes that the
    // L Mode decoration set depends on, so we keep the
    // Markdown branch on the same base the v0.11 surface was
    // tuned for. `.css` and `.html` (incl. `.htm`/`.xml`) get
    // their own parsers and HighlightStyle. When L Mode is
    // enabled, the picker forces the Markdown branch — the L
    // Mode decoration pass targets Markdown / GFM AST nodes,
    // so a non-Markdown parser would leave the L Mode chrome
    // in an inconsistent state.
    const picked = pickEditorLanguage(documentKey, { lModeEnabled });

    // We re-mount the editor when the open-tab session changes, when the
    // language family (`kind`) changes, OR when L Mode is toggled. The path
    // can change inside one session after Save As without losing selection,
    // history, or plugin state. A different tab receives a different
    // editorSessionKey and must not inherit those values.
    //
    // For `.css` / `.html`, the kind flips between Markdown
    // (L Mode ON) and the file's family (L Mode OFF), so a
    // re-mount is unavoidable — CodeMirror parsers cannot be
    // swapped in-place. The cursor reset on those toggles is
    // a known and accepted trade-off, since L Mode is meant
    // for the Markdown writing surface, not for CSS / HTML
    // editing.
    //
    // For `.md` (kind stays `markdown`), we ALSO re-mount on L Mode toggle.
    // Even with @codemirror/view pinned (see package.json),
    // swapping L Mode's heavy decoration set via Compartment reconfigure
    // remains a high-risk path for tile-tree corruption
    // ("特定行より下が描画されない" / wrong caret / lines vanishing on type).
    // Re-creating the EditorView rebuilds the tile tree from scratch.
    // Cursor and scroll ratio are preserved (see `preservedViewState`);
    // the visible trade-off is that undo history resets on each toggle.
    const shouldRemount =
      mountedKindRef.current === null ||
      mountedEditorSessionKeyRef.current !== editorSessionKey ||
      mountedKindRef.current !== picked.kind ||
      mountedLModeEnabledRef.current !== lModeEnabled;
    if (!shouldRemount) {
      currentHighlightRef.current = picked.highlight;
      return;
    }

    // Tear down the previous view (if any) before re-mounting
    // with the new language family. The unmount-only effect
    // below also destroys the view, but that fires on
    // component unmount, not on every dep change — so we
    // need an explicit destroy here when `shouldRemount` is
    // true to clear the DOM, listeners, and `viewRef` before
    // the new EditorView attaches.
    //
    // 直前の EditorView から selection とスクロール比を吸い上げる。L Mode
    // 切替で再マウントする際、外部 prop (editorViewState) より直近の実状態を
    // 優先して復元する。そうしないと L Mode 切替のたびにカーソル・スクロール
    // が editorViewState prop の（古い）値へ飛んでしまう。
    //
    // ただしタブ切替（editorSessionKey 変化）では別文書の editorViewState prop
    // を優先する必要があるため、その場合は吸い上げた状態を使わない。
    const currentView = viewRef.current;
    const isSessionSwitch =
      mountedEditorSessionKeyRef.current !== editorSessionKey;
    const isLModeOnlyRemount =
      currentView !== null &&
      !isSessionSwitch &&
      mountedLModeEnabledRef.current !== lModeEnabled &&
      mountedKindRef.current === picked.kind;
    const preservedViewState: EditorViewState | null =
      currentView && !isSessionSwitch
        ? {
            anchor: currentView.state.selection.main.anchor,
            head: currentView.state.selection.main.head,
            scrollRatio: readScrollRatio(currentView.scrollDOM),
          }
        : null;
    // T-1: preserve undo/redo across L Mode remount (same session + kind).
    let preservedHistory: unknown;
    if (isLModeOnlyRemount && currentView) {
      try {
        const json = currentView.state.toJSON({ history: historyField }) as {
          history?: unknown;
        };
        preservedHistory = json.history;
      } catch {
        preservedHistory = undefined;
      }
    }
    destroyMountedViewRef.current?.();
    destroyMountedViewRef.current = null;
    viewRef.current = null;
    compositionActiveRef.current = false;
    mountedEditorSessionKeyRef.current = editorSessionKey;
    mountedKindRef.current = picked.kind;
    mountedLModeEnabledRef.current = lModeEnabled;
    currentHighlightRef.current = picked.highlight;
    const { language, highlight } = picked;
    const sourceViewState = preservedViewState ?? editorViewState ?? null;
    const restoredViewState = sourceViewState
      ? clampEditorViewState(sourceViewState, value.length)
      : null;

    const editorExtensions: Extension[] = [
      // Writing-surface base (no foldGutter — see editorBaseSetup.ts).
      editorBaseSetup,
      // 本文は UI 文言ではないので、ルートの表示言語を継承させない
      // （空文字＝HTML の「言語不明」。将来 文書言語を持つならここへ入れる）。
      EditorView.contentAttributes.of({ lang: DOCUMENT_CONTENT_LANG }),
      rectangularSelection(),
      crosshairCursor(),
      editorKeyboardShortcuts,
      editorTabIndentation,
      language,
      searchHighlightField,
      wrappingCompartmentRef.current.of(
        getEditorWrappingExtensions(wrapLines, lModeEnabled),
      ),
      invisiblesCompartmentRef.current.of(
        showInvisibles ? invisibleCharactersField : [],
      ),
      tabSizeCompartmentRef.current.of(EditorState.tabSize.of(tabSize)),
      spellcheckCompartmentRef.current.of(
        EditorView.contentAttributes.of({
          spellcheck: spellcheckEnabled ? "true" : "false",
        }),
      ),
      themeCompartmentRef.current.of([editorTheme(theme, fontSize), highlight]),
      lModeCompartmentRef.current.of(
        lModeExtension(
          lModeEnabled,
          {
            workspaceRoot: workspaceRoot ?? null,
            documentPath: documentKey,
          },
          { typewriterMode: lModeTypewriter },
        ),
      ),
      readOnlyCompartmentRef.current.of(editorReadOnlyExtensions(readOnly)),
      EditorView.domEventHandlers({
        compositionstart() {
          compositionActiveRef.current = true;
          return false;
        },
        compositionend() {
          compositionActiveRef.current = false;
          return false;
        },
        keydown(event, view) {
          if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "Enter") {
            const sel = view.state.selection.main;
            const text = sel.empty ? view.state.sliceDoc(0) : view.state.sliceDoc(sel.from, sel.to);
            if (text.trim()) {
              event.preventDefault();
              onSendToAgentRef.current(text);
              return true;
            }
          }
          return false;
        },
        paste(event, view) {
          const handler = onPasteImageRef.current;
          if (!handler) return false;

          const items = event.clipboardData?.items;
          if (!items) return false;

          let imageItem: DataTransferItem | null = null;
          let imageType = "";
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
              imageItem = item;
              imageType = item.type;
              break;
            }
          }
          if (!imageItem) return false;

          event.preventDefault();

          const pasteSelection = view.state.selection.main;
          const docAtPaste = view.state.doc;
          const file = imageItem.getAsFile();
          if (!file) return false;

          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            const commaIndex = base64.indexOf(",");
            const rawBase64 = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
            const ext = imageType.split("/")[1] ?? "png";
            const fileName = `pasted-${Date.now()}.${ext}`;

            try {
              const relativePath = await handler(rawBase64, fileName);
              if (!relativePath) return;
              if (view.state.doc !== docAtPaste) return;
              // 非同期の完了時点で編集ロックがかかっていることがある。
              // 適用の直前に読み取り専用を再検査する。
              if (view.state.readOnly) return;
              view.dispatch({
                changes: {
                  from: pasteSelection.from,
                  to: pasteSelection.to,
                  insert: `![](${relativePath})\n`,
                },
              });
            } catch {
              // Paste image insertion failed silently
            }
          };
          reader.readAsDataURL(file);
          return true;
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !applyingExternalValueRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }

        if (update.docChanged || update.selectionSet) {
          onSelectionChangeRef.current(readSelectionInfo(update.state));
        }
        if (update.selectionSet) {
          const selection = update.state.selection.main;
          onEditorViewStateChangeRef.current?.({
            anchor: selection.anchor,
            head: selection.head,
          });
        }
      }),
    ];

    let startState: EditorState | null = null;
    if (preservedHistory !== undefined && restoredViewState) {
      try {
        startState = EditorState.fromJSON(
          {
            doc: value,
            selection: {
              main: 0,
              ranges: [
                {
                  anchor: restoredViewState.anchor,
                  head: restoredViewState.head,
                },
              ],
            },
            history: preservedHistory,
          },
          { extensions: editorExtensions },
          { history: historyField },
        );
      } catch {
        startState = null;
      }
    }

    const view = startState
      ? new EditorView({
          state: startState,
          parent: editorMountRef.current,
        })
      : new EditorView({
          doc: value,
          parent: editorMountRef.current,
          selection: restoredViewState
            ? {
                anchor: restoredViewState.anchor,
                head: restoredViewState.head,
              }
            : undefined,
          extensions: editorExtensions,
        });
    const handleScroll = () => {
      // scroll イベントは高頻度なので1フレームに1回にまとめる。
      if (scrollReportFrameRef.current !== null) {
        return;
      }
      const win = view.dom.ownerDocument.defaultView ?? window;
      scrollReportFrameRef.current = win.requestAnimationFrame(() => {
        scrollReportFrameRef.current = null;
        const scrollRatio = readScrollRatio(view.scrollDOM);
        onScrollRatioChangeRef.current(scrollRatio);
        onEditorViewStateChangeRef.current?.({ scrollRatio });
      });
    };
    const handleScrollerMouseDown = (event: MouseEvent) => {
      if (isScrollerPointerOnScrollbar(event, view.scrollDOM)) {
        // v0.34: スクロールバードラッグ中はフォーカスを外し、ドラッグ終了時に
        // 戻す。blur したままにすると CodeMirror が選択アンカーを画面内に追従
        // させようとし、ホイール/トラックパッドスクロールが「前のキャレット位置に
        // 張り付く」症状の原因になる（handoff の既知バグ）。
        view.contentDOM.blur();
        const win = view.dom.ownerDocument.defaultView ?? window;
        // 「つまみがトラック下端へ届くポインタ位置」をドラッグ開始時に計算しておく。
        const bottomIntent = captureScrollbarBottomIntent(event, view.scrollDOM);
        const handleScrollEnd = (mouseUpEvent: MouseEvent) => {
          win.removeEventListener("mouseup", handleScrollEnd, {
            capture: true,
          });
          scrollbarMouseUpHandlerRef.current = null;
          // フォーカス復帰の直前に、ドラッグが決めた位置を控える。
          const draggedScrollTop = view.scrollDOM.scrollTop;
          // ユーザーが別のクリッカブル要素を押したのでなければフォーカスを戻す。
          if (
            view.contentDOM.ownerDocument.activeElement !== view.contentDOM
          ) {
            view.focus();
            // フォーカス復帰そのものがスクロール位置を動かしても、
            // ドラッグが決めた位置はユーザーの意思なので取り戻す。
            holdDraggedScrollTop(view, draggedScrollTop);
          }
          keepBottomAfterScrollbarDrag(view, bottomIntent, mouseUpEvent);
        };
        scrollbarMouseUpHandlerRef.current = handleScrollEnd;
        win.addEventListener("mouseup", handleScrollEnd, { capture: true });
      }
    };

    view.scrollDOM.addEventListener("mousedown", handleScrollerMouseDown);
    view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });

    // ユーザーがこの面のスクロールを始めたことを親へ伝える（反対ペインの
    // スクロール同期所有権を手放してもらう）。JS が書いた位置のエコーと、
    // 本物の操作を分けるための入口。
    const handleScrollGestureStart = () => {
      onScrollGestureStartRef.current?.();
    };
    view.scrollDOM.addEventListener("wheel", handleScrollGestureStart, {
      passive: true,
    });
    view.scrollDOM.addEventListener("pointerdown", handleScrollGestureStart, {
      passive: true,
    });
    view.contentDOM.addEventListener("keydown", handleScrollGestureStart);

    // Preview open/close and workspace splits change the editor
    // width without a document transaction. With line wrapping on
    // (default), that invalidates estimated line heights. If the
    // height map does not fully remeasure, mid-document tiles can
    // stay blank ("途中から行が消える") while the doc and preview
    // remain intact. Observe the mount box and remeasure on real
    // width changes.
    const mountEl = editorMountRef.current;
    let lastObservedWidth = -1;
    let resizeMeasureFrame: number | null = null;
    const scheduleResizeRemeasure = () => {
      if (resizeMeasureFrame !== null) {
        return;
      }
      const win = view.dom.ownerDocument.defaultView ?? window;
      resizeMeasureFrame = win.requestAnimationFrame(() => {
        resizeMeasureFrame = null;
        if (viewRef.current !== view) {
          return;
        }
        view.requestMeasure();
      });
    };
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && mountEl
        ? new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            if (lastObservedWidth < 0) {
              // First callback: record baseline. CodeMirror already
              // measures on mount; avoid a redundant pass.
              lastObservedWidth = width;
              return;
            }
            if (Math.abs(width - lastObservedWidth) < 1) {
              return;
            }
            lastObservedWidth = width;
            scheduleResizeRemeasure();
          })
        : null;
    resizeObserver?.observe(mountEl);

    destroyMountedViewRef.current = () => {
      if (jumpScrollReportFrameRef.current !== null) {
        const win = view.dom.ownerDocument.defaultView ?? window;
        win.cancelAnimationFrame(jumpScrollReportFrameRef.current);
        jumpScrollReportFrameRef.current = null;
      }
      if (restoreScrollFrameRef.current !== null) {
        const win = view.dom.ownerDocument.defaultView ?? window;
        win.cancelAnimationFrame(restoreScrollFrameRef.current);
        restoreScrollFrameRef.current = null;
      }
      if (scrollReportFrameRef.current !== null) {
        const win = view.dom.ownerDocument.defaultView ?? window;
        win.cancelAnimationFrame(scrollReportFrameRef.current);
        scrollReportFrameRef.current = null;
      }
      if (resizeMeasureFrame !== null) {
        const win = view.dom.ownerDocument.defaultView ?? window;
        win.cancelAnimationFrame(resizeMeasureFrame);
        resizeMeasureFrame = null;
      }
      resizeObserver?.disconnect();
      if (scrollbarMouseUpHandlerRef.current !== null) {
        const win = view.dom.ownerDocument.defaultView ?? window;
        win.removeEventListener("mouseup", scrollbarMouseUpHandlerRef.current, {
          capture: true,
        });
        scrollbarMouseUpHandlerRef.current = null;
      }
      view.scrollDOM.removeEventListener("mousedown", handleScrollerMouseDown);
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      view.scrollDOM.removeEventListener("wheel", handleScrollGestureStart);
      view.scrollDOM.removeEventListener("pointerdown", handleScrollGestureStart);
      view.contentDOM.removeEventListener("keydown", handleScrollGestureStart);
      view.destroy();
      if (viewRef.current === view) {
        viewRef.current = null;
      }
    };
    viewRef.current = view;
    onSelectionChangeRef.current(readSelectionInfo(view.state));
    if (restoredViewState) {
      const win = view.dom.ownerDocument.defaultView ?? window;
      restoreScrollFrameRef.current = win.requestAnimationFrame(() => {
        restoreScrollFrameRef.current = win.requestAnimationFrame(() => {
          restoreScrollFrameRef.current = null;
          if (viewRef.current !== view) {
            return;
          }
          const scrollableHeight =
            view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
          view.scrollDOM.scrollTop =
            scrollableHeight <= 0
              ? 0
              : scrollableHeight * restoredViewState.scrollRatio;
          const scrollRatio = readScrollRatio(view.scrollDOM);
          onScrollRatioChangeRef.current(scrollRatio);
          onEditorViewStateChangeRef.current?.({ scrollRatio });
        });
      });
    } else {
      handleScroll();
    }

    // NB: no cleanup return here. The mount useEffect re-runs
    // on every document/session/lMode identity change. Re-mounting
    // happens when the language `kind` changes OR when L Mode is
    // toggled (see `shouldRemount`). Cursor, scroll ratio, and (for
    // same-kind L Mode toggles) undo history are restored when possible.
    // `destroyMountedViewRef` runs only on actual remount or unmount.
  }, [documentKey, editorSessionKey, lModeEnabled]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        editorReadOnlyExtensions(readOnly),
      ),
    });
  }, [readOnly]);

  // Unmount-only effect: destroy the editor when the
  // component goes away. Lives in its own effect with empty
  // deps so the cleanup fires only on real unmount, not on
  // every render where document/session/lMode identity
  // change.
  useEffect(() => {
    return () => {
      destroyMountedViewRef.current?.();
      destroyMountedViewRef.current = null;
      viewRef.current = null;
      mountedEditorSessionKeyRef.current = null;
      mountedKindRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    // Re-apply the same language-family highlight the editor
    // was mounted with — it lives in `currentHighlightRef`
    // because the language parser itself is not reconfigured
    // here (changing the parser requires a full editor mount,
    // which happens via the `[documentKey, lModeEnabled]`
    // effect above).
    const highlight =
      currentHighlightRef.current ??
      pickEditorLanguage(documentKey, { lModeEnabled }).highlight;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure([
        editorTheme(theme, fontSize),
        highlight,
      ]),
    });
  }, [fontSize, theme, documentKey, lModeEnabled]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: wrappingCompartmentRef.current.reconfigure(
        getEditorWrappingExtensions(wrapLines, lModeEnabled),
      ),
    });
    // Wrapping changes the height of every long line; force a
    // measure so the height map does not keep pre-wrap estimates.
    view.requestMeasure();
  }, [wrapLines, lModeEnabled]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: invisiblesCompartmentRef.current.reconfigure(
        showInvisibles && !lModeEnabled ? invisibleCharactersField : [],
      ),
    });
  }, [showInvisibles, lModeEnabled]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: tabSizeCompartmentRef.current.reconfigure(
        EditorState.tabSize.of(tabSize),
      ),
    });
  }, [tabSize]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: spellcheckCompartmentRef.current.reconfigure(
        EditorView.contentAttributes.of({
          spellcheck: spellcheckEnabled ? "true" : "false",
        }),
      ),
    });
  }, [spellcheckEnabled]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: lModeCompartmentRef.current.reconfigure(
        lModeExtension(
          lModeEnabled,
          {
            workspaceRoot: workspaceRoot ?? null,
            documentPath: documentKey,
          },
          { typewriterMode: lModeTypewriter },
        ),
      ),
    });
  }, [lModeEnabled, lModeTypewriter, workspaceRoot, documentKey]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    applyingExternalValueRef.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    } finally {
      applyingExternalValueRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: setSearchMatchesEffect.of(
        searchMatches.map((match, index) => ({
          ...match,
          active: index === activeSearchMatchIndex,
        })),
      ),
    });
  }, [activeSearchMatchIndex, searchMatches]);

  useEffect(() => {
    const view = viewRef.current;
    const activeSearchMatch = searchMatches[activeSearchMatchIndex] ?? null;

    if (!view || !activeSearchMatch) {
      return;
    }

    view.dispatch({
      selection: {
        anchor: activeSearchMatch.from,
        head: activeSearchMatch.to,
      },
      effects: EditorView.scrollIntoView(activeSearchMatch.from, {
        y: "center",
      }),
    });
  }, [activeSearchMatchIndex, searchMatches]);

  const {
    activeIndex: slashActiveIndex,
    closeMenu: closeSlashMenu,
    commands: slashFiltered,
    openMenuAtContext: openSlashMenuAtContext,
    runCommand: runSlashCommand,
    setActiveIndex: setSlashActiveIndex,
    state: slashState,
  } = useSlashMenu({
    commands: slashCommands,
    // 編集ロック中はメニューを開かない／開いていたら閉じる（実行時にも検査する）。
    enabled: !readOnly,
    viewKey: documentKey,
    viewRef,
  });

  const handleEditorContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const view = viewRef.current;
    if (!view || readOnly) {
      return;
    }
    if (!(event.target instanceof Node) || !view.dom.contains(event.target)) {
      return;
    }

    event.preventDefault();

    const position = view.posAtCoords({
      x: event.clientX,
      y: event.clientY,
    });
    const selection = view.state.selection.main;
    // Only move the cursor on context-menu open when there is no active
    // selection. Moving the cursor to an out-of-viewport click point while
    // the user has a (possibly accidental) selection jerks the scroll and,
    // combined with the old replace-selection insert path, silently
    // deleted the selected text. Keeping the selection intact also keeps
    // the cursor in view so the menu open does not scroll.
    if (position !== null && selection.empty) {
      view.dispatch({ selection: { anchor: position } });
    }

    openSlashMenuAtContext(view, {
      bottom: event.clientY,
      left: event.clientX,
      top: event.clientY,
    });
  };

  return (
    <div className="editor-host" onContextMenu={handleEditorContextMenu}>
      <div className="editor-mount" ref={editorMountRef} />
      {lModeEnabled && isEffectivelyEmpty(value) ? (
        <div className={LModeClasses.emptyPlaceholder} aria-hidden="true">
          <div className={LModeClasses.emptyPlaceholderMark}>L</div>
          <div className={LModeClasses.emptyPlaceholderText}>
            {lModeCopy.emptyPlaceholderText}
          </div>
          <div className={LModeClasses.emptyPlaceholderHint}>
            {lModeCopy.emptyPlaceholderHint}
          </div>
        </div>
      ) : null}
      <SlashMenu
        activeIndex={slashActiveIndex}
        copy={slashMenuCopy}
        filteredCommands={slashFiltered}
        onClose={closeSlashMenu}
        onSetActiveIndex={setSlashActiveIndex}
        onRun={runSlashCommand}
        state={slashState}
      />
    </div>
  );
  },
);

export default EditorPane;
