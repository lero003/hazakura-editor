import type { TextEncoding } from "../../types";

/**
 * v1.7 Reference Compare — one read-only reference beside the editable editor.
 * R1 supports text/Markdown only; pdf/image kinds land in R2.
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
};

/** Narrow-window single-pane focus when both columns cannot fit. */
export type ReferenceNarrowFocus = "reference" | "editor";
