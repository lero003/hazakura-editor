import { invoke } from "@tauri-apps/api/core";
import type { LocalAssistReviewIdentity } from "../../features/editor/localAssistReviewIdentity";

export async function requestLocalAssistReview(payload: LocalAssistReviewIdentity): Promise<void> {
  await invoke("request_apple_assist_review", { payload });
}
/** Main validates the exact proposal before bringing its fixed native window forward. */
export async function focusMainLocalAssistReview(): Promise<void> {
  await invoke("focus_main_apple_assist_review");
}
