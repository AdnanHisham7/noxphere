import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

import { config } from "../config/app.config";
import { logger } from "../shared/utils/logger";

export let io: SocketIOServer;

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on("join:camp", (campId: string) => {
      socket.join(`camp:${campId}`);
    });

    socket.on("join:user", (userId: string) => {
      socket.join(`user:${userId}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
