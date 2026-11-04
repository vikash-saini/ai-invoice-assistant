import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { apiService, type InvoiceConversation, type InvoiceConversationMessage } from "../services/api.service";

interface MultiInvoiceChatPageProps {
  onOpenInvoice: (invoiceId: string) => void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function MultiInvoiceChatPage({ onOpenInvoice }: MultiInvoiceChatPageProps) {
  const [conversations, setConversations] = useState<InvoiceConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InvoiceConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [listLoaded, setListLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const historyRequest = useRef(0);
  const messageCache = useRef(new Map<string, InvoiceConversationMessage[]>());
  const listLoadedRef = useRef(false);
  const sendLock = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!listLoadedRef.current) setListLoading(true);
    setListError(null);
    try {
      const result = await apiService.listInvoiceConversations();
      setConversations(result);
      listLoadedRef.current = true;
      setListLoaded(true);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load conversations.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialConversations() {
      try {
        const result = await apiService.listInvoiceConversations();
        if (active) {
          setConversations(result);
          listLoadedRef.current = true;
          setListLoaded(true);
        }
      } catch (error) {
        if (active) setListError(error instanceof Error ? error.message : "Unable to load conversations.");
      } finally {
        if (active) setListLoading(false);
      }
    }
    void loadInitialConversations();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, historyLoading, sending]);

  async function selectConversation(conversation: InvoiceConversation) {
    const requestId = ++historyRequest.current;
    const cachedMessages = messageCache.current.get(conversation.id);
    selectedIdRef.current = conversation.id;
    setSelectedId(conversation.id);
    setMessages(cachedMessages ?? []);
    setHistoryLoading(!cachedMessages);
    setHistoryRefreshing(Boolean(cachedMessages));
    setHistoryError(null);
    setSendError(null);
    setSidebarOpen(false);
    try {
      const detail = await apiService.getInvoiceConversation(conversation.id);
      if (historyRequest.current === requestId && selectedIdRef.current === conversation.id) {
        messageCache.current.set(conversation.id, detail.messages);
        setMessages(detail.messages);
      }
    } catch (error) {
      if (historyRequest.current === requestId) setHistoryError(error instanceof Error ? error.message : "Unable to load this conversation.");
    } finally {
      if (historyRequest.current === requestId) {
        setHistoryLoading(false);
        setHistoryRefreshing(false);
      }
    }
  }

  function startNewChat() {
    historyRequest.current += 1;
    selectedIdRef.current = null;
    setSelectedId(null);
    setMessages([]);
    setDraft("");
    setHistoryLoading(false);
    setHistoryRefreshing(false);
    setHistoryError(null);
    setSendError(null);
    setSidebarOpen(false);
    messageInputRef.current?.focus();
  }

