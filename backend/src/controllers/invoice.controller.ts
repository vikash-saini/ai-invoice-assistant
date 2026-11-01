
import { Request, Response } from "express";
import { InvoiceService } from "../services/invoice.service";
import { InvoiceSummaryService } from "../services/invoice-summary.service";
import { invoiceRepository } from "../repositories/invoice.repository";

class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoiceSummaryService: InvoiceSummaryService =
      new InvoiceSummaryService()
  ) {}

  uploadInvoice = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "Invoice PDF file is required",
      });
      return;
    }

    const invoice = await this.invoiceService.extractInvoiceText(req.file);

    res.status(201).json({
      success: true,
      message: "Invoice uploaded and saved successfully",
      data: invoice,
    });
  };

  listInvoices = (_req: Request, res: Response): void => {
    const invoices = invoiceRepository.findAll();

    // Do not return the full extracted text for every invoice.
    const data = invoices.map(
      ({ extractedText: _text, summary: _summary, ...metadata }) => metadata
    );

    res.status(200).json({
      success: true,
      data,
    });
  };

  getInvoiceById = (req: Request, res: Response): void => {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
        res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
        });
        return;
    }

    const invoice = invoiceRepository.findById(id);

    if (!invoice) {
        res.status(404).json({
        success: false,
        message: "Invoice not found",
        });
        return;
    }

    res.status(200).json({
        success: true,
        data: invoice,
    });
};

  generateSummary = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;

    if (typeof id !== "string" || !id.trim()) {
      res.status(400).json({ success: false, message: "Invalid invoice ID" });
      return;
    }

    const invoice = invoiceRepository.findById(id);
    if (!invoice) {
      res.status(404).json({ success: false, message: "Invoice not found" });
      return;
    }

    if (invoice.summary) {
      res.status(200).json({
        success: true,
        data: { invoiceId: invoice.id, summary: invoice.summary },
      });
      return;
    }

    if (!invoice.extractedText.trim()) {
      res.status(422).json({
        success: false,
        message: "Invoice has no extracted text to summarize",
      });
      return;
    }

    const summary = await this.invoiceSummaryService.generate(invoice.extractedText);
    invoiceRepository.saveSummary(invoice.id, summary);

    res.status(200).json({
      success: true,
      data: { invoiceId: invoice.id, summary },
    });
  };
}

export { InvoiceController };
