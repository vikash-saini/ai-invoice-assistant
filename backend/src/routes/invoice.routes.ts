import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller";
import { InvoiceService } from "../services/invoice.service";
import { uploadInvoice } from "../middlewares/upload.middleware";

const router = Router();

const invoiceService = new InvoiceService();

const invoiceController = new InvoiceController(
  invoiceService
);

router.post(
  "/",
  uploadInvoice,
  invoiceController.uploadInvoice
);

export default router;