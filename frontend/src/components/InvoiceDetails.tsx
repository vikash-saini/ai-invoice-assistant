import type { Invoice } from "../services/api.service";
import { formatFileSize } from "../utils/format";

interface InvoiceDetailsProps {
  invoice: Invoice | null;
  loading: boolean;
  error: string | null;
  summaryLoading: boolean;
  summaryError: string | null;
  onGenerateSummary: () => void;
  onRetry: () => void;
}

function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-slate-800">{value ?? "Not provided"}</dd>
    </div>
  );
}

function InvoiceSummary({ invoice, loading, error, onGenerate }: { invoice: Invoice; loading: boolean; error: string | null; onGenerate: () => void }) {
  const summary = invoice.summary;
  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">AI invoice summary</h3>
          <p className="mt-0.5 text-xs text-slate-500">Key details extracted from this document</p>
        </div>
        {!summary && <button type="button" onClick={onGenerate} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70">
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {loading ? "Generating…" : "Generate summary"}
        </button>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {summary ? (
        <>
          <p className="mt-4 text-sm leading-6 text-slate-700">{summary.summary}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Info label="Vendor" value={summary.vendorName} />
            <Info label="Invoice number" value={summary.invoiceNumber} />
            <Info label="Invoice date" value={summary.invoiceDate} />
            <Info label="Due date" value={summary.dueDate} />
            <Info label="Subtotal" value={summary.subtotal === null ? null : `${summary.currency ? `${summary.currency} ` : ""}${summary.subtotal}`} />
            <Info label="Tax" value={summary.taxAmount === null ? null : `${summary.currency ? `${summary.currency} ` : ""}${summary.taxAmount}`} />
            <Info label="Total" value={summary.totalAmount === null ? null : `${summary.currency ? `${summary.currency} ` : ""}${summary.totalAmount}`} />
            <Info label="Payment terms" value={summary.paymentTerms} />
            <Info label="Currency" value={summary.currency} />
          </dl>
        </>
      ) : !error && !loading ? (
        <p className="mt-3 text-sm text-slate-600">Generate a structured summary of the vendor, dates, and amounts.</p>
      ) : null}
    </section>
  );
}

export function InvoiceDetails({ invoice, loading, error, summaryLoading, summaryError, onGenerateSummary, onRetry }: InvoiceDetailsProps) {
  if (!invoice && !loading && !error) {
    return <section className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"><p className="text-sm font-semibold text-slate-800">Select an invoice to view details</p><p className="mt-1 text-sm text-slate-500">The extracted text and AI summary will appear here.</p></section>;
  }

  if (loading) return <section className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-5 w-48 rounded bg-slate-200"/><div className="mt-5 h-24 rounded-xl bg-slate-100"/><div className="mt-4 h-40 rounded-xl bg-slate-100"/></section>;
  if (error || !invoice) return <section className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm"><p className="text-sm font-semibold text-slate-800">Invoice details couldn’t be loaded</p><p className="mt-1 text-sm text-slate-500">{error || "Please try again."}</p><button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Try again</button></section>;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Invoice details</p>
          <h2 className="mt-1 break-all text-lg font-semibold text-slate-900">{invoice.fileName}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{invoice.status}</span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info label="File size" value={formatFileSize(invoice.fileSize)} />
        <Info label="Pages" value={invoice.pageCount} />
        <Info label="Uploaded" value={new Date(invoice.createdAt).toLocaleString()} />
        <Info label="Invoice ID" value={invoice.id} />
      </dl>

      <InvoiceSummary invoice={invoice} loading={summaryLoading} error={summaryError} onGenerate={onGenerateSummary} />

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Extracted text</h3>
          <span className="text-xs text-slate-500">{invoice.extractedText.length.toLocaleString()} characters</span>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">{invoice.extractedText || "No text was extracted from this invoice."}</pre>
      </section>
    </section>
  );
}
