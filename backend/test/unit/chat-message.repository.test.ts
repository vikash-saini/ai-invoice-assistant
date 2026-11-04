import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeChatMessagesTable } from "../../src/database/init";
import { ChatMessageRepository } from "../../src/repositories/chat-message.repository";

describe("ChatMessageRepository", () => {
  let database: Database.Database;
  let repository: ChatMessageRepository;

  beforeEach(() => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    database.exec("CREATE TABLE invoices (id TEXT PRIMARY KEY)");
    database.prepare("INSERT INTO invoices (id) VALUES (?)").run("invoice-1");
    initializeChatMessagesTable(database);
    repository = new ChatMessageRepository(database);
  });

  afterEach(() => database.close());

  it("creates the chat table for an existing database without changing invoices", () => {
    expect(database.prepare("SELECT id FROM invoices").all()).toEqual([{ id: "invoice-1" }]);
    expect(repository.findByInvoiceId("invoice-1")).toEqual([]);
  });

  it("persists exchanges in chronological order and returns the most recent messages", () => {
    const first = repository.saveExchange("invoice-1", "First question", "First answer");
    const second = repository.saveExchange("invoice-1", "Follow-up", "Follow-up answer");

    expect(repository.findByInvoiceId("invoice-1")).toEqual([
      first.userMessage,
      first.assistantMessage,
      second.userMessage,
      second.assistantMessage,
    ]);
    expect(repository.findRecentByInvoiceId("invoice-1", 2)).toEqual([
      second.userMessage,
      second.assistantMessage,
    ]);
  });

  it("retains conversation history after closing and reopening the database", () => {
    const databasePath = path.join(os.tmpdir(), `chat-history-${randomUUID()}.sqlite`);
    let firstConnection: Database.Database | undefined;
    let reopenedConnection: Database.Database | undefined;
    try {
      firstConnection = new Database(databasePath);
      firstConnection.pragma("foreign_keys = ON");
      firstConnection.exec("CREATE TABLE invoices (id TEXT PRIMARY KEY)");
      firstConnection.prepare("INSERT INTO invoices (id) VALUES (?)").run("invoice-1");
      initializeChatMessagesTable(firstConnection);
      new ChatMessageRepository(firstConnection).saveExchange("invoice-1", "Question", "Answer");
      firstConnection.close();
      firstConnection = undefined;

      reopenedConnection = new Database(databasePath);
      expect(new ChatMessageRepository(reopenedConnection).findByInvoiceId("invoice-1")).toMatchObject([
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ]);
    } finally {
      firstConnection?.close();
      reopenedConnection?.close();
      if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
    }
  });

  it("cascades chat deletion when its invoice is deleted", () => {
    repository.saveExchange("invoice-1", "Question", "Answer");
    database.prepare("DELETE FROM invoices WHERE id = ?").run("invoice-1");
    expect(repository.findByInvoiceId("invoice-1")).toEqual([]);
  });

  it("rolls back the user message if saving the assistant message fails", () => {
    database.exec(`
      CREATE TRIGGER reject_assistant_message
      BEFORE INSERT ON chat_messages
      WHEN NEW.role = 'assistant'
      BEGIN
        SELECT RAISE(FAIL, 'assistant insert failed');
      END;
    `);
    expect(() => repository.saveExchange("invoice-1", "Question", "Answer")).toThrow(
      "assistant insert failed"
    );
    expect(repository.findByInvoiceId("invoice-1")).toEqual([]);
  });
});
