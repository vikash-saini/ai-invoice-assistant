import { PDFParse } from "pdf-parse";
import { AppError } from "../utils/app-error";

interface InvoiceTextResult {
  fileName: string;
  fileSize: number;
  pageCount: number;
  text: string;
}

export class InvoiceService {
  async extractInvoiceText(
    file: Express.Multer.File
  ): Promise<InvoiceTextResult> {
    const isPdf = file.buffer.subarray(0, 5).toString() === "%PDF-";

    if (!isPdf) {
      throw new AppError("Uploaded file is not a valid PDF", 400);
    }

    const parser = new PDFParse({
      data: file.buffer,
    });

    try {
      const result = await parser.getText();
      const text = result.text.trim();

      if (!text) {
          throw new AppError(
              "No extractable text found in the PDF. The file may be scanned or empty.",
              422
          );
      }

      return {
          fileName: file.originalname,
          fileSize: file.size,
          pageCount: result.total,
          text,
      };
    } catch (error: unknown) {
        if (error instanceof AppError) {
            throw error;
        }

        throw new AppError(
            "Unable to process the PDF file.",
            400
        );
    } finally {
        await parser.destroy();
    }
  }
}