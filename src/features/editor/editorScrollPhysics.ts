import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/**
 * Scroll and selection helpers for the editor pane.
 *
 * Moved verbatim out of `EditorPane.tsx`: these are pure DOM/CodeMirror
 * measurements and the scrollbar-drag bookkeeping, none of which needs the
 * component's state. `EditorSelectionInfo` lives here so the pane can re-export
 * it without this module importing the component back.
 */
export type EditorSelectionInfo = {
  line: number;
  column: number;
  selectedCharacters: number;
  selectedLines: number;
};

export function clampScrollRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }

  return Math.min(Math.max(ratio, 0), 1);
}

type ScrollbarPointerEvent = Pick<
  PointerEvent | MouseEvent,
  "button" | "clientX" | "clientY" | "target"
>;

export function isScrollerPointerOnScrollbar(
  event: ScrollbarPointerEvent,
  scroller: HTMLElement,
): boolean {
  if (event.button !== 0) {
    return false;
  }

  if (event.target instanceof Node && !scroller.contains(event.target)) {
    return false;
  }

  const rect = scroller.getBoundingClientRect();
  const hasVerticalScrollbar = scroller.scrollHeight > scroller.clientHeight;
  const hasHorizontalScrollbar = scroller.scrollWidth > scroller.clientWidth;
  const eventTargetIsScroller = event.target === scroller;
  const verticalScrollbarWidth = Math.max(
    0,
    scroller.offsetWidth - scroller.clientWidth,
  );
  const horizontalScrollbarHeight = Math.max(
    0,
    scroller.offsetHeight - scroller.clientHeight,
  );
  const effectiveVerticalScrollbarWidth =
    verticalScrollbarWidth > 0
      ? verticalScrollbarWidth
      : eventTargetIsScroller
        ? 14
        : 0;
  const effectiveHorizontalScrollbarHeight =
    horizontalScrollbarHeight > 0
      ? horizontalScrollbarHeight
      : eventTargetIsScroller
        ? 14
        : 0;
  const isVerticalScrollbar =
    hasVerticalScrollbar &&
    effectiveVerticalScrollbarWidth > 0 &&
    event.clientX >= rect.right - effectiveVerticalScrollbarWidth;
  const isHorizontalScrollbar =
    hasHorizontalScrollbar &&
    effectiveHorizontalScrollbarHeight > 0 &&
    event.clientY >= rect.bottom - effectiveHorizontalScrollbarHeight;

  return isVerticalScrollbar || isHorizontalScrollbar;
}

// "Effectively empty" for the L Mode placeholder means the
// document has no user content — just whitespace, a single
// newline, or completely empty. We don't want the placeholder
// to flash on and off as the user types their first character,
// so the threshold is generous: any non-whitespace character
// suppresses it.
export function isEffectivelyEmpty(value: string): boolean {
  return value.trim().length === 0;
}

export function readSelectionInfo(state: EditorState): EditorSelectionInfo {
  const selection = state.selection.main;
  const cursorLine = state.doc.lineAt(selection.head);
  const selectionStart = Math.min(selection.from, selection.to);
  const selectionEnd = Math.max(selection.from, selection.to);
  const selectedCharacters = Math.max(selectionEnd - selectionStart, 0);

  if (selectedCharacters === 0) {
    return {
      line: cursorLine.number,
      column: selection.head - cursorLine.from + 1,
      selectedCharacters: 0,
      selectedLines: 0,
    };
  }

  const startLine = state.doc.lineAt(selectionStart);
  const inclusiveEnd = Math.max(selectionEnd - 1, selectionStart);
  const endLine = state.doc.lineAt(inclusiveEnd);

  return {
    line: cursorLine.number,
    column: selection.head - cursorLine.from + 1,
    selectedCharacters,
    selectedLines: endLine.number - startLine.number + 1,
  };
}

export function readScrollRatio(scroller: HTMLElement): number {
  const scrollableHeight = scroller.scrollHeight - scroller.clientHeight;
  if (scrollableHeight <= 0) {
    return 0;
  }

  return scroller.scrollTop / scrollableHeight;
}

// スクロールバーのドラッグを離したあとフォーカスを戻すと、こちらの関与しない
// 経路がスクロール位置を書き換えることがある。
//
// - CodeMirror は focus のたびに「scrollTop が 0 なら直前に観測した位置へ戻す」
//   処理を持つ（`observers.focus` の "When focusing reset the scroll position"）。
// - Safari 26 系では `focus({ preventScroll: true })` が効かないため、フォーカス
//   時のキャレット位置まで引き戻される（CodeMirror 側も preventScroll を
//   無効化して自前で戻すが、キャレット位置への移動はその後に起きる）。
//
// どちらもドラッグで決めた位置を無視した書き換えなので、その 1 フレームだけ
// 取り戻す。ユーザー自身が新しくスクロール・クリック・キー入力したら降りる。
export function holdDraggedScrollTop(view: EditorView, draggedScrollTop: number) {
  const scroller = view.scrollDOM;
  const win = scroller.ownerDocument.defaultView ?? window;
  let released = false;
  const release = () => {
    released = true;
    win.removeEventListener("wheel", release, true);
    win.removeEventListener("pointerdown", release, true);
    win.removeEventListener("keydown", release, true);
  };
  const apply = () => {
    if (released || !view.dom.isConnected) {
      return;
    }
    if (Math.abs(scroller.scrollTop - draggedScrollTop) <= 1) {
      return;
    }
    scroller.scrollTop = draggedScrollTop;
  };

  win.addEventListener("wheel", release, true);
  win.addEventListener("pointerdown", release, true);
  win.addEventListener("keydown", release, true);
  // 同期（CodeMirror の復元は focus イベント内で同期的に走る）＋ 次フレーム
  // （エンジン側の引き戻しが次のタスクで起きる場合）。
  apply();
  win.requestAnimationFrame(() => {
    apply();
    release();
  });
}

