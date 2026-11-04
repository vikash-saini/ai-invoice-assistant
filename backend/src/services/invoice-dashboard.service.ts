import type { InvoiceDashboardRow } from "../repositories/invoice.repository";
import type {
  CurrencyAmount,
  InvoiceDashboardStats,
  MonthlyInvoiceValue,
  VendorInvoiceStats,
} from "../types/invoice-dashboard";
import { analyzeInvoices, formatDecimal } from "./invoice-analytics";

const TOP_VENDOR_LIMIT = 5;

export interface InvoiceDashboardReader {
  findDashboardRows(): InvoiceDashboardRow[];
}

function valuesByCurrency(amounts: Map<string, { units: bigint; scale: number }>): CurrencyAmount[] {
  return [...amounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount: formatDecimal(amount) }));
}

export class InvoiceDashboardService {
  constructor(private readonly invoices: InvoiceDashboardReader) {}

  getDashboard(): InvoiceDashboardStats {
    const analytics = analyzeInvoices(this.invoices.findDashboardRows());
    const monthlyInvoiceValueTrends: MonthlyInvoiceValue[] = [...analytics.monthlyTotals.entries()]
      .map(([key, amount]) => {
        const [month, currency] = key.split("\u0000");
        return { month, currency, amount: formatDecimal(amount) };
      })
      .sort((left, right) => left.month.localeCompare(right.month) || left.currency.localeCompare(right.currency));

    const topVendors: VendorInvoiceStats[] = [...analytics.vendors.values()]
      .sort((left, right) => right.invoiceCount - left.invoiceCount || left.vendorName.localeCompare(right.vendorName))
      .slice(0, TOP_VENDOR_LIMIT)
      .map(({ vendorName, invoiceCount, amounts }) => ({
        vendorName,
        invoiceCount,
        invoiceValueTotals: valuesByCurrency(amounts),
      }));

    return {
      totalInvoiceCount: analytics.invoices.length,
      processedInvoiceCount: analytics.processedInvoiceCount,
      successfullySummarizedInvoiceCount: analytics.successfullySummarizedInvoiceCount,
      invoiceValueTotals: valuesByCurrency(analytics.totalsByCurrency),
      monthlyInvoiceValueTrends,
      topVendors,
      missingVendorInvoiceCount: analytics.missingVendorInvoiceCount,
      invoicesWithMissingOrInvalidFinancialFieldsCount: analytics.invoicesWithMissingOrInvalidFinancialFieldsCount,
    };
  }
}
