import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeDatabase } from "../../src/database/init";
import { InvoiceConversationRepository } from "../../src/repositories/invoice-conversation.repository";
import type { InvoiceDashboardRow } from "../../src/repositories/invoice.repository";
import type { InvoiceReference } from "../../src/types/invoice-conversation";
import { MultiInvoiceChatService } from "../../src/services/multi-invoice-chat.service";

const SUMMARY = {
  vendorName: "Acme Supplies",
  invoiceNumber: "INV-001",
  invoiceDate: "2026-01-15",
  dueDate: null,
  currency: "USD",
  subtotal: "90.00",
  taxAmount: "10.00",
  totalAmount: "100.00",
  paymentTerms: "Net 30",
  summary: "Office supplies and delivery service.",
};

function invoice(id: string, summary: Record<string, unknown>, fileName = `${id}.pdf`): InvoiceDashboardRow {
  return { id, fileName, status: "processed", summary };
}

function mockClient(outputs: Array<string | Error> = []) {
  const queue = [...outputs];
  const create = vi.fn(async () => {
    const output = queue.shift() ?? JSON.stringify({ answer: "Answer based on saved invoice facts.", sourceInvoiceIds: [] });
    if (output instanceof Error) throw output;
    return { output_text: output };
  });
  const clientFactory = vi.fn(() => ({ responses: { create } }) as unknown as OpenAI);
  return { create, clientFactory };
}

