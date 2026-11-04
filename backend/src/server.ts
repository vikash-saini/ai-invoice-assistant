import {env} from "./config/env";
import { initializeDatabase } from "./database/init";
import app from "./app";

const PORT = env.port;

// Create the database table before accepting requests
initializeDatabase();

async function startServer(): Promise<void> {
  const { default: app } = await import("./app");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();