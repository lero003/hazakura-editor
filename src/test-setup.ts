// Vitest test bootstrap. Loaded via `setupFiles` in
// `vitest.config.ts`. Works around an upstream interaction between
// vitest 4 and Node 22+ on the jsdom environment: Node ships an
// experimental `localStorage` global (the
// "ExperimentalWarning: localStorage is not available because
// --localstorage-file was not provided" warning), so vitest's
// `populateGlobal` skips jsdom's real `localStorage` because the
// key already exists on the runtime global. The result is that
// `window.localStorage` returns Node's no-op experimental stub
// instead of jsdom's working in-memory store, which makes any
// hook that touches `window.localStorage` (e.g.
// `useAgentWorkbenchPreferences`) throw `TypeError: Cannot read
// properties of undefined (reading 'clear')`. We fix it here by
// reading jsdom's real Storage off `globalThis.jsdom.window` and
// reassigning it onto the shared global so tests see the same
// behavior the app sees in the browser. Sister `sessionStorage`
// is included for symmetry. Kept tiny — no other globals stubbed.

type JsdomLike = {
  window: {
    localStorage: Storage;
    sessionStorage: Storage;
  };
};

function isJsdomLike(value: unknown): value is JsdomLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { window?: unknown };
  if (typeof candidate.window !== "object" || candidate.window === null) {
    return false;
  }
  const win = candidate.window as {
    localStorage?: unknown;
    sessionStorage?: unknown;
  };
  return (
    typeof win.localStorage === "object" &&
    win.localStorage !== null &&
    typeof win.sessionStorage === "object" &&
    win.sessionStorage !== null
  );
}

const jsdomInstance = (globalThis as { jsdom?: unknown }).jsdom;

if (isJsdomLike(jsdomInstance)) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: jsdomInstance.window.localStorage,
    writable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: jsdomInstance.window.sessionStorage,
    writable: true,
  });
}

// Workaround: jsdom 29 does not implement
// `Range.prototype.getClientRects`. CodeMirror's measure pipeline
// calls it when resolving `EditorView.scrollIntoView` effects,
// which surfaces as uncaught exceptions after tests that exercise
// scroll positioning (e.g. `goToLine`, mode toggles). Provide a
// no-op fallback that returns an empty rect list. Test-only; the
// production app runs in Chromium where this is implemented.
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function () {
    return [] as unknown as DOMRectList;
  };
}
