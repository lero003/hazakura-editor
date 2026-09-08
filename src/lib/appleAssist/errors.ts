/** Internal categories over the existing string-only Tauri error wire. */
export type LocalAssistErrorKind = "format" | "context" | "selection" | "proposal" | "unavailable" | "language" |
  "throttled" | "timeout" | "cancelled" | "stale" | "guardrail" | "unknown";

export function classifyLocalAssistError(error: unknown): LocalAssistErrorKind {
  if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return "cancelled";
  const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/cancelled by user|canceled by user/.test(raw)) return "cancelled";
  if (/proposal exceeds (?:the continuation limit|the maximum length)/.test(raw)) return "proposal";
  if (/ambiguous proposal formatting|reference metadata instead of a proposal/.test(raw)) return "format";
  if (raw.includes("selected text exceeds")) return "selection";
  if (/document context exceeds|exceededcontextwindowsize|input is too large for this request/.test(raw)) return "context";
  if (/stale|no longer matches/.test(raw)) return "stale";
  if (/unsupportedlanguageorlocale|does not support.*(?:language|locale)/.test(raw)) return "language";
  if (/guardrail|refus/.test(raw)) return "guardrail";
  if (/timed out|timeout/.test(raw)) return "timeout";
  if (/rate[ -]?limit|concurrent|busy with another request|still finishing another generation/.test(raw)) return "throttled";
  if (/unavailable|not available|requires macos|not enabled|not eligible|not ready yet/.test(raw)) return "unavailable";
  return "unknown";
}
