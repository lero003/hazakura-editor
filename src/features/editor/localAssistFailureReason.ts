import { classifyLocalAssistError } from "../../lib/appleAssist/errors";

/**
 * 生成失敗の理由を、サイドバー側の短い案内へ写す。
 *
 * 生の内部エラー文字列は出さない（モック22の「内部エラー全文の無差別表示は追加しない」）。
 * 分類できないもの（unknown / stale / cancelled / guardrail / language など）は null を返し、
 * 既存の一般文言（failed / targetChanged など）へ委ねる。
 */
export type LocalAssistReasonKey =
  /** 選択・指定した入力対象が上限を超えた。 */
  | "reasonSelectionTooLong"
  /** 生成された案が上限を超えた（入力対象は長くない可能性がある）。 */
  | "reasonProposalTooLong"
  /** 追加依頼で継続した結果、案の上限に達した。 */
  | "reasonContinuationLimit"
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
      return "reasonSelectionTooLong";
    case "proposal":
      return "reasonProposalTooLong";
    case "continuation":
      return "reasonContinuationLimit";
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
