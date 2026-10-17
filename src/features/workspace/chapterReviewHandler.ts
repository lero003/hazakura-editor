import type { EditorTab } from "../../types";

type Ref<T> = { current: T };

export type ChapterReviewHandlerOptions = {
  /** Monotonic request id: a stale open must not review a newer chapter. */
  requestRef: Ref<number>;
  /** Serialises chapter opens so the newest request wins the queue. */
  queueRef: Ref<Promise<void>>;
  openFilePath: (path: string) => EditorTab | null | Promise<EditorTab | null>;
  reviewTabAgainstDisk: (tab: EditorTab) => void;
};

/**
 * Opens a chapter's file and reviews it against disk once the open resolves,
 * skipping the review when a newer request superseded this one.
 *
 * Shared by the workspace sidebar (AppWorkspace) and the L Mode action rail
 * (AppShell). Each call site keeps its own request/queue refs: both sidebars
 * can be mounted at the same time, so sharing the refs would let one surface
 * cancel the other's review.
 */
export function createChapterReviewHandler({
  requestRef,
  queueRef,
  openFilePath,
  reviewTabAgainstDisk,
}: ChapterReviewHandlerOptions): (path: string) => void {
  return (path) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    const openRequest = queueRef.current.then(() =>
      Promise.resolve(openFilePath(path)),
    );
    queueRef.current = openRequest.then(
      () => undefined,
      () => undefined,
    );
    void openRequest.then(
      (tab) => {
        if (request === requestRef.current && tab) {
          reviewTabAgainstDisk(tab);
        }
      },
      () => undefined,
    );
  };
}
