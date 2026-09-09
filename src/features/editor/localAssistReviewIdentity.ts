/** Cross-window identity contains no source, path, or selectable window label. */
export type LocalAssistReviewIdentity = {
  requestId: string;
  conversationId: string;
  documentSessionId: string;
};
type MaybeIdentity = { [K in keyof LocalAssistReviewIdentity]?: string | null } | null | undefined;
export const LOCAL_ASSIST_REVIEW_REQUEST_EVENT = "local-assist-review-request";
export const LOCAL_ASSIST_REVIEW_RESULT_EVENT = "local-assist-review-result";
export type LocalAssistReviewResult = LocalAssistReviewIdentity & { accepted: boolean };

export function matchesReviewIdentity(left: MaybeIdentity, right: MaybeIdentity): boolean {
  return !!left?.requestId && !!left.conversationId && !!left.documentSessionId &&
    left.requestId === right?.requestId && left.conversationId === right.conversationId &&
    left.documentSessionId === right.documentSessionId;
}

export function acceptsReviewOutcome(review: MaybeIdentity, outcome: MaybeIdentity,
  conversationId: string | undefined, sessionId: string | null | undefined, activeRequestId: string | null): boolean {
  return !activeRequestId && review?.conversationId === conversationId &&
    review?.documentSessionId === sessionId && matchesReviewIdentity(review, outcome);
}
