export interface CurrencyAmount {
  currency: string;
  amount: string;
}

export interface MonthlyInvoiceValue {
  month: string;
  currency: string;
  amount: string;
}

export interface VendorInvoiceStats {
  vendorName: string;
  invoiceCount: number;
  invoiceValueTotals: CurrencyAmount[];
}

export interface InvoiceDashboardStats {
  totalInvoiceCount: number;
  processedInvoiceCount: number;
  successfullySummarizedInvoiceCount: number;
  invoiceValueTotals: CurrencyAmount[];
  monthlyInvoiceValueTrends: MonthlyInvoiceValue[];
  topVendors: VendorInvoiceStats[];
  missingVendorInvoiceCount: number;
  invoicesWithMissingOrInvalidFinancialFieldsCount: number;
}
