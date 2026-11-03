import type { InvoiceDashboardRow } from "../repositories/invoice.repository";
import type {
  CurrencyAmount,
  InvoiceDashboardStats,
  MonthlyInvoiceValue,
  VendorInvoiceStats,
} from "../types/invoice-dashboard";
import { validateInvoiceSummary } from "./invoice-summary.validation";

const TOP_VENDOR_LIMIT = 5;
const MAX_MONEY_TEXT_LENGTH = 100;
const MAX_MONEY_SCALE = 8;

interface DecimalAmount {
  units: bigint;
  scale: number;
}

interface VendorAccumulator {
  vendorName: string;
  invoiceCount: number;
  amounts: Map<string, DecimalAmount>;
}

export interface InvoiceDashboardReader {
  findDashboardRows(): InvoiceDashboardRow[];
}

function parseSummary(summaryJson: string | null): Record<string, unknown> | null {
  if (!summaryJson) return null;
  try {
    const value: unknown = JSON.parse(summaryJson);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function isSuccessfullySummarized(value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  try {
    validateInvoiceSummary(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const currency = value.trim().replace(/\s+/g, " ").toUpperCase();
  if (!currency || currency.length > 16 || !/\p{L}/u.test(currency)) return null;
  if (/^(DOLLARS?|RUPEES?|POUNDS?|YEN|YUAN)$/u.test(currency)) return null;
  return currency;
}

function parseMoneyAmount(value: unknown): DecimalAmount | null {
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
  const scale = fraction.length;
  const digits = `${match[1].replaceAll(",", "")}${fraction}`;
  let units: bigint;
  try {
    units = BigInt(digits);
  } catch {
    return null;
  }
  return { units: negative ? -units : units, scale };
}

function addDecimal(target: Map<string, DecimalAmount>, key: string, amount: DecimalAmount): void {
  const current = target.get(key);
  if (!current) {
    target.set(key, { ...amount });
    return;
  }

  const scale = Math.max(current.scale, amount.scale);
  const currentUnits = current.units * (10n ** BigInt(scale - current.scale));
  const addedUnits = amount.units * (10n ** BigInt(scale - amount.scale));
  target.set(key, { units: currentUnits + addedUnits, scale });
}

function formatDecimal(amount: DecimalAmount): string {
  const negative = amount.units < 0n;
  const digits = (negative ? -amount.units : amount.units).toString();
  if (amount.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(amount.scale + 1, "0");
  const splitAt = padded.length - amount.scale;
  return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

function valuesByCurrency(amounts: Map<string, DecimalAmount>): CurrencyAmount[] {
  return [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount: formatDecimal(amount) }));
}

function parseInvoiceMonth(value: unknown): string | null {
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
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function invoiceValue(summary: Record<string, unknown> | null): {
  currency: string | null;
  amount: DecimalAmount | null;
} {
  return {
    currency: normalizeCurrency(summary?.currency),
    amount: parseMoneyAmount(summary?.totalAmount),
  };
}

export class InvoiceDashboardService {
  constructor(private readonly invoices: InvoiceDashboardReader) {}

  getDashboard(): InvoiceDashboardStats {
    const rows = this.invoices.findDashboardRows();
    const invoiceTotals = new Map<string, DecimalAmount>();
    const monthlyTotals = new Map<string, DecimalAmount>();
    const vendors = new Map<string, VendorAccumulator>();
    let processedInvoiceCount = 0;
    let successfullySummarizedInvoiceCount = 0;
    let missingVendorInvoiceCount = 0;
    let invoicesWithMissingOrInvalidFinancialFieldsCount = 0;

    for (const row of rows) {
      if (row.status === "processed") processedInvoiceCount += 1;
      const summary = parseSummary(row.summary_json);
      if (isSuccessfullySummarized(summary)) successfullySummarizedInvoiceCount += 1;

      const currency = normalizeCurrency(summary?.currency);
      const subtotal = parseMoneyAmount(summary?.subtotal);
      const tax = parseMoneyAmount(summary?.taxAmount);
      const { amount: total } = invoiceValue(summary);
      if (!currency || !subtotal || !tax || !total) {
        invoicesWithMissingOrInvalidFinancialFieldsCount += 1;
      }

      if (currency && total) {
        addDecimal(invoiceTotals, currency, total);
        const month = parseInvoiceMonth(summary?.invoiceDate);
        if (month) addDecimal(monthlyTotals, `${month}\u0000${currency}`, total);
      }

      const vendorName = typeof summary?.vendorName === "string"
        ? summary.vendorName.trim().replace(/\s+/g, " ")
        : "";
      if (!vendorName) {
        missingVendorInvoiceCount += 1;
        continue;
      }

      const vendorKey = vendorName.toLowerCase();
      let vendor = vendors.get(vendorKey);
      if (!vendor) {
        vendor = { vendorName, invoiceCount: 0, amounts: new Map() };
        vendors.set(vendorKey, vendor);
      }
      vendor.invoiceCount += 1;
      if (currency && total) addDecimal(vendor.amounts, currency, total);
    }

    const monthlyInvoiceValueTrends: MonthlyInvoiceValue[] = [...monthlyTotals.entries()]
      .map(([key, amount]) => {
        const [month, currency] = key.split("\u0000");
        return { month, currency, amount: formatDecimal(amount) };
      })
      .sort((left, right) => left.month.localeCompare(right.month) || left.currency.localeCompare(right.currency));

    const topVendors: VendorInvoiceStats[] = [...vendors.values()]
      .sort((left, right) => right.invoiceCount - left.invoiceCount || left.vendorName.localeCompare(right.vendorName))
      .slice(0, TOP_VENDOR_LIMIT)
      .map(({ vendorName, invoiceCount, amounts }) => ({
        vendorName,
        invoiceCount,
        invoiceValueTotals: valuesByCurrency(amounts),
      }));

    return {
      totalInvoiceCount: rows.length,
      processedInvoiceCount,
      successfullySummarizedInvoiceCount,
      invoiceValueTotals: valuesByCurrency(invoiceTotals),
      monthlyInvoiceValueTrends,
      topVendors,
      missingVendorInvoiceCount,
      invoicesWithMissingOrInvalidFinancialFieldsCount,
    };
  }
}
