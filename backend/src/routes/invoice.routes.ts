
import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller";
import { InvoiceService } from "../services/invoice.service";
import { InvoiceSummaryService } from "../services/invoice-summary.service";
import { uploadInvoice } from "../middlewares/upload.middleware";

const router = Router();

const invoiceService = new InvoiceService();
const invoiceSummaryService = new InvoiceSummaryService();
const invoiceController = new InvoiceController(invoiceService, invoiceSummaryService);

router.post("/", uploadInvoice.single("invoice"), invoiceController.uploadInvoice);
router.get("/", invoiceController.listInvoices);
router.post("//summary", invoiceController.generateSummary);
router.post("/:id/summary", invoiceController.generateSummary);
router.get("/:id", invoiceController.getInvoiceById);

export default router;
