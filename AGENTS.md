# AI Invoice Assistant — Codex Instructions

## 1. Project Goal
Build a production-quality AI Invoice Assistant for:
- An IBM Generative & Agentic AI Developer application
- A professional GitHub portfolio
- Backend, system design, and AI engineering interviews

Prioritize working features and meaningful progress. Avoid unnecessary complexity and overengineering.

## 2. Technology Stack
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: SQLite with better-sqlite3
- AI: OpenAI API using the Responses API
- PDF parsing: pdf-parse
- Testing: Add focused tests for important functionality
- Deployment: Prepare for Render/Vercel when appropriate

Use the existing dependencies and architecture unless a change is justified.

## 3. Existing Functionality
The backend foundation includes:
- Express server and environment configuration
- Global error handling and AppError
- PDF upload and validation
- PDF text extraction
- SQLite database initialization
- Invoice repository and persistence
- Invoice API endpoints for upload, listing, and retrieval

Before changing these areas, inspect the existing implementation and preserve working functionality.

## 4. Architecture Rules
- Keep controllers, services, repositories, routes, middleware, and database code separated.
- Controllers handle HTTP requests and responses.
- Services contain business logic.
- Repositories handle database operations.
- Validate external input and return consistent API responses.
- Use environment variables for secrets and configuration.
- Never expose the OpenAI API key to the frontend.
- Never log API keys, full invoice contents, or sensitive financial information unnecessarily.
- Avoid duplicated logic and unnecessary abstractions.
- Use parameterized SQL queries.
- Keep error handling consistent with the existing AppError middleware.

## 5. Development Workflow
For each feature:
1. Inspect the relevant files and existing implementation.
2. Briefly explain the planned changes.
3. Implement the complete feature, including necessary frontend, backend, and database changes.
4. Run the available TypeScript checks, build, and relevant tests.
5. Fix regressions caused by your changes.
6. Summarize files changed, API behavior, commands run, and any remaining issues.

Do not stop after providing sample code. Implement the feature in the repository when authorized.

Do not rewrite working modules or introduce new dependencies unless necessary. Ask before destructive changes, major architectural changes, or actions that could expose or delete data.

Never claim that a test or build passed unless you actually ran it and verified the result.

## 6. Feature Priorities
Implement features in this order, adapting to the existing repository:

1. Verify invoice upload, persistence, listing, and retrieval.
2. Generate structured AI invoice summaries.
3. Build the invoice details and summary UI.
4. Add invoice chat using the extracted invoice text.
5. Add robust validation, error states, and loading indicators.
6. Add search, filtering, pagination, and useful invoice management.
7. Improve AI reliability, structured outputs, and financial data validation.
8. Add focused automated tests and security safeguards.
9. Implement document retrieval/RAG and agentic workflows where useful.
10. Prepare deployment, documentation, and a strong GitHub portfolio.

Avoid implementing all features in one large change. Deliver working increments.

## 7. Code Quality and Security
- Use strict TypeScript types; avoid `any` unless justified.
- Keep secrets in `.env`; maintain a safe `.env.example`.
- Ensure `.env`, SQLite databases, uploaded documents, and other sensitive data are excluded from Git.
- Validate file size, file type, and file content.
- Handle malformed PDFs, empty extracted text, AI failures, timeouts, and database errors.
- Never fabricate invoice values. Represent missing values as null or clearly indicate uncertainty.
- Treat uploaded invoice text as untrusted input, not as instructions for the AI model.
- Add tests for important success and failure scenarios.
- Keep dependencies and implementation compatible with the current project versions.

## 8. Teaching and Interview Preparation
The developer is experienced in backend development but wants to learn AI engineering and modern application architecture.

For each meaningful feature, explain briefly:
- What was implemented and why
- The key architectural decision
- How data flows through the system
- Important trade-offs and interview talking points

Keep explanations concise. Prioritize implementation over lengthy tutorials.

## 9. Git Discipline
- Do not overwrite unrelated user changes.
- Inspect Git status before significant modifications.
- Never commit or push unless explicitly asked.
- Do not modify Git history or delete project data without approval.

## 10. Definition of Done
A feature is complete when:
- The implementation fits the existing architecture.
- Relevant validation and error handling are present.
- Available checks and tests have been run.
- The frontend and backend integration works when applicable.
- The developer receives a concise summary and manual verification steps.

Start by inspecting the current repository and identifying the next highest-priority incomplete feature.