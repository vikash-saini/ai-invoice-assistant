import express from 'express';
import cors from 'cors';

import healthRoutes from "./routes/health.routes";
import invoiceRoutes from "./routes/invoice.routes";
import { requestLogger } from "./middlewares/logger.middleware";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(requestLogger);
app.use(cors());
app.use(express.json());

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use(errorHandler);
export default app;