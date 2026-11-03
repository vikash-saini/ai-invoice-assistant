import { describe, expect, it } from "vitest";
import { InvoiceDashboardService } from "../../src/services/invoice-dashboard.service";
import type { InvoiceDashboardRow } from "../../src/repositories/invoice.repository";

const baseSummary = {
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
};

function row(summary: Record<string, unknown> | null, status: InvoiceDashboardRow["status"] = "processed"): InvoiceDashboardRow {
  return { status, summary_json: summary ? JSON.stringify(summary) : null };
}

function dashboard(rows: InvoiceDashboardRow[]) {
  return new InvoiceDashboardService({ findDashboardRows: () => rows }).getDashboard();
}

describe("InvoiceDashboardService", () => {
  it("returns zeroed statistics for an empty invoice database", () => {
    expect(dashboard([])).toEqual({
      totalInvoiceCount: 0,
      processedInvoiceCount: 0,
      successfullySummarizedInvoiceCount: 0,
      invoiceValueTotals: [],
      monthlyInvoiceValueTrends: [],
      topVendors: [],
      missingVendorInvoiceCount: 0,
      invoicesWithMissingOrInvalidFinancialFieldsCount: 0,
    });
  });

  it("keeps invoice totals separate by currency and sums decimal strings exactly", () => {
    const stats = dashboard([
      row(baseSummary),
      row({ ...baseSummary, invoiceNumber: "INV-2", totalAmount: "$1,000.25" }),
      row({ ...baseSummary, invoiceNumber: "INV-3", currency: "eur", totalAmount: "100.25" }),
      row({ ...baseSummary, invoiceNumber: "INV-4", currency: "$", totalAmount: "999.00" }),
    ]);

    expect(stats.invoiceValueTotals).toEqual([
      { currency: "EUR", amount: "100.25" },
      { currency: "USD", amount: "1100.25" },
    ]);
    expect(stats.monthlyInvoiceValueTrends).toEqual([
      { month: "2026-01", currency: "EUR", amount: "100.25" },
      { month: "2026-01", currency: "USD", amount: "1100.25" },
    ]);
    expect(stats.invoicesWithMissingOrInvalidFinancialFieldsCount).toBe(1);
  });

  it("does not infer missing currency and ignores missing or malformed monetary amounts", () => {
    const stats = dashboard([
      row(baseSummary),
      row({ ...baseSummary, currency: null, totalAmount: "999.00" }),
      row({ ...baseSummary, taxAmount: "1,2.00", totalAmount: "not an amount" }),
      row(null),
    ]);

    expect(stats.invoiceValueTotals).toEqual([{ currency: "USD", amount: "100.00" }]);
    expect(stats.invoicesWithMissingOrInvalidFinancialFieldsCount).toBe(3);
    expect(stats.successfullySummarizedInvoiceCount).toBe(3);
  });

  it("normalizes vendor names and counts missing vendors separately", () => {
    const stats = dashboard([
      row(baseSummary),
      row({ ...baseSummary, vendorName: "  acme   supplies ", totalAmount: "25.00" }),
      row({ ...baseSummary, vendorName: null, totalAmount: "75.00" }),
    ]);

    expect(stats.topVendors).toEqual([{
      vendorName: "Acme Supplies",
      invoiceCount: 2,
      invoiceValueTotals: [{ currency: "USD", amount: "125.00" }],
    }]);
    expect(stats.missingVendorInvoiceCount).toBe(1);
    expect(stats.invoiceValueTotals).toEqual([{ currency: "USD", amount: "200.00" }]);
  });

  it("excludes missing and invalid invoice dates from monthly trends", () => {
    const stats = dashboard([
      row(baseSummary),
      row({ ...baseSummary, invoiceDate: "2026-02-30", totalAmount: "50.00" }),
      row({ ...baseSummary, invoiceDate: null, totalAmount: "25.00" }),
      row({ ...baseSummary, invoiceDate: "March 12, 2026", totalAmount: "15.00" }),
    ]);

    expect(stats.invoiceValueTotals).toEqual([{ currency: "USD", amount: "190.00" }]);
    expect(stats.monthlyInvoiceValueTrends).toEqual([
      { month: "2026-01", currency: "USD", amount: "100.00" },
      { month: "2026-03", currency: "USD", amount: "15.00" },
    ]);
  });

  it("distinguishes processed status from the count of valid saved summaries", () => {
    const stats = dashboard([
      row(baseSummary, "uploaded"),
      row({ ...baseSummary, summary: "" }, "processed"),
    ]);
    expect(stats.totalInvoiceCount).toBe(2);
    expect(stats.processedInvoiceCount).toBe(1);
    expect(stats.successfullySummarizedInvoiceCount).toBe(1);
  });
});
