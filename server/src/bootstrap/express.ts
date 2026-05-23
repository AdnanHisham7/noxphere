import express, { Express } from "express";

import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";

import { config } from "../config/app.config";

import { apiRouter } from "../interfaces/http/routes";
import { errorHandler } from "../interfaces/http/middleware/errorHandler.middleware";

export function setupExpress(app: Express): void {
  // ───────────────────────────────────────────────────────────
  // Security Middleware
  // ───────────────────────────────────────────────────────────

  app.use(helmet());

  app.use(
    cors({
      origin: [config.clientUrl, /^footballcamp:\/\//],
      credentials: true,
    }),
  );

  app.use(mongoSanitize());

  // ───────────────────────────────────────────────────────────
  // Rate Limiting
  // ───────────────────────────────────────────────────────────

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
  });

  app.use(config.apiPrefix, limiter);

  // ───────────────────────────────────────────────────────────
  // General Middleware
  // ───────────────────────────────────────────────────────────

  app.use(compression());

  app.use(
    morgan(config.env === "development" ? "dev" : "combined"),
  );

  app.use(express.json({ limit: "10mb" }));

  app.use(
    express.urlencoded({
      extended: true,
      limit: "10mb",
    }),
  );

  // ───────────────────────────────────────────────────────────
  // Routes
  // ───────────────────────────────────────────────────────────

  app.use(config.apiPrefix, apiRouter);

  // ───────────────────────────────────────────────────────────
  // 404 Handler
  // ───────────────────────────────────────────────────────────

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      timestamp: new Date().toISOString(),
    });
  });

  // ───────────────────────────────────────────────────────────
  // Global Error Handler
  // ───────────────────────────────────────────────────────────

  app.use(errorHandler);
}