describe("MultiInvoiceChatService", () => {
  let database: Database.Database;
  let rows: InvoiceDashboardRow[];
  let conversations: InvoiceConversationRepository;
  let extractedTextLookup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    database = new Database(":memory:");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    initializeDatabase(database);
    rows = [
      invoice("invoice-acme-1", SUMMARY),
      invoice("invoice-acme-2", { ...SUMMARY, invoiceNumber: "INV-002", invoiceDate: "2026-02-12", taxAmount: "25.00", totalAmount: "$250.00" }),
      invoice("invoice-beta", { ...SUMMARY, vendorName: "Beta Labs", invoiceNumber: "B-3", currency: "EUR", subtotal: "300.00", taxAmount: "30.00", totalAmount: "330.00", invoiceDate: "2026-02-02" }),
      invoice("invoice-unknown-currency", { ...SUMMARY, vendorName: "Beta Labs", currency: null, totalAmount: "999.00" }),
    ];
    conversations = new InvoiceConversationRepository(database);
    extractedTextLookup = vi.fn((ids: string[]) => ids.map((id) => ({ id, extractedText: "Invoice line: office chairs" })));
  });

  afterEach(() => {
    database.close();
    vi.restoreAllMocks();
  });

  function createService(outputs: Array<string | Error> = [], apiKey = "test-key") {
    const client = mockClient(outputs);
    const service = new MultiInvoiceChatService({
      invoices: { findDashboardRows: () => rows, findExtractedTextsByIds: extractedTextLookup },
      conversations,
      apiKey,
      clientFactory: client.clientFactory,
    });
    return { service, ...client };
  }

  it("answers a standalone analytical question without conversation history", async () => {
    const { service, clientFactory } = createService();
    const result = await service.createConversation("What is the total invoice amount across all my invoices?");
    expect(result.exchange.assistantMessage.content).toContain("EUR 330.00; USD 350.00");
    expect(result.exchange.assistantMessage.references).toHaveLength(3);
    expect(result.exchange.assistantMessage.content).toContain("1 invoice was excluded");
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("does not substitute INR totals for an explicit USD total when only INR invoices exist", async () => {
    rows = [
      invoice("inr-available", { ...SUMMARY, currency: "INR", totalAmount: "76700.00" }),
      ...Array.from({ length: 4 }, (_, index) => invoice(`invalid-${index}`, {
        ...SUMMARY, currency: null, totalAmount: null,
      })),
    ];
    const { service, clientFactory } = createService();
    const result = await service.createConversation("What is the total amount in USD?");
    expect(result.exchange.assistantMessage.content).toContain("No invoice amounts are available in USD.");
    expect(result.exchange.assistantMessage.content).toContain("The available invoice total is INR 76,700.00.");
    expect(result.exchange.assistantMessage.references).toEqual([]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("calculates an explicit INR total and cites only INR invoices", async () => {
    rows = [
      invoice("inr-1", { ...SUMMARY, currency: "INR", totalAmount: "76700.00" }),
      invoice("usd-1", { ...SUMMARY, currency: "USD", totalAmount: "1250.00" }),
    ];
    const { service, clientFactory } = createService();
    const result = await service.createConversation("What is the total amount in INR?");
    expect(result.exchange.assistantMessage.content).toContain("Total invoice amount in INR: INR 76,700.00.");
    expect(result.exchange.assistantMessage.content).toContain("Other currency total (not converted or included in INR): USD 1,250.00.");
    expect(result.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toEqual(["inr-1"]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("filters totals and references to each explicitly requested currency in mixed-currency data", async () => {
    rows = [
      invoice("inr-1", { ...SUMMARY, currency: "INR", totalAmount: "76700.00" }),
      invoice("usd-1", { ...SUMMARY, currency: "USD", totalAmount: "1250.00" }),
    ];
    const { service, clientFactory } = createService();
    const usd = await service.createConversation("What is the total amount in USD?");
    expect(usd.exchange.assistantMessage.content).toContain("Total invoice amount in USD: USD 1,250.00.");
    expect(usd.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toEqual(["usd-1"]);

    const inr = await service.createConversation("What is the total amount in INR?");
    expect(inr.exchange.assistantMessage.content).toContain("Total invoice amount in INR: INR 76,700.00.");
    expect(inr.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toEqual(["inr-1"]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("reports unavailable requested currency while keeping other totals clearly separate", async () => {
    rows = [
      invoice("inr-1", { ...SUMMARY, currency: "INR", totalAmount: "76700.00" }),
      invoice("usd-1", { ...SUMMARY, currency: "USD", totalAmount: "1250.00" }),
    ];
    const { service } = createService();
    const result = await service.createConversation("What is the total invoice amount in CAD?");
    expect(result.exchange.assistantMessage.content).toContain("No invoice amounts are available in CAD.");
    expect(result.exchange.assistantMessage.content).toContain("Available invoice totals in other currencies (not converted or included in CAD): INR 76,700.00; USD 1,250.00.");
    expect(result.exchange.assistantMessage.references).toEqual([]);
  });

  it("resolves a total follow-up to the highest contributing invoice and preserves exclusions", async () => {
    rows = [
      invoice("winner-id", {
        ...SUMMARY,
        vendorName: "Apex Consulting",
        invoiceNumber: "ACS-2026-1048",
        currency: "INR",
        totalAmount: "76700.00",
      }, "sample_invoice_india_inr.pdf"),
      ...Array.from({ length: 4 }, (_, index) => invoice(`excluded-${index}`, {
        ...SUMMARY,
        vendorName: null,
        currency: null,
        totalAmount: null,
      }, `excluded-${index}.pdf`)),
    ];
    const { service, clientFactory } = createService();
    const first = await service.createConversation("What is the total invoice amount across all my invoices?");
    expect(first.exchange.assistantMessage.content).toContain("4 invoices were excluded");

    const followup = await service.sendMessage(first.conversation.id, "Which invoice contributes the most to this total?");
    expect(followup.exchange.assistantMessage.content).toContain("sample_invoice_india_inr.pdf");
    expect(followup.exchange.assistantMessage.content).toContain("ACS-2026-1048");
    expect(followup.exchange.assistantMessage.content).toContain("INR 76700.00");
    expect(followup.exchange.assistantMessage.content).toContain("4 invoices were excluded");
    expect(followup.exchange.assistantMessage.references).toEqual([{
      invoiceId: "winner-id",
      fileName: "sample_invoice_india_inr.pdf",
      invoiceNumber: "ACS-2026-1048",
    }]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("resolves a vendor-contribution follow-up after an all-invoice total", async () => {
    const { service, clientFactory } = createService();
    const first = await service.createConversation("What is the total invoice amount across all my invoices?");
    const followup = await service.sendMessage(first.conversation.id, "Which vendor contributes the most?");
    expect(followup.exchange.assistantMessage.content).toContain("Acme Supplies");
    expect(followup.exchange.assistantMessage.content).toContain("USD: Acme Supplies (350.00)");
    expect(followup.exchange.assistantMessage.content).toContain("EUR: Beta Labs (330.00)");
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("resolves which compared vendor is more expensive using the prior comparison", async () => {
    rows = [
      invoice("acme-1", { ...SUMMARY, totalAmount: "400.00" }),
      invoice("beta-1", { ...SUMMARY, vendorName: "Beta Labs", invoiceNumber: "B-1", totalAmount: "350.00" }),
    ];
    const { service, clientFactory } = createService();
    const first = await service.createConversation("Compare Acme Supplies and Beta Labs");
    const followup = await service.sendMessage(first.conversation.id, "Which one is more expensive?");
    expect(followup.exchange.assistantMessage.content).toContain("Acme Supplies has the higher invoice value");
    expect(followup.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toEqual(["acme-1", "beta-1"]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("identifies the invoice for a previously reported highest tax amount", async () => {
    rows = [
      invoice("tax-winner", { ...SUMMARY, invoiceNumber: "TAX-900", taxAmount: "28.50", totalAmount: "128.50" }, "tax-winner.pdf"),
      invoice("tax-other", { ...SUMMARY, invoiceNumber: "TAX-100", taxAmount: "10.00", totalAmount: "110.00" }, "tax-other.pdf"),
    ];
    const { service, clientFactory } = createService();
    const first = await service.createConversation("Which invoices have the highest tax amount?");
    const followup = await service.sendMessage(first.conversation.id, "Which invoice has that tax amount?");
    expect(followup.exchange.assistantMessage.content).toContain("tax-winner.pdf");
    expect(followup.exchange.assistantMessage.content).toContain("TAX-900");
    expect(followup.exchange.assistantMessage.content).toContain("USD: tax-winner.pdf");
    expect(followup.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toEqual(["tax-winner"]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("asks for clarification when an analytical follow-up has no matching conversation context", async () => {
    const { service, clientFactory } = createService();
    const result = await service.createConversation("Which invoice contributes the most to this total?");
    expect(result.exchange.assistantMessage.content).toContain("Which total do you mean?");
    expect(result.exchange.assistantMessage.references).toEqual([]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("calculates highest billing vendors and exact vendor comparisons", async () => {
    const { service } = createService();
    const highest = await service.createConversation("Which vendor has the highest total billing?");
    expect(highest.exchange.assistantMessage.content).toContain("USD: Acme Supplies (350.00)");
    expect(highest.exchange.assistantMessage.content).toContain("EUR: Beta Labs (330.00)");

    const comparison = await service.createConversation("Compare Acme Supplies and Beta Labs");
    expect(comparison.exchange.assistantMessage.content).toContain("Acme Supplies: 2 invoices");
    expect(comparison.exchange.assistantMessage.content).toContain("Beta Labs: 2 invoices");
    expect(comparison.exchange.assistantMessage.content).toContain("USD: Acme Supplies 350.00 vs Beta Labs no valid total available");
    expect(comparison.exchange.assistantMessage.content).toContain("EUR: Acme Supplies no valid total available vs Beta Labs 330.00");
  });

  it("calculates maximum tax and monthly trends by currency", async () => {
    const { service } = createService();
    const tax = await service.createConversation("Which invoices have the highest tax amount?");
    expect(tax.exchange.assistantMessage.content).toContain("EUR 30.00");
    expect(tax.exchange.assistantMessage.content).toContain("USD 25.00");
    expect(tax.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toContain("invoice-acme-2");

    const monthly = await service.createConversation("Show monthly spending trends");
    expect(monthly.exchange.assistantMessage.content).toContain("2026-01 USD 100.00");
    expect(monthly.exchange.assistantMessage.content).toContain("2026-02 EUR 330.00");
  });

  it("returns vendor counts, values, and source references", async () => {
    const { service } = createService();
    const total = await service.createConversation("How many invoices and what total value for Acme Supplies?");
    expect(total.exchange.assistantMessage.content).toContain("Acme Supplies has 2 invoices");
    expect(total.exchange.assistantMessage.content).toContain("USD 350.00");

    const found = await service.createConversation("Which invoices belong to Beta Labs?");
    expect(found.exchange.assistantMessage.content).toContain("B-3");
    expect(found.exchange.assistantMessage.references.map((reference) => reference.invoiceId)).toEqual(["invoice-beta", "invoice-unknown-currency"]);
  });

  it("handles empty invoice collections without inventing totals", async () => {
    rows = [];
    const { service, clientFactory } = createService();
    const result = await service.createConversation("What is the total invoice value across all invoices?");
    expect(result.exchange.assistantMessage.content).toContain("No valid amount");
    expect(result.exchange.assistantMessage.references).toEqual([]);
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("excludes malformed amounts and missing or ambiguous currencies from financial results", async () => {
    rows = [
      invoice("valid-invoice", SUMMARY),
      invoice("missing-currency", { ...SUMMARY, currency: null, totalAmount: "500.00" }),
      invoice("ambiguous-currency", { ...SUMMARY, currency: "Dollars", totalAmount: "75.00" }),
      invoice("malformed-amount", { ...SUMMARY, totalAmount: "100,2.00", taxAmount: "unknown" }),
    ];
    const { service } = createService();
    const result = await service.createConversation("What is the total value across all invoices?");
    expect(result.exchange.assistantMessage.content).toContain("USD 100.00");
    expect(result.exchange.assistantMessage.content).toContain("3 invoices were excluded");
    expect(result.exchange.assistantMessage.references).toHaveLength(1);
  });

  it("uses bounded structured context and validates model source IDs", async () => {
    const output = JSON.stringify({ answer: "The invoice covers office chairs.", sourceInvoiceIds: ["invoice-acme-1", "forged-id"] });
    const { service, create } = createService([output]);
    const result = await service.createConversation("What does this invoice cover?");
    expect(result.exchange.assistantMessage.references).toEqual([{
      invoiceId: "invoice-acme-1",
      fileName: "invoice-acme-1.pdf",
      invoiceNumber: "INV-001",
    }]);
    const request = create.mock.calls[0][0] as unknown as { input: string };
    const context = JSON.parse(request.input) as { savedInvoiceFacts: Array<Record<string, unknown>>; selectedUntrustedInvoiceText: unknown[] };
    expect(context.savedInvoiceFacts[0]).toHaveProperty("totalAmount", "100.00");
    expect(context.savedInvoiceFacts[0]).not.toHaveProperty("extractedText");
    expect(context.selectedUntrustedInvoiceText).toEqual([]);
    expect(extractedTextLookup).not.toHaveBeenCalled();
  });

  it("retrieves extracted text only for selected detail questions", async () => {
    const output = JSON.stringify({ answer: "The invoice lists office chairs.", sourceInvoiceIds: ["invoice-acme-1"] });
    const { service, create } = createService([output]);
    await service.createConversation("What line items are listed for Acme Supplies?");
    expect(extractedTextLookup).toHaveBeenCalledWith(["invoice-acme-1", "invoice-acme-2"]);
    const request = create.mock.calls[0][0] as unknown as { input: string };
    const context = JSON.parse(request.input) as { selectedUntrustedInvoiceText: Array<{ invoiceId: string; extractedText: string }> };
    expect(context.selectedUntrustedInvoiceText[0].extractedText).toContain("office chairs");
  });

  it("caps structured invoice context and tells the model when it is partial", async () => {
    rows = Array.from({ length: 25 }, (_, index) => invoice(`record-${String(index).padStart(2, "0")}`, SUMMARY));
    const output = JSON.stringify({ answer: "Based on the supplied invoice sample.", sourceInvoiceIds: ["record-00"] });
    const { service, create } = createService([output]);
    await service.createConversation("What patterns appear across these records?");
    const input = JSON.parse((create.mock.calls[0][0] as unknown as { input: string }).input) as {
      dataCoverage: { totalSavedInvoiceCount: number; providedStructuredInvoiceCount: number; invoiceContextWasCapped: boolean };
      savedInvoiceFacts: unknown[];
    };
    expect(input.dataCoverage).toEqual({
      totalSavedInvoiceCount: 25,
      providedStructuredInvoiceCount: 20,
      invoiceContextWasCapped: true,
    });
    expect(input.savedInvoiceFacts).toHaveLength(20);
  });

  it("isolates history between conversations and keeps references on retrieval", async () => {
    const output = JSON.stringify({ answer: "Saved answer one.", sourceInvoiceIds: ["invoice-acme-1"] });
    const { service, create } = createService([output, output, output]);
    const first = await service.createConversation("Describe the Acme invoice facts");
    const second = await service.createConversation("Describe the Beta invoice facts");
    const loaded = service.getConversation(first.conversation.id);
    expect(loaded.messages[1].references).toEqual(first.exchange.assistantMessage.references);
    expect(loaded.messages).toHaveLength(2);
    await service.sendMessage(second.conversation.id, "Can you clarify the invoice details?");
    const followupInput = JSON.parse((create.mock.calls[2][0] as unknown as { input: string }).input) as { recentConversationHistory: Array<{ content: string }> };
    expect(followupInput.recentConversationHistory).toHaveLength(2);
    expect(followupInput.recentConversationHistory.some((message) => message.content === "Saved answer one.")).toBe(true);
    expect(service.getConversation(first.conversation.id).messages).toHaveLength(2);
  });

  it("sends only the bounded recent conversation history to OpenAI", async () => {
    const output = JSON.stringify({ answer: "Concise answer.", sourceInvoiceIds: ["invoice-acme-1"] });
    const { service, create } = createService([output]);
    const conversation = await service.createConversation("What is the total invoice value across all invoices?");
    for (let index = 0; index < 8; index += 1) {
      conversations.saveExchange(conversation.conversation.id, `Follow-up question ${index}`, `Answer ${index}`, []);
    }

    await service.sendMessage(conversation.conversation.id, "Describe the saved invoice facts.");
    const input = JSON.parse((create.mock.calls[0][0] as unknown as { input: string }).input) as { recentConversationHistory: Array<{ content: string }> };
    expect(input.recentConversationHistory).toHaveLength(12);
    expect(input.recentConversationHistory[0].content).toBe("Follow-up question 2");
    expect(input.recentConversationHistory.at(-1)?.content).toBe("Answer 7");
  });

  it("rejects invalid IDs, empty or oversized messages, and unknown conversations", async () => {
    const { service } = createService();
    expect(() => service.getConversation("not-a-uuid")).toThrowError(expect.objectContaining({ statusCode: 400 }));
    await expect(service.sendMessage("not-a-uuid", "hello")).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.createConversation("  ")).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.createConversation("x".repeat(4_001))).rejects.toMatchObject({ statusCode: 400 });
    expect(() => service.getConversation(randomUUID())).toThrowError(expect.objectContaining({ statusCode: 404 }));
  });

  it("does not persist a new or follow-up exchange when OpenAI fails", async () => {
    const existingConversations = conversations.listConversations().length;
    const output = JSON.stringify({ answer: "Natural answer.", sourceInvoiceIds: ["invoice-acme-1"] });
    const { service } = createService([output, new Error("OpenAI unavailable")]);
    const conversation = await service.createConversation("Describe the Acme invoice in plain language");
    const before = service.getConversation(conversation.conversation.id).messages;
    await expect(service.sendMessage(conversation.conversation.id, "Explain that summary in more detail"))
      .rejects.toMatchObject({ statusCode: 502 });
    expect(service.getConversation(conversation.conversation.id).messages).toHaveLength(before.length);

    const unavailable = createService([new Error("OpenAI unavailable")]);
    await expect(unavailable.service.createConversation("Describe the Acme invoice in plain language"))
      .rejects.toMatchObject({ statusCode: 502 });
    expect(unavailable.service.listConversations()).toHaveLength(existingConversations + 1);
  });

  it("rolls back the entire exchange if persisting assistant references fails", () => {
    const cyclicReferences = [] as unknown as InvoiceReference[];
    cyclicReferences.push(cyclicReferences as unknown as InvoiceReference);
    expect(() => conversations.createWithExchange("question", "answer", cyclicReferences)).toThrow();
    expect(conversations.listConversations()).toEqual([]);
  });
});