  async function submitMessage(value: string) {
    const message = value.trim();
    if (!message || sending || historyLoading || historyError || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setSendError(null);
    const requestId = historyRequest.current;
    try {
      const conversationId = selectedIdRef.current;
      if (conversationId) {
        const exchange = await apiService.sendInvoiceConversationMessage(conversationId, message);
        const existing = messageCache.current.get(conversationId)
          ?? (selectedIdRef.current === conversationId ? messages : []);
        const updated = [...existing, exchange.userMessage, exchange.assistantMessage]
          .filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index);
        messageCache.current.set(conversationId, updated);
        if (selectedIdRef.current === conversationId) {
          // Keep an in-flight background GET from replacing this newer exchange with stale history.
          historyRequest.current += 1;
          setMessages(updated);
        }
      } else {
        const result = await apiService.createInvoiceConversation(message);
        if (historyRequest.current !== requestId) return;
        selectedIdRef.current = result.conversation.id;
        setSelectedId(result.conversation.id);
        const createdMessages = [result.userMessage, result.assistantMessage];
        messageCache.current.set(result.conversation.id, createdMessages);
        setMessages(createdMessages);
        setConversations((current) => [result.conversation, ...current.filter((item) => item.id !== result.conversation.id)]);
      }
      setDraft("");
      void loadConversations();
    } catch (error) {
      if (historyRequest.current === requestId) setSendError(error instanceof Error ? error.message : "Unable to send your message. Please try again.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(draft);
    }
  }

  const inputDisabled = sending || historyLoading || Boolean(historyError);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Multi-invoice intelligence</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">AI Invoice Chat</h1>
          <p className="mt-1 text-sm text-slate-500">Ask questions across your saved invoices.</p>
        </div>
        <button type="button" onClick={() => setSidebarOpen((open) => !open)} aria-expanded={sidebarOpen} aria-controls="invoice-conversation-sidebar" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:hidden">{sidebarOpen ? "Hide chats" : "Chat history"}</button>
      </div>

      <div className="grid min-h-[38rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside id="invoice-conversation-sidebar" className={`${sidebarOpen ? "block" : "hidden"} border-b border-slate-200 bg-slate-50/70 lg:block lg:border-b-0 lg:border-r`}>
          <div className="flex items-center justify-between gap-2 p-3">
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversations</h2>
            <button type="button" onClick={startNewChat} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">+ New chat</button>
          </div>
          {listLoading && !listLoaded ? <p className="px-5 py-6 text-sm text-slate-500">Loading conversations…</p> : <>
            {listError && !listLoaded ? <div className="px-4 py-5 text-sm text-rose-700" role="alert">Conversation history is unavailable: {listError}<button type="button" onClick={() => void loadConversations()} className="ml-2 font-semibold underline">Retry</button></div> : <>
            {listError && <div className="mx-3 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">Could not refresh conversations: {listError}<button type="button" onClick={() => void loadConversations()} className="ml-2 font-semibold underline">Retry</button></div>}
            {conversations.length === 0 ? <p className="px-5 py-6 text-sm leading-6 text-slate-500">No conversations yet. Start a chat to ask about your invoices.</p> : <ul className="max-h-80 space-y-1 overflow-y-auto px-2 pb-3 lg:max-h-[calc(38rem-4rem)]">
              {conversations.map((conversation) => <li key={conversation.id}>
                <button type="button" onClick={() => void selectConversation(conversation)} aria-current={selectedId === conversation.id ? "true" : undefined} className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedId === conversation.id ? "border-indigo-200 bg-indigo-50" : "border-transparent bg-transparent hover:border-slate-200 hover:bg-white"}`}>
                  <span className="block truncate text-sm font-semibold text-slate-800">{conversation.title || conversation.latestMessagePreview || "Invoice conversation"}</span>
                  <span className="mt-1 block text-xs text-slate-500">{formatTimestamp(conversation.updatedAt)}</span>
                </button>
              </li>)}
            </ul>}
            </>}
          </>}
        </aside>

        <div className="flex min-h-[34rem] min-w-0 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-white px-4 py-5 sm:px-7" aria-live="polite">
            {historyLoading ? <div role="status" className="flex h-full min-h-56 items-center justify-center gap-3 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"/>Loading conversation…</div> : messages.length === 0 && historyError ? (
              <div className="mx-auto mt-8 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">Could not load this conversation: {historyError}<button type="button" onClick={() => { const current = conversations.find((item) => item.id === selectedId); if (current) void selectConversation(current); }} className="ml-2 font-semibold underline">Retry</button></div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex min-h-[27rem] max-w-xl flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H10l-5.25 4v-6.07A2.7 2.7 0 0 1 4 12.25v-6.5Z"/><path strokeLinecap="round" d="M8 8h8M8 11.5h5"/></svg></div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Ask across your invoices</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Ask for totals by currency, vendor comparisons, invoice dates, or trends. Financial totals are calculated from saved invoice summaries.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">“Which vendor has the highest billing?”</span><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">“What is the total amount in USD?”</span></div>
              </div>
            ) : <>
              {historyRefreshing && <div role="status" className="text-center text-xs text-slate-400">Refreshing conversation…</div>}
              {historyError && <div className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">Could not refresh this conversation: {historyError}<button type="button" onClick={() => { const current = conversations.find((item) => item.id === selectedId); if (current) void selectConversation(current); }} className="ml-2 font-semibold underline">Retry</button></div>}
              {messages.map((message) => <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`w-fit max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[85%] ${message.role === "user" ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-slate-50 text-slate-700"}`}>
                <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${message.role === "user" ? "text-indigo-100" : "text-slate-400"}`}>{message.role === "user" ? "You" : "AI Invoice Assistant"}</p>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.role === "assistant" && message.references.length > 0 && <div className="mt-3 border-t border-slate-200 pt-2.5"><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sources</p><div className="flex flex-wrap gap-2">{message.references.map((reference) => <button key={reference.invoiceId} type="button" onClick={() => onOpenInvoice(reference.invoiceId)} className="max-w-full truncate rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50" title={`${reference.fileName}${reference.invoiceNumber ? ` · ${reference.invoiceNumber}` : ""}`}>{reference.fileName}{reference.invoiceNumber ? ` · ${reference.invoiceNumber}` : ""}</button>)}</div></div>}
              </div>
            </article>)}
            </>}
            {sending && <div role="status" className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"/>Preparing an answer…</div></div>}
            {sendError && <div role="alert" className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</div>}
            <div ref={latestMessageRef}/>
          </div>
          <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="mx-auto flex max-w-4xl items-end gap-2">
              <label htmlFor="multi-invoice-chat-message" className="sr-only">Message the AI Invoice Assistant</label>
              <textarea ref={messageInputRef} id="multi-invoice-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} disabled={inputDisabled} rows={2} maxLength={4000} placeholder="Ask a question across your invoices…" className="min-h-12 flex-1 resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"/>
              <button type="submit" disabled={inputDisabled || !draft.trim()} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/> : null}<span>Send</span></button>
            </div>
            <p className="mx-auto mt-2 max-w-4xl text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
          </form>
        </div>
      </div>
    </section>
  );
}
