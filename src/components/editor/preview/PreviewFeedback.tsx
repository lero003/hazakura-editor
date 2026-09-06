import type { MenuLanguage } from "../../../types";

type PreviewFeedbackProps = {
  kind: "empty" | "error";
  menuLanguage: MenuLanguage;
  retained?: boolean;
  onRetry?: () => void;
};

export function PreviewFeedback({
  kind,
  menuLanguage,
  retained = false,
  onRetry,
}: PreviewFeedbackProps) {
  const en = menuLanguage === "en";
  const title = kind === "empty"
    ? en ? "Your preview starts here" : "ここにプレビューが表示されます"
    : en ? "The preview could not be updated" : "プレビューを更新できませんでした";
  const detail = kind === "empty"
    ? en ? "Write in the editor to see the formatted text." : "エディタに文章を書くと、整えた表示で読み返せます。"
    : retained
      ? en ? "Showing the last successful preview. Your text has not been changed." : "最後に表示できた内容を残しています。本文は変更していません。"
      : en ? "Your text has not been changed. Try displaying it again." : "本文は変更していません。もう一度表示をお試しください。";

  return (
    <section className={`preview-feedback preview-feedback-${kind}`} role="status">
      <div className="preview-feedback-copy">
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {kind === "error" && onRetry ? (
        <button className="preview-retry-button" type="button" onClick={onRetry}>
          {en ? "Retry preview" : "もう一度表示"}
        </button>
      ) : null}
    </section>
  );
}
