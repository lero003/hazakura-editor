// Inline image widget for L Mode (えるモード).
//
// `![alt](url)` Markdown syntax is detected in the L Mode
// extension and replaced visually with an `<img>` element. The
// underlying doc text is never mutated — this is the same
// cornerstone invariant the rest of L Mode honors, and the
// existing extension test enforces it.
//
// URL resolution:
//   - `http://` / `https://` → used directly as the `<img>` src.
//   - `data:` → used directly (already inline).
//   - Workspace-relative (`./foo.png`, `assets/...`) or
//     absolute paths under the workspace root → resolved
//     through the existing `open_workspace_image` Rust command,
//     which returns a data URL. The resolution is async; the
//     widget first renders a placeholder (alt text) and
//     re-renders with the real image when the data URL lands.
//   - Anything else (paths outside the workspace) → placeholder
//     forever. No file read is attempted.
//
// We deliberately do NOT widen the Tauri asset protocol scope
// to read images directly — the data-URL-via-Rust path mirrors
// what the preview pane already does, keeps the capability
// config untouched, and caps image size at 20 MB in Rust.

import {
  EditorView,
  ViewPlugin,
  type DecorationSet,
  WidgetType,
} from "@codemirror/view";
import { StateEffect, type Extension } from "@codemirror/state";
import { openWorkspaceImage } from "../../../lib/tauri/workspace";
import { LModeClasses } from "./classes";

// The class returned by `classifyImageUrl`. `value` is the
// `src` to use directly for `http` / `data` kinds, or the
// absolute filesystem path for `workspace` (to be passed to
// `openWorkspaceImage`), or the original raw URL for
// `outside` (used only for diagnostics — the widget shows the
// alt text and never attempts a read).
export type ClassifiedImageUrl =
  | { kind: "http"; value: string }
  | { kind: "data"; value: string }
  | { kind: "workspace"; value: string }
  | { kind: "outside"; value: string };

// `resolvedSrc` is the actual `<img>` src to render. Three
// states:
//   - `string` (non-null): either a data URL (from
//     `openWorkspaceImage`) or an http(s) / data URL. Render
//     the image.
//   - `null`: the image could not be loaded (or the URL is
//     outside the workspace). Render the alt text only.
//   - `undefined`: the resolution is still in flight. Render
//     the alt text as a placeholder; the widget will be
//     recreated with a defined value when the data URL lands.
export class LModeImageWidget extends WidgetType {
  constructor(
    readonly rawUrl: string,
    readonly resolvedSrc: string | null | undefined,
    readonly alt: string,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    // The widget renders an `<img>` (or a placeholder span
    // when the URL is unresolved / outside the workspace)
    // followed by an optional caption. The caption uses the
    // `alt` text — the same source the user already wrote in
    // Markdown — so no new content is invented. When the alt
    // is empty (common for purely decorative images), no
    // caption is rendered. The wrapper is a `<figure>` so
    // the screen reader announces it as a figure, and CSS
    // can center the whole thing as one block.
    const wrap = document.createElement("figure");
    wrap.className = LModeClasses.image;
    if (this.resolvedSrc) {
      const img = document.createElement("img");
      img.src = this.resolvedSrc;
      img.alt = this.alt;
      img.loading = "lazy";
      wrap.appendChild(img);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = LModeClasses.imagePlaceholder;
      placeholder.textContent = this.alt || "…";
      wrap.appendChild(placeholder);
    }
    if (this.alt && this.alt.trim() !== "") {
      const caption = document.createElement("figcaption");
      caption.className = LModeClasses.imageCaption;
      caption.textContent = this.alt;
      wrap.appendChild(caption);
    }
    return wrap;
  }

  eq(other: LModeImageWidget): boolean {
    return (
      other.rawUrl === this.rawUrl &&
      other.resolvedSrc === this.resolvedSrc &&
      other.alt === this.alt
    );
  }

  ignoreEvent(): boolean {
    // Pointer events should fall through to the editor so the
    // cursor can still be placed in the image's source range.
    return false;
  }
}

// --- URL classifier ---
//
// The classifier is pure and synchronous. It does not read the
// filesystem or call Tauri — it just decides what kind of URL
// we're dealing with and, for workspace paths, computes the
// absolute path that will be passed to `openWorkspaceImage`.
//
// POSIX path manipulation is done inline (no Node `path`
// module) because this code runs in the Tauri WebView, not
// Node.

