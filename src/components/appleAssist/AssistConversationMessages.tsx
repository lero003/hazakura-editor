export type AssistConversationMessage = {
  id: string;
  role: "user" | "assistant";
  kind?: string;
  text: string;
};

// Rendering only: requests, pinned targets and cancellation belong to the window controller.
export function AssistConversationMessages({ items, emptyText }: {
  items: AssistConversationMessage[];
  emptyText: string;
}) {
  return <div data-testid="apple-assist-conversation-history" className="apple-assist-chat-messages">
    {items.length ? items.map(item => <p key={item.id}
      data-testid={item.role === "assistant" ? "apple-assist-feedback-entry" : undefined}
      data-feedback-kind={item.kind}
      className={`apple-assist-chat-message apple-assist-chat-message-${item.role}`}>{item.text}</p>)
      : <p className="apple-assist-chat-empty">{emptyText}</p>}
  </div>;
}
