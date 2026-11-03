import type { InvoiceDashboardRow } from "../repositories/invoice.repository";
import { validateInvoiceSummary } from "./invoice-summary.validation";

const MAX_MONEY_TEXT_LENGTH = 100;
const MAX_MONEY_SCALE = 8;

export interface DecimalAmount {
  units: bigint;
  scale: number;
}
export interface AnalyzedInvoice {
  id: string;
  fileName: string;
  status: InvoiceDashboardRow["status"];
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  vendorName: string | null;
  vendorKey: string | null;
  currency: string | null;
  subtotal: DecimalAmount | null;
  taxAmount: DecimalAmount | null;
  totalAmount: DecimalAmount | null;
  paymentTerms: string | null;
  summary: string | null;
}

export interface VendorAggregate {
  vendorName: string;
  invoiceCount: number;
  amounts: Map<string, DecimalAmount>;
}

export interface InvoiceAnalytics {
  invoices: AnalyzedInvoice[];
  totalsByCurrency: Map<string, DecimalAmount>;
  monthlyTotals: Map<string, DecimalAmount>;
  vendors: Map<string, VendorAggregate>;
  processedInvoiceCount: number;
  successfullySummarizedInvoiceCount: number;
  missingVendorInvoiceCount: number;
  invoicesWithMissingOrInvalidFinancialFieldsCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isSuccessfullySummarized(summary: Record<string, unknown> | null): boolean {
  if (!summary) return false;
  try {
    validateInvoiceSummary(summary);
    return true;
  } catch {
    return false;
  }
}

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const currency = value.trim().replace(/\s+/g, " ").toUpperCase();
  if (!currency || currency.length > 16 || !/\p{L}/u.test(currency)) return null;
  if (/^(DOLLARS?|RUPEES?|POUNDS?|YEN|YUAN)$/u.test(currency)) return null;
  return currency;
}

export function normalizeVendor(value: unknown): { name: string; key: string } | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name ? { name, key: name.toLowerCase() } : null;
}

export function parseMoneyAmount(value: unknown): DecimalAmount | null {
  if (typeof value !== "string" || value.length > MAX_MONEY_TEXT_LENGTH) return null;
  let text = value.trim();
  if (!text) return null;

  let negative = false;
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  if (text.startsWith("-") || text.startsWith("+")) {
    if (text.startsWith("-")) negative = !negative;
    text = text.slice(1).trim();
  }

  text = text
    .replace(/^[A-Za-z]{3}\s*/, "")
    .replace(/\s+[A-Za-z]{3}$/, "")
    .replace(/^[\p{Sc}\s]+/u, "")
    .replace(/[\p{Sc}\s]+$/u, "");

  const match = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > MAX_MONEY_SCALE) return null;
  try {
    const units = BigInt(`${match[1].replaceAll(",", "")}${fraction}`);
    return { units: negative ? -units : units, scale: fraction.length };
  } catch {
    return null;
  }
}

export function addDecimal(left: DecimalAmount | null, right: DecimalAmount): DecimalAmount {
  if (!left) return { ...right };
  const scale = Math.max(left.scale, right.scale);
  return {
    units: left.units * (10n ** BigInt(scale - left.scale)) + right.units * (10n ** BigInt(scale - right.scale)),
    scale,
  };
}

export function compareDecimal(left: DecimalAmount, right: DecimalAmount): number {
  const scale = Math.max(left.scale, right.scale);
  const leftUnits = left.units * (10n ** BigInt(scale - left.scale));
  const rightUnits = right.units * (10n ** BigInt(scale - right.scale));
  return leftUnits < rightUnits ? -1 : leftUnits > rightUnits ? 1 : 0;
}

