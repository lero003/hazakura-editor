export type EditorViewState = {
  anchor: number;
  head: number;
  scrollRatio: number;
};

export type EditorViewStatePatch = Partial<EditorViewState>;

export type EBookViewState = {
  chapterIndex: number;
  pageIndex: number;
  sourceLine?: number;
};

export type PreviewViewState = {
  scrollRatio: number;
};

export type DocumentViewState = {
  editor?: EditorViewState;
  ebook?: EBookViewState;
  preview?: PreviewViewState;
};

export type DocumentViewStateRegistry = Record<string, DocumentViewState>;

export type DocumentViewStatePatch = {
  editor?: EditorViewStatePatch;
  ebook?: EBookViewState;
  preview?: PreviewViewState;
};

export function patchDocumentViewState(
  current: DocumentViewStateRegistry,
  documentKey: string,
  patch: DocumentViewStatePatch,
): DocumentViewStateRegistry {
  const previous = current[documentKey] ?? {};
  const next: DocumentViewState = { ...previous };

  if (patch.editor) {
    next.editor = {
      anchor: 0,
      head: 0,
      scrollRatio: 0,
      ...previous.editor,
      ...patch.editor,
    };
  }

  if (patch.ebook) {
    next.ebook = patch.ebook;
  }

  if (patch.preview) {
    next.preview = patch.preview;
  }

  return {
    ...current,
    [documentKey]: next,
  };
}

export function clampEditorViewState(
  state: EditorViewState,
  documentLength: number,
): EditorViewState {
  const maxOffset = Math.max(0, documentLength);

  return {
    anchor: clamp(state.anchor, 0, maxOffset),
    head: clamp(state.head, 0, maxOffset),
    scrollRatio: clamp(state.scrollRatio, 0, 1),
  };
}

export function pruneDocumentViewStates(
  current: DocumentViewStateRegistry,
  keepDocumentKeys: readonly string[],
): DocumentViewStateRegistry {
  const keep = new Set(keepDocumentKeys);
  const nextEntries = Object.entries(current).filter(([key]) => keep.has(key));

  if (nextEntries.length === Object.keys(current).length) {
    return current;
  }

  return Object.fromEntries(nextEntries);
}

export function rekeyDocumentViewState(
  current: DocumentViewStateRegistry,
  previousKey: string,
  nextKey: string,
): DocumentViewStateRegistry {
  if (previousKey === nextKey || current[previousKey] === undefined) {
    return current;
  }

  const { [previousKey]: previous, ...rest } = current;
  return {
    ...rest,
    [nextKey]: {
      ...(rest[nextKey] ?? {}),
      ...previous,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
