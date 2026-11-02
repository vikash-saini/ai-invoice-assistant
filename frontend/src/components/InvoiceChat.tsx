import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessage } from "../services/api.service";

interface InvoiceChatProps {
  messages: ChatMessage[];
  loadingHistory: boolean;
  sending: boolean;
  error: string | null;
  historyError: string | null;
  onSend: (message: string) => Promise<boolean>;
  onRetryHistory: () => void;
}

const suggestedQuestions = [
  "What is the total invoice amount?",
  "When is the payment due?",
  "Who is the vendor?",
  "Explain the tax breakdown.",
  "What are the payment terms?",
];

export function InvoiceChat({ messages, loadingHistory, sending, error, historyError, onSend, onRetryHistory }: InvoiceChatProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loadingHistory, sending]);

  async function send(message: string) {
    const content = message.trim();
    if (!content || sending || loadingHistory || historyError) return;
    if (await onSend(content)) setDraft("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  const disabled = loadingHistory || sending || Boolean(historyError);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-slate-900">Chat with this invoice</h3>
        <p className="mt-0.5 text-xs text-slate-500">Answers are grounded in the selected invoice.</p>
      </div>

      <div className="max-h-[25rem] min-h-48 space-y-4 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-5" aria-live="polite">
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-5 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"/>Loading conversation…</div>
        ) : messages.length === 0 && !error && !historyError ? (
          <div className="py-2">
            <p className="text-center text-sm text-slate-600">Ask a question about the invoice. Try one of these:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((question) => <button key={question} type="button" disabled={disabled} onClick={() => void send(question)} className="rounded-full border border-indigo-200 bg-white px-3 py-2 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{question}</button>)}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 sm:max-w-[80%] ${message.role === "user" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"}`}>
                <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${message.role === "user" ? "text-indigo-100" : "text-slate-400"}`}>{message.role === "user" ? "You" : "Invoice assistant"}</p>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {sending && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-3 text-xs text-slate-500 shadow-sm"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"/>Thinking about the invoice…</div></div>}
        {historyError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Could not load previous messages: {historyError}<button type="button" onClick={onRetryHistory} className="ml-2 font-semibold underline">Retry</button></div>}
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <div ref={bottomRef}/>
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-slate-100 p-3 sm:p-4">
        <label htmlFor="invoice-chat-message" className="sr-only">Ask a question about this invoice</label>
        <textarea id="invoice-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} disabled={disabled} rows={2} maxLength={4000} placeholder="Ask about amounts, dates, or terms…" className="min-h-11 flex-1 resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" />
        <button type="submit" disabled={disabled || !draft.trim()} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m4 12 16-8-5 16-3-7-8-1Z"/><path strokeLinecap="round" strokeLinejoin="round" d="m12 13 8-9"/></svg>}
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
      <p className="px-4 pb-3 text-[11px] text-slate-400 sm:px-5">Enter to send · Shift+Enter for a new line</p>
    </section>
  );
}
