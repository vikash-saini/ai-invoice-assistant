export interface InvoiceSummary {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  totalAmount: string | null;
  paymentTerms: string | null;
  summary: string;
}
