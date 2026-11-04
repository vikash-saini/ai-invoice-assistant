import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { invoiceRepository as InvoiceRepository } from "../../src/repositories/invoice.repository";

const databasePath = path.join(os.tmpdir(), `invoice-conversations-${randomUUID()}.sqlite`);
let app: Express;
let invoices: typeof InvoiceRepository;
let database: { close(): void };
let invoiceId: string;

beforeAll(async () => {
  process.env.DATABASE_PATH = databasePath;
  process.env.OPENAI_API_KEY = "";
  const { initializeDatabase } = await import("../../src/database/init");
  initializeDatabase();
  const [{ default: application }, invoiceModule, databaseModule] = await Promise.all([
    import("../../src/app"),
    import("../../src/repositories/invoice.repository"),
    import("../../src/database/database"),
  ]);
  app = application;
  invoices = invoiceModule.invoiceRepository;
  database = databaseModule.default;
  invoiceId = invoices.create({
    fileName: "northwind.pdf",
    fileSize: 300,
    pageCount: 2,
    extractedText: "Line item: consulting. Total 100.00 USD.",
  }).id;
  invoices.saveSummary(invoiceId, {
    vendorName: "Northwind Ltd",
    invoiceNumber: "NW-100",
    invoiceDate: "2026-04-10",
    dueDate: null,
    currency: "USD",
    subtotal: "90.00",
    taxAmount: "10.00",
    totalAmount: "100.00",
    paymentTerms: "Net 30",
    summary: "Consulting services.",
  });
});

afterAll(() => {
  database.close();
  if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath);
  delete process.env.DATABASE_PATH;
  delete process.env.OPENAI_API_KEY;
});

describe("multi-invoice conversation API", () => {
  it("creates, lists, and retrieves a conversation with persisted invoice references", async () => {
    const created = await request(app)
      .post("/api/v1/invoice-conversations")
      .send({ message: "What is the total invoice value across all invoices?" })
      .expect(201);

    const conversationId = created.body.data.conversation.id as string;
    expect(created.body.data.assistantMessage.references).toEqual([{
      invoiceId,
      fileName: "northwind.pdf",
      invoiceNumber: "NW-100",
    }]);

    const listed = await request(app).get("/api/v1/invoice-conversations").expect(200);
    expect(listed.body.data[0]).toMatchObject({
      id: conversationId,
      title: "What is the total invoice value across all invoices?",
      latestMessagePreview: created.body.data.assistantMessage.content,
    });

    const history = await request(app).get(`/api/v1/invoice-conversations/${conversationId}`).expect(200);
    expect(history.body.data.messages).toHaveLength(2);
    expect(history.body.data.messages[1].references).toEqual(created.body.data.assistantMessage.references);

    const followup = await request(app)
      .post(`/api/v1/invoice-conversations/${conversationId}/messages`)
      .send({ message: "Find invoices from Northwind Ltd" })
      .expect(201);
    expect(followup.body.data.conversationId).toBe(conversationId);
    expect(followup.body.data.assistantMessage.references[0].invoiceId).toBe(invoiceId);
  });

  it("validates message content and conversation IDs and does not persist failed generations", async () => {
    await request(app).post("/api/v1/invoice-conversations").send({ message: " " }).expect(400);
    await request(app).post("/api/v1/invoice-conversations").send({ message: "x".repeat(4_001) }).expect(400);
    await request(app).get("/api/v1/invoice-conversations/not-a-uuid").expect(400);
    await request(app).get(`/api/v1/invoice-conversations/${randomUUID()}`).expect(404);
    await request(app)
      .post(`/api/v1/invoice-conversations/${randomUUID()}/messages`)
      .send({ message: "hello" })
      .expect(404);

    const before = await request(app).get("/api/v1/invoice-conversations").expect(200);
    await request(app)
      .post("/api/v1/invoice-conversations")
      .send({ message: "Explain the payment terms and dates in these saved invoices." })
      .expect(503);
    const after = await request(app).get("/api/v1/invoice-conversations").expect(200);
    expect(after.body.data).toHaveLength(before.body.data.length);
  });
});
