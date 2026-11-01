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

export interface Invoice {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  status: "uploaded" | "processed" | "failed";
  createdAt: string;
  extractedText: string;
  summary: InvoiceSummary | null;
}

export type InvoiceListItem = Omit<Invoice, "extractedText" | "summary">;

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error("Could not reach the backend. Check that the API server is running.");
  }

  const body = (await response.json().catch(() => null)) as
    | { message?: string; data?: T; success?: boolean }
    | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Request failed (${response.status})`);
  }

  return body.data as T;
}

export const apiService = {
  getHealth(): Promise<{ success: boolean; message: string; data: { timestamp: string } }> {
    return request("/health");
  },

  getInvoices(): Promise<InvoiceListItem[]> {
    return request<InvoiceListItem[]>("/invoices");
  },

  getInvoice(id: string): Promise<Invoice> {
    return request<Invoice>(`/invoices/${encodeURIComponent(id)}`);
  },

  uploadInvoice(file: File): Promise<Invoice> {
    const formData = new FormData();
    formData.append("invoice", file);
    return request<Invoice>("/invoices", { method: "POST", body: formData });
  },

  generateSummary(id: string): Promise<{ invoiceId: string; summary: InvoiceSummary }> {
    return request(`/invoices/${encodeURIComponent(id)}/summary`, { method: "POST" });
  },
};
