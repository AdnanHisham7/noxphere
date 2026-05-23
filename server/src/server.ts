import { createServer } from "http";
import mongoose from "mongoose";

import { app } from "./app";
import { config } from "@config/app.config";

import { setupExpress } from "@bootstrap/express";
import { initializeSocket } from "@bootstrap/socket";
import { connectDatabase } from "@bootstrap/database";
import { registerShutdownHandlers } from "@bootstrap/shutdown";

async function bootstrap() {
  await connectDatabase();

  setupExpress(app);

  const httpServer = createServer(app);

  initializeSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`Server running on ${config.port}`);
  });

  registerShutdownHandlers(httpServer);
}

bootstrap();
