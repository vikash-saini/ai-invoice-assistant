
import db from "./database";

export function initializeChatMessagesTable(database: typeof db = db): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            ),
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_invoice_created
            ON chat_messages (invoice_id, created_at);
    `);
}

export function initializeInvoiceConversationTables(database: typeof db = db): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS invoice_conversations (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT (
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            ),
            updated_at TEXT NOT NULL DEFAULT (
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            )
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_conversations_updated
            ON invoice_conversations (updated_at DESC);

        CREATE TABLE IF NOT EXISTS invoice_conversation_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            references_json TEXT,
            created_at TEXT NOT NULL DEFAULT (
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            ),
            FOREIGN KEY (conversation_id)
                REFERENCES invoice_conversations(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_conversation_messages_history
            ON invoice_conversation_messages (conversation_id, created_at);
    `);
}

export function initializeDatabase(database: typeof db = db): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            page_count INTEGER NOT NULL,
            extracted_text TEXT NOT NULL,
            summary_json TEXT,
            status TEXT NOT NULL DEFAULT 'uploaded'
                CHECK (status IN ('uploaded', 'processed', 'failed')),
            created_at TEXT NOT NULL DEFAULT (
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            )
        );
    `);

    const columns = database.pragma("table_info(invoices)") as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "summary_json")) {
        database.exec("ALTER TABLE invoices ADD COLUMN summary_json TEXT");
    }

    initializeChatMessagesTable(database);
    initializeInvoiceConversationTables(database);

    // Older versions saved validated summaries without updating invoice status.
    database.exec(`
        UPDATE invoices
        SET status = 'processed'
        WHERE status = 'uploaded' AND summary_json IS NOT NULL
    `);

    console.log(
    "SQLite tables:",
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    );
    console.log("SQLite database initialized successfully");
}