export function formatDecimal(amount: DecimalAmount): string {
  const negative = amount.units < 0;
  const digits = (negative ? -amount.units : amount.units).toString();
  if (amount.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(amount.scale + 1, "0");
  const splitAt = padded.length - amount.scale;
  return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

export function parseInvoiceMonth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const dateText = value.trim();
  let yearText: string;
  let monthText: string;
  let dayText: string;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (iso) {
    [, yearText, monthText, dayText] = iso;
  } else {
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthFirst = /^(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(dateText);
    const dayFirst = /^(\d{1,2})\s+(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC),?\s+(\d{4})$/i.exec(dateText);
    if (monthFirst) {
      const monthToken = monthFirst[1].toUpperCase();
      monthText = String(monthNames.findIndex((name) => name.startsWith(monthToken)) + 1).padStart(2, "0");
      [, , dayText, yearText] = monthFirst;
    } else if (dayFirst) {
      const monthToken = dayFirst[2].toUpperCase();
      monthText = String(monthNames.findIndex((name) => name.startsWith(monthToken)) + 1).padStart(2, "0");
      [, dayText, , yearText] = dayFirst;
    } else {
      return null;
    }
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function analyzeInvoices(rows: InvoiceDashboardRow[]): InvoiceAnalytics {
  const invoices: AnalyzedInvoice[] = [];
  const totalsByCurrency = new Map<string, DecimalAmount>();
  const monthlyTotals = new Map<string, DecimalAmount>();
  const vendors = new Map<string, VendorAggregate>();
  let processedInvoiceCount = 0;
  let successfullySummarizedInvoiceCount = 0;
  let missingVendorInvoiceCount = 0;
  let invoicesWithMissingOrInvalidFinancialFieldsCount = 0;

  for (const row of rows) {
    const summary = row.summary;
    if (row.status === "processed") processedInvoiceCount += 1;
    if (isRecord(summary) && isSuccessfullySummarized(summary)) successfullySummarizedInvoiceCount += 1;

    const currency = normalizeCurrency(summary?.currency);
    const subtotal = parseMoneyAmount(summary?.subtotal);
    const taxAmount = parseMoneyAmount(summary?.taxAmount);
    const totalAmount = parseMoneyAmount(summary?.totalAmount);
    if (!currency || !subtotal || !taxAmount || !totalAmount) invoicesWithMissingOrInvalidFinancialFieldsCount += 1;

    const vendor = normalizeVendor(summary?.vendorName);
    if (!vendor) missingVendorInvoiceCount += 1;
    const fact: AnalyzedInvoice = {
      id: row.id,
      fileName: row.fileName,
      status: row.status,
      invoiceNumber: optionalText(summary?.invoiceNumber),
      invoiceDate: optionalText(summary?.invoiceDate),
      dueDate: optionalText(summary?.dueDate),
      vendorName: vendor?.name ?? null,
      vendorKey: vendor?.key ?? null,
      currency,
      subtotal,
      taxAmount,
      totalAmount,
      paymentTerms: optionalText(summary?.paymentTerms),
      summary: optionalText(summary?.summary),
    };
    invoices.push(fact);

    if (currency && totalAmount) {
      totalsByCurrency.set(currency, addDecimal(totalsByCurrency.get(currency) ?? null, totalAmount));
      const month = parseInvoiceMonth(fact.invoiceDate);
      if (month) {
        const key = `${month}\u0000${currency}`;
        monthlyTotals.set(key, addDecimal(monthlyTotals.get(key) ?? null, totalAmount));
      }
    }

    if (vendor) {
      let aggregate = vendors.get(vendor.key);
      if (!aggregate) {
        aggregate = { vendorName: vendor.name, invoiceCount: 0, amounts: new Map() };
        vendors.set(vendor.key, aggregate);
      }
      aggregate.invoiceCount += 1;
      if (currency && totalAmount) aggregate.amounts.set(currency, addDecimal(aggregate.amounts.get(currency) ?? null, totalAmount));
    }
  }

  return {
    invoices,
    totalsByCurrency,
    monthlyTotals,
    vendors,
    processedInvoiceCount,
    successfullySummarizedInvoiceCount,
    missingVendorInvoiceCount,
    invoicesWithMissingOrInvalidFinancialFieldsCount,
  };
}