// スクロールバーで最下部まで引いて離したときの底のずれを補正する。
//
// CodeMirror は未計測の行の高さを推定しているため、スクロールバーのドラッグで
// 一気に末尾へ飛ぶと、ドラッグ中は推定値で最大値が決まり、その後に表示された行を
// 測り直して総高さが伸びる。すると離した位置は「そのときの最下部」のまま取り残され、
// 見た目が末尾より少し上で止まる（仮想化の無いプレビュー側では起きない）。
// 「末尾まで引いた」の判定は、ポインタの絶対位置ではなく「つまみがトラック下端に
// 届いたか」で行う。つまみの中央をつかんで末尾まで運ぶと、ポインタはつまみ半分ぶん
// トラック下端より上で止まるため、ポインタ位置だけでは取りこぼす。
// 高さが伸びるとスクロール位置も最下部でなくなるので、位置で判定するのも不十分
// （実測: ドラッグ終了時に 2601px、再計測後は最大 2660px）。
const SCROLLBAR_BOTTOM_SNAP_TOLERANCE_PX = 4;
// オーバーレイスクロールバーでは offsetWidth と clientWidth が同じになる。
const OVERLAY_SCROLLBAR_FALLBACK_WIDTH_PX = 14;
// ブラウザが描くつまみの最短長の目安（これより短いことは通常ない）。
const MIN_SCROLLBAR_THUMB_PX = 20;

type ScrollbarBottomIntent = {
  // この Y 以上で離せば「つまみが下端に届いた」とみなす。null は縦ドラッグでない。
  pointerEndY: number | null;
};

// ドラッグ開始時に、つかんだ位置（つまみ内のどこか）から「下端到達とみなす
// ポインタ Y」を求める。横スクロールバー（下端）のドラッグは縦の末尾要求ではない。
export function captureScrollbarBottomIntent(
  event: MouseEvent,
  scroller: HTMLElement,
): ScrollbarBottomIntent {
  const max = scroller.scrollHeight - scroller.clientHeight;
  const rect = scroller.getBoundingClientRect();
  // 横スクロールバーがレイアウト領域を占める場合（macOS の「常に表示」）、
  // 要素の rect と縦トラックは一致しない。オーバーレイでは差が 0 になる。
  const horizontalBand = Math.max(
    0,
    scroller.offsetHeight - scroller.clientHeight,
  );
  const trackTop = rect.top;
  const trackBottom = rect.bottom - horizontalBand;
  const trackHeight = trackBottom - trackTop;

  if (max <= 0 || trackHeight <= 0) {
    return { pointerEndY: null };
  }

  const verticalBand =
    Math.max(0, scroller.offsetWidth - scroller.clientWidth) ||
    OVERLAY_SCROLLBAR_FALLBACK_WIDTH_PX;

  if (event.clientX < rect.right - verticalBand) {
    return { pointerEndY: null };
  }

  const thumbHeight = Math.max(
    MIN_SCROLLBAR_THUMB_PX,
    (scroller.clientHeight / scroller.scrollHeight) * trackHeight,
  );
  const thumbTop =
    trackTop +
    (scroller.scrollTop / max) * Math.max(trackHeight - thumbHeight, 0);
  const grabOffset = Math.min(Math.max(event.clientY - thumbTop, 0), thumbHeight);

  return { pointerEndY: trackBottom - (thumbHeight - grabOffset) };
}

export function keepBottomAfterScrollbarDrag(
  view: EditorView,
  bottomIntent: ScrollbarBottomIntent,
  mouseUpEvent: MouseEvent,
) {
  if (
    bottomIntent.pointerEndY === null ||
    mouseUpEvent.clientY <
      bottomIntent.pointerEndY - SCROLLBAR_BOTTOM_SNAP_TOLERANCE_PX
  ) {
    return;
  }

  const scroller = view.scrollDOM;

  if (scroller.scrollHeight <= scroller.clientHeight) {
    return;
  }

  // CodeMirror の再計測はこの後に数フレームかけて進む。1 回の読み直しでは
  // まだ伸びていないので、伸びが止むまで（最大 8 フレーム）底へ寄せ直す。
  // 離した後でユーザーが上へ動かしたら、その時点で降りる。
  const win = scroller.ownerDocument.defaultView ?? window;
  let framesLeft = 8;
  let lastWritten = scroller.scrollTop;

  const settle = () => {
    if (!view.dom.isConnected || framesLeft <= 0) {
      return;
    }
    framesLeft -= 1;
    const inner = view.scrollDOM;
    if (inner.scrollTop < lastWritten - SCROLLBAR_BOTTOM_SNAP_TOLERANCE_PX) {
      return;
    }
    const max = inner.scrollHeight - inner.clientHeight;
    if (max > inner.scrollTop) {
      inner.scrollTop = max;
      lastWritten = max;
    }
    win.requestAnimationFrame(settle);
  };

  win.requestAnimationFrame(settle);
}
