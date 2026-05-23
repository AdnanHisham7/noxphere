import mongoose from "mongoose";

import { config } from "../config/app.config";
import { logger } from "../shared/utils/logger";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.db.uri);

    logger.info("✅ MongoDB connected");
  } catch (error) {
    logger.error("❌ MongoDB connection failed", error);

    process.exit(1);
  }
}