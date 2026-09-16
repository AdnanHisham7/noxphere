import { Router } from "express";
import { authenticate, requirePermission } from "../middleware/auth.middleware";

export const notificationRouter = Router();

notificationRouter.post("/", authenticate, requirePermission("canSendNotifications"), (req, res, next) => {
  req.app.locals.controllers.notification.create(req, res, next);
});
notificationRouter.get("/", authenticate, (req, res, next) => {
  req.app.locals.controllers.notification.list(req, res, next);
});
notificationRouter.patch("/:id/read", authenticate, (req, res, next) => {
  req.app.locals.controllers.notification.markRead(req, res, next);
});

// The current user's own notification feed (the bell icon) — distinct
// from the routes above, which are the manager's audience-broadcast
// compose/history tool. Placed before "/:id/read" would be ambiguous, so
// these use a distinct "/me" prefix that can never collide with a
// Mongo ObjectId param.
notificationRouter.get("/me", authenticate, (req, res, next) => {
  req.app.locals.controllers.userNotification.listMine(req, res, next);
});
notificationRouter.patch("/me/read-all", authenticate, (req, res, next) => {
  req.app.locals.controllers.userNotification.markAllRead(req, res, next);
});
notificationRouter.patch("/me/:id/read", authenticate, (req, res, next) => {
  req.app.locals.controllers.userNotification.markRead(req, res, next);
});