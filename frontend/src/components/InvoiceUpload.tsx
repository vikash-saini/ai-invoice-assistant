import { useRef, useState } from "react";

interface InvoiceUploadProps {
  onUpload: (file: File) => Promise<boolean>;
  uploading: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function isPdf(file: File): boolean {
  return file.type === "application/pdf" && file.name.toLowerCase().endsWith(".pdf");
}

export function InvoiceUpload({ onUpload, uploading }: InvoiceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function chooseFile(candidate?: File) {
    setError(null);
    if (!candidate) return;
    if (!isPdf(candidate)) {
      setFile(null);
      setError("Choose a PDF file to continue.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("This file is over the 10 MB limit.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(candidate);
  }

  async function submit() {
    if (!file || uploading) return;
    const succeeded = await onUpload(file);
    if (succeeded) {
      setFile(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Upload invoice</p>
          <p className="mt-1 text-sm text-slate-500">Add a PDF to extract and organize invoice details.</p>
        </div>
        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">PDF · 10 MB max</span>
      </div>

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer.files[0]);
        }}
        className={`rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50/70"}`}
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
        </div>
        <p className="text-sm font-medium text-slate-800">Drop your invoice here</p>
        <p className="mt-1 text-xs text-slate-500">or browse from your computer</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => chooseFile(event.target.files?.[0])}
          aria-label="Choose invoice PDF"
        />
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="mt-4 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          Browse files
        </button>
      </div>

      {(file || error) && (
        <div className="mt-4" aria-live="polite">
          {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {file && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <button type="button" disabled={uploading} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70">
                {uploading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {uploading ? "Uploading…" : "Upload invoice"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
