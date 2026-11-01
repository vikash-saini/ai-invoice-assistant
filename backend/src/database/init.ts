
import db from "./database";

export function initializeDatabase(): void {
    db.exec(`
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

    const columns = db.pragma("table_info(invoices)") as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "summary_json")) {
        db.exec("ALTER TABLE invoices ADD COLUMN summary_json TEXT");
    }

    console.log(
    "SQLite tables:",
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    );
    console.log("SQLite database initialized successfully");
}
