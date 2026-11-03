import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { invoiceRepository as InvoiceRepository } from "../../src/repositories/invoice.repository";
import type { chatMessageRepository as ChatRepository } from "../../src/repositories/chat-message.repository";

const databasePath = path.join(os.tmpdir(), `invoice-chat-${randomUUID()}.sqlite`);
let app: Express;
let invoices: typeof InvoiceRepository;
let chatMessages: typeof ChatRepository;
let database: { close(): void };
let invoiceId: string;

beforeAll(async () => {
  process.env.DATABASE_PATH = databasePath;
  process.env.OPENAI_API_KEY = "";

  const { initializeDatabase } = await import("../../src/database/init");
  initializeDatabase();
  const [{ default: application }, invoiceModule, chatModule, databaseModule] = await Promise.all([
    import("../../src/app"),
    import("../../src/repositories/invoice.repository"),
    import("../../src/repositories/chat-message.repository"),
    import("../../src/database/database"),
  ]);
  app = application;
  invoices = invoiceModule.invoiceRepository;
  chatMessages = chatModule.chatMessageRepository;
  database = databaseModule.default;
  invoiceId = invoices.create({
    fileName: "invoice.pdf",
    fileSize: 100,
    pageCount: 1,
    extractedText: "Total: 100.00",
  }).id;
});

afterAll(() => {
  database.close();
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
});

describe("invoice chat API", () => {
  it("returns an empty history for an invoice without messages", async () => {
    const response = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/chat`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { invoiceId, messages: [] },
    });
  });

  it("returns 404 for unknown invoice IDs", async () => {
    await request(app).get("/api/v1/invoices/missing/chat").expect(404);
    await request(app)
      .post("/api/v1/invoices/missing/chat")
      .send({ message: "What is the total?" })
      .expect(404);
  });

  it("rejects empty messages and does not call OpenAI when the key is missing", async () => {
    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/chat`)
      .send({ message: "   " })
      .expect(400);

    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/chat`)
      .send({ message: "What is the total?" })
      .expect(503);

    const history = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/chat`)
      .expect(200);
    expect(history.body.data.messages).toEqual([]);
  });

  it("returns the persisted conversation in chronological order", async () => {
    const exchange = chatMessages.saveExchange(invoiceId, "What is the total?", "100.00");

    const response = await request(app)
      .get(`/api/v1/invoices/${invoiceId}/chat`)
      .expect(200);

    expect(response.body.data.messages).toEqual([
      exchange.userMessage,
      exchange.assistantMessage,
    ]);
  });
});

describe("invoice summary persistence and dashboard API", () => {
  const summary = {
    vendorName: "Acme Supplies",
    invoiceNumber: "INV-CHAT-1",
    invoiceDate: "2026-01-15",
    dueDate: null,
    currency: "USD",
    subtotal: "90.00",
    taxAmount: "10.00",
    totalAmount: "100.00",
    paymentTerms: null,
    summary: "Acme Supplies invoiced 100.00 USD.",
  };

  it("keeps invoice status uploaded when summary generation fails", async () => {
    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/summary`)
      .expect(503);

    expect(invoices.findById(invoiceId)?.status).toBe("uploaded");
    expect(invoices.findById(invoiceId)?.summary).toBeNull();
  });

  it("marks the invoice processed with the saved summary and returns dashboard statistics", async () => {
    invoices.saveSummary(invoiceId, summary);

    const invoice = invoices.findById(invoiceId);
    expect(invoice?.status).toBe("processed");
    expect(invoice?.summary).toEqual(summary);

    const response = await request(app)
      .get("/api/v1/invoices/dashboard")
      .expect(200);

    expect(response.body.data).toMatchObject({
      totalInvoiceCount: 1,
      processedInvoiceCount: 1,
      successfullySummarizedInvoiceCount: 1,
      invoiceValueTotals: [{ currency: "USD", amount: "100.00" }],
      monthlyInvoiceValueTrends: [{ month: "2026-01", currency: "USD", amount: "100.00" }],
      topVendors: [{ vendorName: "Acme Supplies", invoiceCount: 1 }],
      missingVendorInvoiceCount: 0,
      invoicesWithMissingOrInvalidFinancialFieldsCount: 0,
    });
    expect(response.body.data).not.toHaveProperty("extractedText");
    expect(response.body.data).not.toHaveProperty("summary_json");
  });
});