export function classifyImageUrl(
  rawUrl: string,
  documentPath: string | null,
  workspaceRoot: string | null,
): ClassifiedImageUrl {
  if (/^https?:\/\//i.test(rawUrl)) {
    return { kind: "http", value: rawUrl };
  }
  if (/^data:/i.test(rawUrl)) {
    return { kind: "data", value: rawUrl };
  }

  if (!workspaceRoot) {
    return { kind: "outside", value: rawUrl };
  }

  const normalizedRoot = workspaceRoot.replace(/\/+$/, "");

  if (isAbsolutePosix(rawUrl)) {
    if (
      rawUrl === normalizedRoot ||
      rawUrl.startsWith(normalizedRoot + "/")
    ) {
      return { kind: "workspace", value: rawUrl };
    }
    return { kind: "outside", value: rawUrl };
  }

  // Relative path. Resolve against the document's directory if
  // we have one, otherwise against the workspace root. The
  // result must still be under the workspace root or we treat
  // it as outside (no read attempt).
  const baseDir = documentPath ? dirnamePosix(documentPath) : normalizedRoot;
  const resolved = resolvePosix(baseDir, rawUrl);
  if (
    resolved === normalizedRoot ||
    resolved.startsWith(normalizedRoot + "/")
  ) {
    return { kind: "workspace", value: resolved };
  }
  return { kind: "outside", value: rawUrl };
}

// --- Async resolution cache ---
//
// The StateField calls `peekResolvedImage` synchronously and
// `ensureWorkspaceImageResolved` to kick off (or no-op) the
// async Rust call. When the call resolves, the cache is
// updated and a `refreshEffect` is dispatched against the
// EditorView captured by the view plugin below, which causes
// the field to re-derive and recreate the widget with the
// resolved src.
//
// The cache is module-level and shared across all editors in
// the tab. This is fine because the cache key includes the
// workspace root, so two workspaces with the same image path
// cannot collide.

const resolvedImageCache = new Map<string, string | null>();
const inFlightImageResolutions = new Map<string, Promise<void>>();

// Filled in by the view plugin below. The closure keeps a
// reference to the live EditorView so we can dispatch a
// refresh transaction when an async resolution lands.
let activeImageView: EditorView | null = null;

export const refreshImagesEffect = StateEffect.define<null>();

function cacheKey(root: string, absPath: string): string {
  return `${root} ${absPath}`;
}

export function peekResolvedImage(
  root: string,
  absPath: string,
): string | null | undefined {
  const key = cacheKey(root, absPath);
  if (resolvedImageCache.has(key)) {
    return resolvedImageCache.get(key) ?? null;
  }
  return undefined;
}

export function ensureWorkspaceImageResolved(
  root: string,
  absPath: string,
): void {
  const key = cacheKey(root, absPath);
  if (resolvedImageCache.has(key) || inFlightImageResolutions.has(key)) {
    return;
  }

  const promise = openWorkspaceImage(root, absPath)
    .then((doc: { dataUrl: string }) => {
      resolvedImageCache.set(key, doc.dataUrl);
    })
    .catch(() => {
      resolvedImageCache.set(key, null);
    })
    .finally(() => {
      inFlightImageResolutions.delete(key);
      const view = activeImageView;
      if (view) {
        view.dispatch({ effects: refreshImagesEffect.of(null) });
      }
    });
  inFlightImageResolutions.set(key, promise);
}

// ViewPlugin that captures the live EditorView. There is one
// instance per editor; when the editor is destroyed, the
// closure drops the reference. The plugin is included in the
// L Mode extension so it is only active when L Mode is on.
const imageResolverViewPlugin = ViewPlugin.fromClass(
  class {
    readonly view: EditorView;
    constructor(view: EditorView) {
      this.view = view;
      activeImageView = view;
    }
    destroy() {
      // Only clear the global reference if it still points to
      // our view. With multiple editor panes the most recently
      // constructed view wins, so we must not clobber a newer
      // pane's reference on this pane's teardown.
      if (activeImageView === this.view) {
        activeImageView = null;
      }
    }
  },
);

// Helper for the extension file to bundle the view plugin in.
export function lModeImageResolverPlugin(): Extension {
  return imageResolverViewPlugin;
}

// --- POSIX path utilities (inline, no Node `path` dep) ---

function isAbsolutePosix(p: string): boolean {
  return p.startsWith("/");
}

function dirnamePosix(p: string): string {
  const idx = p.lastIndexOf("/");
  if (idx === -1) return "";
  if (idx === 0) return "/";
  return p.slice(0, idx);
}

function resolvePosix(base: string, relative: string): string {
  // Combine base + "/" + relative, then normalize . and ..
  // segments. The result is always absolute (base is absolute
  // at the call sites).
  const combined = base.endsWith("/") ? base + relative : base + "/" + relative;
  const parts = combined.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) {
        out.pop();
      }
      continue;
    }
    out.push(part);
  }
  return "/" + out.join("/");
}

// Re-export for tests so the file can be imported as a single
// unit. The module's public surface is intentionally narrow.
export const __test__ = {
  isAbsolutePosix,
  dirnamePosix,
  resolvePosix,
  resolvedImageCache,
  inFlightImageResolutions,
};
