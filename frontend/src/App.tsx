import { useCallback, useEffect, useRef, useState } from "react";
import { InvoiceDetails } from "./components/InvoiceDetails";
import { InvoiceList } from "./components/InvoiceList";
import { InvoiceUpload } from "./components/InvoiceUpload";
import { apiService, type Invoice, type InvoiceListItem } from "./services/api.service";

function App() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const detailRequest = useRef(0);
  const uploadLock = useRef(false);

  const loadInvoices = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      setInvoices(await apiService.getInvoices());
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load invoices.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialInvoices() {
      try {
        const result = await apiService.getInvoices();
        if (active) setInvoices(result);
      } catch (error) {
        if (active) setListError(error instanceof Error ? error.message : "Unable to load invoices.");
      } finally {
        if (active) setListLoading(false);
      }
    }
    void loadInitialInvoices();
    return () => { active = false; };
  }, []);

  async function openInvoice(item: InvoiceListItem) {
    const requestId = ++detailRequest.current;
    setSelectedId(item.id);
    setSelectedInvoice(null);
    setDetailLoading(true);
    setDetailError(null);
    setSummaryError(null);
    try {
      const invoice = await apiService.getInvoice(item.id);
      if (detailRequest.current === requestId) setSelectedInvoice(invoice);
    } catch (error) {
      if (detailRequest.current === requestId) setDetailError(error instanceof Error ? error.message : "Unable to load invoice details.");
    } finally {
      if (detailRequest.current === requestId) setDetailLoading(false);
    }
  }

  async function uploadInvoice(file: File): Promise<boolean> {
    if (uploadLock.current) return false;
    uploadLock.current = true;
    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);
    try {
      const invoice = await apiService.uploadInvoice(file);
      setUploadMessage(`${invoice.fileName} uploaded successfully.`);
      setSelectedId(invoice.id);
      setSelectedInvoice(invoice);
      setDetailError(null);
      setSummaryError(null);
      detailRequest.current += 1;
      await loadInvoices();
      return true;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Invoice upload failed. Please try again.");
      return false;
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  async function generateSummary() {
    if (!selectedInvoice || summaryLoading || selectedInvoice.summary) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const result = await apiService.generateSummary(selectedInvoice.id);
      setSelectedInvoice((current) => current?.id === result.invoiceId ? { ...current, summary: result.summary } : current);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Unable to generate the summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  const processedCount = invoices.filter((invoice) => invoice.status === "processed").length;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M14 4v5h4M8.5 13h7m-7 3.5h4"/></svg>
            </div>
            <div><p className="text-sm font-bold tracking-tight text-slate-900">AI Invoice Assistant</p><p className="text-xs text-slate-500">Invoice workspace</p></div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Workspace ready</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold text-indigo-600">INVOICE MANAGEMENT</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your invoices, organized.</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Upload a PDF to extract its contents and get an AI-generated summary.</p></div>
          <div className="flex gap-3">
            <div className="min-w-28 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-medium text-slate-500">Total invoices</p><p className="mt-1 text-xl font-bold text-slate-900">{listLoading ? "—" : invoices.length}</p></div>
            <div className="min-w-28 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-medium text-slate-500">Processed</p><p className="mt-1 text-xl font-bold text-emerald-700">{listLoading ? "—" : processedCount}</p></div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <InvoiceUpload onUpload={uploadInvoice} uploading={uploading} />
          <div className="flex flex-col justify-center rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Built for clarity</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">From document to decision-ready details.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Your invoice text stays available alongside the structured summary, so key dates and amounts are easy to review.</p>
          </div>
        </div>

        {(uploadMessage || uploadError) && <div role={uploadError ? "alert" : "status"} aria-live="polite" className={`mt-5 rounded-xl px-4 py-3 text-sm ${uploadError ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{uploadError || uploadMessage}</div>}

        <div className="mt-6"><InvoiceList invoices={invoices} loading={listLoading} error={listError} selectedId={selectedId} onSelect={(invoice) => void openInvoice(invoice)} onRetry={() => void loadInvoices()} /></div>

        {(selectedId || detailLoading || detailError) && <div className="mt-6"><InvoiceDetails invoice={selectedInvoice} loading={detailLoading} error={detailError} summaryLoading={summaryLoading} summaryError={summaryError} onGenerateSummary={() => void generateSummary()} onRetry={() => { const item = invoices.find((invoice) => invoice.id === selectedId); if (item) void openInvoice(item); }} /></div>}
      </main>
    </div>
  );
}

export default App;
