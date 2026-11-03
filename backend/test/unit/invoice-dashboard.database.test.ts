import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDatabase } from "../../src/database/init";

const summaryJson = JSON.stringify({
  vendorName: "Acme Supplies",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-01-15",
  dueDate: null,
  currency: "USD",
  subtotal: "90.00",
  taxAmount: "10.00",
  totalAmount: "100.00",
  paymentTerms: null,
  summary: "Acme Supplies invoiced 100.00 USD.",
});

describe("invoice dashboard database initialization", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    database.close();
    vi.restoreAllMocks();
  });

  it("adds the summary and chat tables without removing existing invoices", () => {
    database.exec(`
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        page_count INTEGER NOT NULL,
        extracted_text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'uploaded'
          CHECK (status IN ('uploaded', 'processed', 'failed')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      INSERT INTO invoices (id, file_name, file_size, page_count, extracted_text)
      VALUES ('legacy-invoice', 'legacy.pdf', 10, 1, 'Preserved extracted text');
    `);

    initializeDatabase(database);

    const row = database.prepare(`
      SELECT id, file_name, extracted_text, summary_json, status
      FROM invoices WHERE id = 'legacy-invoice'
    `).get();
    expect(row).toEqual({
      id: "legacy-invoice",
      file_name: "legacy.pdf",
      extracted_text: "Preserved extracted text",
      summary_json: null,
      status: "uploaded",
    });
    expect(database.pragma("table_info(chat_messages)")).toHaveLength(5);
  });

  it("backfills uploaded invoices with saved summaries to processed", () => {
    database.exec(`
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        page_count INTEGER NOT NULL,
        extracted_text TEXT NOT NULL,
        summary_json TEXT,
        status TEXT NOT NULL DEFAULT 'uploaded'
          CHECK (status IN ('uploaded', 'processed', 'failed')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
    database.prepare(`
      INSERT INTO invoices (id, file_name, file_size, page_count, extracted_text, summary_json)
      VALUES ('summarized-invoice', 'saved.pdf', 10, 1, 'Saved text', ?)
    `).run(summaryJson);

    initializeDatabase(database);

    expect(database.prepare("SELECT status FROM invoices WHERE id = ?").get("summarized-invoice"))
      .toEqual({ status: "processed" });
    expect(database.prepare("SELECT summary_json FROM invoices WHERE id = ?").get("summarized-invoice"))
      .toEqual({ summary_json: summaryJson });
  });
});
