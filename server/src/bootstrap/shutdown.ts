import { Server } from "http";
import mongoose from "mongoose";

import { logger } from "../shared/utils/logger";

export function registerShutdownHandlers(
  httpServer: Server,
): void {
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received. Shutting down gracefully...");

    httpServer.close(async () => {
      await mongoose.connection.close();

      logger.info("✅ Server closed successfully");

      process.exit(0);
    });
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received. Shutting down gracefully...");

    httpServer.close(async () => {
      await mongoose.connection.close();

      logger.info("✅ Server closed successfully");

      process.exit(0);
    });
  });
}