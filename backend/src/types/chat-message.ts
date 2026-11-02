export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  invoiceId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatExchange {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}
