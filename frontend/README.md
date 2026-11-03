# Frontend

The React dashboard provides invoice upload and management, invoice details and summaries, invoice chat, and the Invoice Intelligence Dashboard. Full application setup and API documentation are in the [root README](../README.md).

## Configuration

Set `VITE_API_BASE_URL` in a local `.env` file to the backend API base URL. It defaults to `http://localhost:5000/api/v1`; see [`.env.example`](.env.example). OpenAI credentials are configured on the backend only.

## Commands

```sh
npm run dev
npm run lint
npm run build
```
