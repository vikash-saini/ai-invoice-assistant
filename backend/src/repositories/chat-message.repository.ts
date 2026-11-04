import { randomUUID } from "node:crypto";
import db from "../database/database";
import { ChatMessage, ChatRole } from "../types/chat-message";

interface ChatMessageRow {
  id: string;
  invoice_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export interface SaveChatMessageInput {
  invoiceId: string;
  role: ChatRole;
  content: string;
}

function mapMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class ChatMessageRepository {
  constructor(private readonly database: typeof db = db) {}

  saveMessage(input: SaveChatMessageInput): ChatMessage {
    const id = randomUUID();
    this.database.prepare(`
      INSERT INTO chat_messages (id, invoice_id, role, content)
      VALUES (?, ?, ?, ?)
    `).run(id, input.invoiceId, input.role, input.content);

    const row = this.database.prepare(`
      SELECT id, invoice_id, role, content, created_at
      FROM chat_messages
      WHERE id = ?
    `).get(id) as ChatMessageRow | undefined;

    if (!row) throw new Error("Failed to retrieve the saved chat message");
    return mapMessage(row);
  }

  saveExchange(invoiceId: string, userContent: string, assistantContent: string): {
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  } {
    return this.database.transaction(() => ({
      userMessage: this.saveMessage({ invoiceId, role: "user", content: userContent }),
      assistantMessage: this.saveMessage({ invoiceId, role: "assistant", content: assistantContent }),
    }))();
  }

  findByInvoiceId(invoiceId: string): ChatMessage[] {
    const rows = this.database.prepare(`
      SELECT id, invoice_id, role, content, created_at
      FROM chat_messages
      WHERE invoice_id = ?
      ORDER BY created_at ASC, rowid ASC
    `).all(invoiceId) as ChatMessageRow[];
    return rows.map(mapMessage);
  }

  findRecentByInvoiceId(invoiceId: string, limit: number): ChatMessage[] {
    const rows = this.database.prepare(`
      SELECT id, invoice_id, role, content, created_at
      FROM chat_messages
      WHERE invoice_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `).all(invoiceId, limit) as ChatMessageRow[];
    return rows.reverse().map(mapMessage);
  }
}

export const chatMessageRepository = new ChatMessageRepository();
