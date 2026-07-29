import express from 'express';
import cors from 'cors';
import { requestLogger } from "./middlewares/logger.middleware";
import { errorHandler } from "./middlewares/error.middleware";

import healthRoutes from "./routes/health.routes";

const app = express();

app.use(requestLogger);
app.use(cors());
app.use(express.json());

app.use("/api/v1/health", healthRoutes);
app.use(errorHandler);
export default app;