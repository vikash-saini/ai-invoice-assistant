import type { InvoiceListItem } from "../services/api.service";
import { formatFileSize } from "../utils/format";

interface InvoiceListProps {
  invoices: InvoiceListItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (invoice: InvoiceListItem) => void;
  onRetry: () => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function InvoiceList({ invoices, loading, error, selectedId, onSelect, onRetry }: InvoiceListProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recent invoices</h2>
          <p className="mt-0.5 text-xs text-slate-500">Your uploaded documents and processing status</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{invoices.length} total</span>
      </div>

      {loading ? (
        <div className="space-y-3 p-5" aria-label="Loading invoices">
          {[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">Invoices couldn’t be loaded</p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Try again</button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M14 4v5h4M8.5 13h7m-7 3.5h7"/></svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">No invoices yet</p>
          <p className="mt-1 text-sm text-slate-500">Upload a PDF to see it appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-6 py-3">File name</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Pages</th><th className="px-4 py-3">Uploaded</th><th className="px-6 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className={`cursor-pointer transition-colors hover:bg-indigo-50/50 ${selectedId === invoice.id ? "bg-indigo-50/70" : ""}`} onClick={() => onSelect(invoice)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(invoice); } }} tabIndex={0} aria-label={`Open ${invoice.fileName}`}>
                  <td className="max-w-[250px] px-6 py-4"><span className="block truncate font-medium text-slate-800">{invoice.fileName}</span></td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatFileSize(invoice.fileSize)}</td>
                  <td className="px-4 py-4 text-slate-600">{invoice.pageCount}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(invoice.createdAt)}</td>
                  <td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${invoice.status === "failed" ? "bg-rose-50 text-rose-700" : invoice.status === "processed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{invoice.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
