
import { randomUUID } from "node:crypto";
import db from "../database/database";
import { InvoiceSummary } from "../types/invoice-summary";

export interface CreateInvoiceInput {
    fileName: string;
    fileSize: number;
    pageCount: number;
    extractedText: string;
}

export interface InvoiceRecord extends CreateInvoiceInput {
    id: string;
    status: "uploaded" | "processed" | "failed";
    createdAt: string;
    summary: InvoiceSummary | null;
}

interface InvoiceRow {
    id: string;
    file_name: string;
    file_size: number;
    page_count: number;
    extracted_text: string;
    status: "uploaded" | "processed" | "failed";
    created_at: string;
    summary_json: string | null;
}

export interface InvoiceDashboardRow {
    id: string;
    fileName: string;
    status: InvoiceRecord["status"];
    summary: Record<string, unknown> | null;
}

function mapInvoice(row: InvoiceRow): InvoiceRecord {
    return {
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size,
        pageCount: row.page_count,
        extractedText: row.extracted_text,
        status: row.status,
        createdAt: row.created_at,
        summary: row.summary_json ? JSON.parse(row.summary_json) as InvoiceSummary : null,
    };
}

const insertInvoice = db.prepare(`
    INSERT INTO invoices (
        id, file_name, file_size, page_count, extracted_text
    )
    VALUES (
        @id, @fileName, @fileSize, @pageCount, @extractedText
    )
`);

const findInvoiceById = db.prepare(`
    SELECT
        id,
        file_name,
        file_size,
        page_count,
        extracted_text,
        summary_json,
        status,
        created_at
    FROM invoices
    WHERE id = ?
`);

const findAllInvoices = db.prepare(`
    SELECT
        id,
        file_name,
        file_size,
        page_count,
        extracted_text,
        summary_json,
        status,
        created_at
    FROM invoices
    ORDER BY created_at DESC
`);

const saveInvoiceSummary = db.prepare(`
    UPDATE invoices
    SET summary_json = ?, status = 'processed'
    WHERE id = ?
`);

const findInvoicesForDashboard = db.prepare(`
    SELECT id, file_name, status, summary_json
    FROM invoices
`);

function parseStoredSummary(value: string | null): Record<string, unknown> | null {
    if (!value) return null;
    try {
        const parsed: unknown = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

export const invoiceRepository = {
    create(input: CreateInvoiceInput): InvoiceRecord {
        const id = randomUUID();

        insertInvoice.run({ id, ...input });

        const row = findInvoiceById.get(id) as InvoiceRow | undefined;

        if (!row) {
            throw new Error("Failed to retrieve the saved invoice");
        }

        return mapInvoice(row);
    },

    findById(id: string): InvoiceRecord | null {
        const row = findInvoiceById.get(id) as InvoiceRow | undefined;

        return row ? mapInvoice(row) : null;
    },

    findAll(): InvoiceRecord[] {
        return (findAllInvoices.all() as InvoiceRow[]).map(mapInvoice);
    },

    saveSummary(id: string, summary: InvoiceSummary): void {
        saveInvoiceSummary.run(JSON.stringify(summary), id);
    },

    findDashboardRows(): InvoiceDashboardRow[] {
        return (findInvoicesForDashboard.all() as Array<{
            id: string;
            file_name: string;
            status: InvoiceRecord["status"];
            summary_json: string | null;
        }>).map((row) => ({
            id: row.id,
            fileName: row.file_name,
            status: row.status,
            summary: parseStoredSummary(row.summary_json),
        }));
    },

    findExtractedTextsByIds(ids: string[]): Array<{ id: string; extractedText: string }> {
        if (ids.length === 0) return [];
        const placeholders = ids.map(() => "?").join(", ");
        return db.prepare(`
            SELECT id, extracted_text AS extractedText
            FROM invoices
            WHERE id IN (${placeholders})
        `).all(...ids) as Array<{ id: string; extractedText: string }>;
    },
};
