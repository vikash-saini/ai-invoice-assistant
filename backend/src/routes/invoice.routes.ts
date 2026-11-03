
import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller";
import { InvoiceService } from "../services/invoice.service";
import { InvoiceSummaryService } from "../services/invoice-summary.service";
import { InvoiceChatService } from "../services/invoice-chat.service";
import { InvoiceDashboardService } from "../services/invoice-dashboard.service";
import { chatMessageRepository } from "../repositories/chat-message.repository";
import { invoiceRepository } from "../repositories/invoice.repository";
import { uploadInvoice } from "../middlewares/upload.middleware";

const router = Router();

const invoiceService = new InvoiceService();
const invoiceSummaryService = new InvoiceSummaryService();
const invoiceChatService = new InvoiceChatService({
  invoices: invoiceRepository,
  messages: chatMessageRepository,
});
const invoiceDashboardService = new InvoiceDashboardService(invoiceRepository);
const invoiceController = new InvoiceController(
  invoiceService,
  invoiceChatService,
  invoiceDashboardService,
  invoiceSummaryService
);

router.post("/", uploadInvoice.single("invoice"), invoiceController.uploadInvoice);
router.get("/", invoiceController.listInvoices);
router.get("/dashboard", invoiceController.getDashboard);
router.post("//summary", invoiceController.generateSummary);
router.post("/:id/summary", invoiceController.generateSummary);
router.get("/:id/chat", invoiceController.getChatHistory);
router.post("/:id/chat", invoiceController.sendChatMessage);
router.get("/:id", invoiceController.getInvoiceById);

export default router;
