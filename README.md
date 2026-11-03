# AI Invoice Assistant

A React and TypeScript application for uploading invoices, reviewing extracted information, generating structured AI summaries, chatting with invoice documents, and viewing saved invoice intelligence.

## Capabilities

- Upload PDF invoices (maximum 10 MB) and extract their text.
- Store invoice metadata, extracted text, and structured summaries in SQLite.
- Browse invoice records, inspect extracted text, and view or generate a saved AI summary.
- Ask questions about an invoice and review its persisted chat history.
- View dashboard counts, currency-separated invoice totals, monthly trends, top vendors, and invoices with missing or invalid financial fields.

## Architecture

- `frontend/` contains the React, Vite, TypeScript, and Tailwind dashboard and invoice workflows.
- `backend/` contains the Express API, PDF processing, OpenAI integration, SQLite initialization, and persistence.
- Routes connect HTTP requests to controllers; services handle summary, chat, and dashboard logic; repositories own SQL operations.
- Dashboard statistics are calculated from invoice status and the saved `invoices.summary_json`; loading the dashboard does not call the AI service.

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

The dashboard response includes `totalInvoiceCount`, `processedInvoiceCount`, `successfullySummarizedInvoiceCount`, `invoiceValueTotals`, `monthlyInvoiceValueTrends`, `topVendors`, `missingVendorInvoiceCount`, and `invoicesWithMissingOrInvalidFinancialFieldsCount`. Monetary totals are grouped by explicit currency and are never added across currencies. Trends include only valid invoice dates. The endpoint reads saved data and does not generate summaries.

## SQLite compatibility

The `invoices` table stores invoice metadata and extracted text, plus nullable `summary_json` and a status constrained to `uploaded`, `processed`, or `failed`. Startup adds `summary_json` to an older invoice table if it is absent and marks existing invoices with a saved summary as `processed`. Chat messages are stored separately in `chat_messages` and reference invoices. The dashboard adds no database columns or tables.

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
