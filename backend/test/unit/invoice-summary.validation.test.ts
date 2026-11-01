import { describe, expect, it } from "vitest";
import { validateInvoiceSummary } from "../../src/services/invoice-summary.validation";
import { InvoiceSummaryService } from "../../src/services/invoice-summary.service";

const validSummary = {
  vendorName: "Example Supplies Ltd.",
  invoiceNumber: "INV-2026-0042",
  invoiceDate: "2026-03-12",
  dueDate: null,
  currency: "USD",
  subtotal: "1200.00",
  taxAmount: "96.00",
  totalAmount: "1296.00",
  paymentTerms: null,
  summary: "Example Supplies billed $1,296.00 for office supplies.",
};

describe("validateInvoiceSummary", () => {
  it("accepts the required fields and preserves monetary precision", () => {
    const result = validateInvoiceSummary(validSummary);

    expect(result).toEqual(validSummary);
    expect(result.totalAmount).toBe("1296.00");
  });

  it("accepts null for values that are missing from the source", () => {
    expect(
      validateInvoiceSummary({ ...validSummary, vendorName: null }).vendorName
    ).toBeNull();
  });

  it("rejects missing, unexpected, or wrongly typed fields", () => {
    expect(() =>
      validateInvoiceSummary({ ...validSummary, totalAmount: 1296 })
    ).toThrow("AI summary response was invalid");
    expect(() =>
      validateInvoiceSummary({ ...validSummary, unexpected: "value" })
    ).toThrow("AI summary response was invalid");
    expect(() =>
      validateInvoiceSummary({ ...validSummary, summary: "  " })
    ).toThrow("AI summary response was invalid");
  });

  it("returns a safe configuration error when the API key is missing", async () => {
    const service = new InvoiceSummaryService("", "gpt-4o-mini");

    await expect(service.generate("Invoice text")).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("OPENAI_API_KEY"),
    });
  });
});
