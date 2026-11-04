import { AppError } from "../utils/app-error";
import { InvoiceSummary } from "../types/invoice-summary";

const nullableStringFields = [
  "vendorName",
  "invoiceNumber",
  "invoiceDate",
  "dueDate",
  "currency",
  "subtotal",
  "taxAmount",
  "totalAmount",
  "paymentTerms",
] as const;

export function validateInvoiceSummary(value: unknown): InvoiceSummary {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("AI summary response was invalid", 502);
  }

  const candidate = value as Record<string, unknown>;
  const expectedFields = [...nullableStringFields, "summary"];
  const hasExactFields =
    Object.keys(candidate).length === expectedFields.length &&
    expectedFields.every((field) => Object.hasOwn(candidate, field));

  if (!hasExactFields) {
    throw new AppError("AI summary response was invalid", 502);
  }

  for (const field of nullableStringFields) {
    const fieldValue = candidate[field];
    if (
      fieldValue !== null &&
      (typeof fieldValue !== "string" || fieldValue.trim().length === 0)
    ) {
      throw new AppError("AI summary response was invalid", 502);
    }
  }

  if (
    typeof candidate.summary !== "string" ||
    candidate.summary.trim().length === 0
  ) {
    throw new AppError("AI summary response was invalid", 502);
  }

  return candidate as unknown as InvoiceSummary;
}
