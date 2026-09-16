// src/infrastructure/services/SocketRegistry.ts
// index.ts creates the Socket.IO server; NotificationService needs to emit
// through it. Importing `io` from index.ts directly would create a
// circular import (index.ts -> use cases -> NotificationService ->
// index.ts), so index.ts registers the instance here once it's created,
// and anything that needs to emit reads it back from here instead.
import { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer): void {
  ioInstance = io;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}