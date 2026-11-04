export type ConversationRole = "user" | "assistant";

export interface InvoiceReference {
  invoiceId: string;
  fileName: string;
  invoiceNumber: string | null;
}

export interface InvoiceConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
  latestMessagePreview: string | null;
}

export interface InvoiceConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  references: InvoiceReference[];
  createdAt: string;
}

export interface InvoiceConversationExchange {
  userMessage: InvoiceConversationMessage;
  assistantMessage: InvoiceConversationMessage;
}
