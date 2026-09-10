import { classifyLocalAssistError } from "../../lib/appleAssist/errors";

/**
 * 生成失敗の理由を、サイドバー側の短い案内へ写す。
 *
 * 生の内部エラー文字列は出さない（モック22の「内部エラー全文の無差別表示は追加しない」）。
 * 分類できないもの（unknown / stale / cancelled / guardrail / language など）は null を返し、
 * 既存の一般文言（failed / targetChanged など）へ委ねる。
 */
export type LocalAssistReasonKey =
  | "reasonTooLong"
  | "reasonContext"
  | "reasonUnavailable"
  | "reasonThrottled"
  | "reasonTimeout"
  | "reasonFormat";

export function localAssistReasonKey(
  message: string | null | undefined,
): LocalAssistReasonKey | null {
  if (!message) return null;
  switch (classifyLocalAssistError(message)) {
    case "selection":
    case "proposal":
      return "reasonTooLong";
    case "model-context":
    case "context":
      return "reasonContext";
    case "unavailable":
      return "reasonUnavailable";
    case "throttled":
      return "reasonThrottled";
    case "timeout":
      return "reasonTimeout";
    case "format":
      return "reasonFormat";
    default:
      return null;
  }
}
