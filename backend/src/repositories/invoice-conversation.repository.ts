import { randomUUID } from "node:crypto";
import db from "../database/database";
import type {
  ConversationRole,
  InvoiceConversation,
  InvoiceConversationExchange,
  InvoiceConversationMessage,
  InvoiceReference,
} from "../types/invoice-conversation";

interface ConversationRow {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  latest_message_preview: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: ConversationRole;
  content: string;
  references_json: string | null;
  created_at: string;
}

function parseReferences(value: string | null): InvoiceReference[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((reference): InvoiceReference[] => {
      if (typeof reference !== "object" || reference === null) return [];
      const candidate = reference as Record<string, unknown>;
      if (typeof candidate.invoiceId !== "string" || typeof candidate.fileName !== "string") return [];
      return [{
        invoiceId: candidate.invoiceId,
        fileName: candidate.fileName,
        invoiceNumber: typeof candidate.invoiceNumber === "string" ? candidate.invoiceNumber : null,
      }];
    });
  } catch {
    return [];
  }
}

function mapConversation(row: ConversationRow): InvoiceConversation {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    latestMessagePreview: row.latest_message_preview,
  };
}

function mapMessage(row: MessageRow): InvoiceConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    references: parseReferences(row.references_json),
    createdAt: row.created_at,
  };
}

export class InvoiceConversationRepository {
  constructor(private readonly database: typeof db = db) {}

  private insertMessage(conversationId: string, role: ConversationRole, content: string, references: InvoiceReference[] = []): InvoiceConversationMessage {
    const id = randomUUID();
    const referencesJson = role === "assistant" && references.length ? JSON.stringify(references) : null;
    this.database.prepare(`
      INSERT INTO invoice_conversation_messages (id, conversation_id, role, content, references_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, conversationId, role, content, referencesJson);
    const row = this.database.prepare(`
      SELECT id, conversation_id, role, content, references_json, created_at
      FROM invoice_conversation_messages WHERE id = ?
    `).get(id) as MessageRow | undefined;
    if (!row) throw new Error("Failed to retrieve the saved conversation message");
    return mapMessage(row);
  }

  createWithExchange(userContent: string, assistantContent: string, references: InvoiceReference[]): {
    conversation: InvoiceConversation;
    exchange: InvoiceConversationExchange;
  } {
    const conversationId = randomUUID();
    return this.database.transaction(() => {
      this.database.prepare(`INSERT INTO invoice_conversations (id) VALUES (?)`).run(conversationId);
      const userMessage = this.insertMessage(conversationId, "user", userContent);
      const assistantMessage = this.insertMessage(conversationId, "assistant", assistantContent, references);
      const row = this.database.prepare(`
        SELECT c.id, c.created_at, c.updated_at,
          (SELECT substr(m.content, 1, 80) FROM invoice_conversation_messages m
           WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.created_at ASC, m.rowid ASC LIMIT 1) AS title,
          (SELECT substr(m.content, 1, 180) FROM invoice_conversation_messages m
           WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS latest_message_preview
        FROM invoice_conversations c WHERE c.id = ?
      `).get(conversationId) as ConversationRow | undefined;
      if (!row) throw new Error("Failed to retrieve the saved conversation");
      return {
        conversation: mapConversation(row),
        exchange: { userMessage, assistantMessage },
      };
    })();
  }

  saveExchange(conversationId: string, userContent: string, assistantContent: string, references: InvoiceReference[]): InvoiceConversationExchange {
    return this.database.transaction(() => {
      const result = this.database.prepare(`
        UPDATE invoice_conversations
        SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(conversationId);
      if (result.changes !== 1) throw new Error("Conversation no longer exists");
      return {
        userMessage: this.insertMessage(conversationId, "user", userContent),
        assistantMessage: this.insertMessage(conversationId, "assistant", assistantContent, references),
      };
    })();
  }

  findConversation(id: string): InvoiceConversation | null {
    const row = this.database.prepare(`
      SELECT c.id, c.created_at, c.updated_at,
        (SELECT substr(m.content, 1, 80) FROM invoice_conversation_messages m
         WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.created_at ASC, m.rowid ASC LIMIT 1) AS title,
        (SELECT substr(m.content, 1, 180) FROM invoice_conversation_messages m
         WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS latest_message_preview
      FROM invoice_conversations c WHERE c.id = ?
    `).get(id) as ConversationRow | undefined;
    return row ? mapConversation(row) : null;
  }

  listConversations(limit = 100): InvoiceConversation[] {
    const rows = this.database.prepare(`
      SELECT c.id, c.created_at, c.updated_at,
        (SELECT substr(m.content, 1, 80) FROM invoice_conversation_messages m
         WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.created_at ASC, m.rowid ASC LIMIT 1) AS title,
        (SELECT substr(m.content, 1, 180) FROM invoice_conversation_messages m
         WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS latest_message_preview
      FROM invoice_conversations c
      ORDER BY c.updated_at DESC, c.created_at DESC
      LIMIT ?
    `).all(limit) as ConversationRow[];
    return rows.map(mapConversation);
  }

  findMessages(id: string): InvoiceConversationMessage[] {
    const rows = this.database.prepare(`
      SELECT id, conversation_id, role, content, references_json, created_at
      FROM invoice_conversation_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, rowid ASC
    `).all(id) as MessageRow[];
    return rows.map(mapMessage);
  }

  findRecentMessages(id: string, limit: number): InvoiceConversationMessage[] {
    const rows = this.database.prepare(`
      SELECT id, conversation_id, role, content, references_json, created_at
      FROM invoice_conversation_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `).all(id, limit) as MessageRow[];
    return rows.reverse().map(mapMessage);
  }
}

export const invoiceConversationRepository = new InvoiceConversationRepository();
