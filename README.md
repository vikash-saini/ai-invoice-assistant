# AI Invoice Assistant

A React and TypeScript application for uploading invoices, reviewing extracted information, generating structured AI summaries, chatting with invoice documents, and viewing saved invoice intelligence.

## Capabilities

- Upload PDF invoices (maximum 10 MB) and extract their text.
- Store invoice metadata, extracted text, and structured summaries in SQLite.
- Browse invoice records, inspect extracted text, and view or generate a saved AI summary.
- Ask questions about an invoice and review its persisted chat history.
- Ask questions across saved invoices in separate, persistent multi-invoice conversations.
- View dashboard counts, currency-separated invoice totals, monthly trends, top vendors, and invoices with missing or invalid financial fields.

## Architecture

- `frontend/` contains the React, Vite, TypeScript, and Tailwind dashboard and invoice workflows.
- `backend/` contains the Express API, PDF processing, OpenAI integration, SQLite initialization, and persistence.
- Routes connect HTTP requests to controllers; services handle summary, chat, and dashboard logic; repositories own SQL operations.
- Dashboard statistics are calculated from invoice status and the saved `invoices.summary_json`; loading the dashboard does not call the AI service.
- Multi-invoice chat calculates supported financial aggregates in the backend, filters explicit currency-total questions to that currency without conversion, and uses the Responses API only for natural-language reasoning over bounded structured invoice context.

## Run locally

Use two terminals. Install dependencies with `npm install` in both `backend/` and `frontend/`.

1. In `backend/`, copy `.env.example` to `.env`. Set `OPENAI_API_KEY` to enable summary and chat requests. `PORT` defaults to `5000`, `OPENAI_MODEL` to `gpt-4o-mini`, and `DATABASE_PATH` to `./database.sqlite`.
2. Start the API from `backend/` with `npm run dev`.
3. In `frontend/`, copy `.env.example` to `.env` if you need to override the API URL. `VITE_API_BASE_URL` defaults to `http://localhost:5000/api/v1`.
4. Start the frontend from `frontend/` with `npm run dev` and open the local URL Vite prints.

The OpenAI key belongs only in the backend environment. The frontend does not receive it.

## API

All invoice routes are under `/api/v1/invoices`. Successful responses use `{ "success": true, "data": ... }`.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/invoices` | Upload a PDF using multipart field `invoice`; extracts text and saves the invoice. |
| `GET` | `/api/v1/invoices` | List invoice metadata without extracted text or summary payloads. |
| `GET` | `/api/v1/invoices/dashboard` | Return aggregate invoice dashboard statistics. |
| `GET` | `/api/v1/invoices/:id` | Retrieve invoice metadata, extracted text, and any saved summary. |
| `POST` | `/api/v1/invoices/:id/summary` | Return the cached summary or generate, validate, and persist one. |
| `GET` | `/api/v1/invoices/:id/chat` | Retrieve saved chat history. |
| `POST` | `/api/v1/invoices/:id/chat` | Send a JSON `{ "message": "..." }` question about that invoice. |
| `POST` | `/api/v1/invoice-conversations` | Create a multi-invoice conversation and process its first `{ "message": "..." }`. |
| `GET` | `/api/v1/invoice-conversations` | List up to 100 conversations with timestamps, a title from the first user message, and latest message preview. |
| `GET` | `/api/v1/invoice-conversations/:conversationId` | Retrieve the full conversation history and saved source references. |
| `POST` | `/api/v1/invoice-conversations/:conversationId/messages` | Send a follow-up `{ "message": "..." }` in that conversation. |

The dashboard response includes `totalInvoiceCount`, `processedInvoiceCount`, `successfullySummarizedInvoiceCount`, `invoiceValueTotals`, `monthlyInvoiceValueTrends`, `topVendors`, `missingVendorInvoiceCount`, and `invoicesWithMissingOrInvalidFinancialFieldsCount`. Monetary totals are grouped by explicit currency and are never added across currencies. Trends include only valid invoice dates. The endpoint reads saved data and does not generate summaries.

Multi-invoice conversations return user and assistant message objects; assistant messages include backend-validated `references` with `invoiceId`, `fileName`, and `invoiceNumber`. Intent resolution uses the latest question and bounded conversation history to handle follow-ups to totals, vendor comparisons, and highest-tax results. Exact total, highest contributing invoice/vendor, vendor billing/count/comparison, highest-tax, monthly trend, and vendor invoice lookup questions are calculated from saved fields. Other questions use the Responses API with up to 20 relevant structured summaries and at most two selected extracted-text snippets when a line-item or document-detail question requires them. Financial values with missing/ambiguous currency or malformed amounts are excluded and reported. OpenAI is not asked to calculate totals or rankings.

## SQLite compatibility

The `invoices` table stores invoice metadata and extracted text, plus nullable `summary_json` and a status constrained to `uploaded`, `processed`, or `failed`. Startup adds `summary_json` to an older invoice table if it is absent and marks existing invoices with a saved summary as `processed`. Single-invoice messages remain in `chat_messages`. Multi-invoice history uses `invoice_conversations` and `invoice_conversation_messages`; assistant references are stored in nullable `references_json`, and message rows cascade when their conversation is deleted. Startup creates these tables and indexes without changing the existing single-invoice chat schema. There is no user ownership or authentication model yet.

## Checks

Run from `backend/`:

```sh
npm test
npm run build
```

Run from `frontend/`:

```sh
npm run lint
npm run build
```

See [`frontend/README.md`](frontend/README.md) for frontend-specific configuration and scripts.
