import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";
import type { LocalAssistActionId } from "../appleAssist/instruction";

// Hazakura Local Assist is an Assist Surface provider class — NOT a
// CLI-agent provider. The types below describe the narrow
// document-help surface (selected text in, candidate text out,
// nothing else). They share the explicit review handoff pattern
// but do not share the External Agent Workbench CLI
// trust boundary. See docs/apple-local-assist-distribution-plan.md.

export type AppleAssistOperation =
  | "summarize"
  | "rephrase"
  | "extract"
  | "proofread"
  | "explain_diff";

// v0.12 implements summarize + rephrase + proofread. The other two are
// defined in the enum so the surface is shaped, but the Rust
// side rejects them as "deferred" — see
// commands::apple_assist::validate_request. v0.12.x / v0.13
// relaxes the check when each new operation is implemented.
export const APPLE_ASSIST_V0_12_OPERATIONS: ReadonlyArray<AppleAssistOperation> = [
  "summarize",
  "rephrase",
  "proofread",
];

// All five operations, in display order, for UI enumeration and
// tests. Adding an operation here is the only TS-side change
// needed for the UI to start showing the new command; the Rust
// side still needs to lift the v0.12 allowlist.
export const APPLE_ASSIST_ALL_OPERATIONS: ReadonlyArray<AppleAssistOperation> = [
  "summarize",
  "rephrase",
  "extract",
  "proofread",
  "explain_diff",
];

export const APPLE_ASSIST_MAX_SELECTED_CHARS = 4000;
export const APPLE_ASSIST_MAX_CONTEXT_CHARS = 8000;
export const APPLE_ASSIST_MAX_INSTRUCTION_CHARS = 1000;

export type AppleAssistRequest = {
  operation: AppleAssistOperation;
  actionId?: LocalAssistActionId;
  // Selected text from the active editor. Capped at
  // APPLE_ASSIST_MAX_SELECTED_CHARS by the Rust side.
  selectedText: string;
  // Optional bounded document context. Capped at
  // APPLE_ASSIST_MAX_CONTEXT_CHARS by the Rust side. v0.12
  // stubs ignore this; the field exists so the surface is
  // shaped and a future intent (e.g. explain_diff) can pick it
  // up without an API break.
  documentContext?: string;
  // Legacy user request field. New callers use
  // `additionalRequest` for the visible request text.
  instruction?: string;
  // Visible user request text from the Writing Companion
  // window. Capped by the Rust side.
  additionalRequest?: string;
};

export type AppleAssistResponse = {
  operation: AppleAssistOperation;
  // The generated candidate text. NEVER auto-applied. The caller
  // is expected to route this through an explicit review surface
  // before applying it to the editor buffer.
  candidateText: string;
  // Opaque model identifier. Fixture builds return "fixture:*";
  // live builds return an Apple Foundation Models identifier.
  modelId: string;
  // Latency in milliseconds, useful for status display and
  // future rate limiting. v0.12 stub returns 0.
  latencyMs: number;
};

// 4 states per docs/apple-local-assist-v0.12-design-review.md.
// Extensible: new states (e.g. "rate_limited") can be added to
// the Rust enum without breaking the TS contract, as long as
// the React layer handles each tag.
export type AppleAssistAvailability =
  | { kind: "available" }
  | { kind: "unavailable"; reason: string }
  | { kind: "disabled" }
  | { kind: "unsupported" };

export function isAppleAssistAvailable(
  availability: AppleAssistAvailability,
): boolean {
  return availability.kind === "available";
}

export async function probeAppleAssistAvailability(): Promise<AppleAssistAvailability> {
  if (!isTauriRuntime()) {
    // Browser / Vite dev runtime: Foundation Models is not
    // addressable from here. Report unsupported so the UI
    // hides the command palette entries; the React side never
    // tries to render a "Tauri not available" hint to the user.
    return { kind: "unsupported" };
  }
  return invoke<AppleAssistAvailability>("probe_apple_assist_availability");
}

export async function generateAppleAssistCandidate(
  request: AppleAssistRequest,
): Promise<AppleAssistResponse> {
  return invoke<AppleAssistResponse>("generate_apple_assist_candidate", {
    request,
  });
}

export async function generateAppleAssistCandidateStreaming(
  request: AppleAssistRequest,
  requestId: string,
  requestLabel: string,
): Promise<AppleAssistResponse> {
  return invoke<AppleAssistResponse>("generate_apple_assist_candidate_streaming", {
    request,
    requestId,
    requestLabel,
  });
}

// Stop any in-flight Hazakura Local Assist generation. Returns
// `true` when a generation was active and cancelled, `false` when
// nothing was in flight (idempotent no-op). The in-flight streaming
// Promise resolves with a cancel error shortly after this resolves.
export async function stopAppleAssistGeneration(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }
  return invoke<boolean>("stop_apple_assist_candidate");
}
