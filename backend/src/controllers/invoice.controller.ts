import { Request, Response } from "express";
import { InvoiceService } from "../services/invoice.service";

class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) {}

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

        const result = await this.invoiceService.extractInvoiceText(
        req.file
        );

        res.status(200).json({
        success: true,
        message: "Invoice uploaded and text extracted successfully",
        data: result,
        });
    };
}

export { InvoiceController };