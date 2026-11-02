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
