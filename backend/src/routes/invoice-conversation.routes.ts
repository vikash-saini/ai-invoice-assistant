import { Router } from "express";
import { InvoiceConversationController } from "../controllers/invoice-conversation.controller";
import { invoiceConversationRepository } from "../repositories/invoice-conversation.repository";
import { invoiceRepository } from "../repositories/invoice.repository";
import { MultiInvoiceChatService } from "../services/multi-invoice-chat.service";

const router = Router();
const service = new MultiInvoiceChatService({
  invoices: invoiceRepository,
  conversations: invoiceConversationRepository,
});
const controller = new InvoiceConversationController(service);

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:conversationId", controller.get);
router.post("/:conversationId/messages", controller.sendMessage);

export default router;
