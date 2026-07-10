import type { TextEncoding } from "../../types";

/**
 * v1.7 Reference Compare — one read-only reference beside the editable editor.
 * R1: text/Markdown. R2: pdf (opaque handle + page raster) and image.
 */
export type ReferenceDocument =
  | {
      kind: "text";
      path: string;
      name: string;
      contents: string;
      encoding: TextEncoding;
    }
  | {
      kind: "pdf";
      path: string;
      name: string;
      pageCount: number;
      /** Opaque Rust handle; frontend never sees staged paths. */
      referenceId: string;
    }
  | {
      kind: "image";
      path: string;
      name: string;
      url: string;
      size: number;
    };

export type ReferenceCompareOrigin = "manual" | "import-assist";

export type ReferenceFollowMode = "off" | "following" | "paused";

export type ReferenceCompareState = {
  reference: ReferenceDocument;
  origin: ReferenceCompareOrigin;
  /** Import Assist page-follow only; null for manual references. */
  linkedEditorSessionId: string | null;
  followMode: ReferenceFollowMode;
  /**
   * Disk fingerprint captured when the reference was opened/reloaded.
   * Used to detect external changes without auto-refreshing the view.
   */
  sourceFingerprint: string | null;
  /** True when disk fingerprint diverged; user must explicitly reload. */
  externalChangePending: boolean;
};

/** Narrow-window single-pane focus when both columns cannot fit. */
export type ReferenceNarrowFocus = "reference" | "editor";
