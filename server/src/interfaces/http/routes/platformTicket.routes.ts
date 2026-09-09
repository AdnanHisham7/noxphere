// src/interfaces/http/routes/platformTicket.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";

export const platformTicketRouter = Router();

// Manager submits an issue/query regarding the platform to Super Admin
platformTicketRouter.post("/", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.platformTicket.create(req, res, next);
});

// Manager views their academy's tickets
platformTicketRouter.get("/mine", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.platformTicket.listMine(req, res, next);
});

// Super Admin views all platform tickets across all academies
platformTicketRouter.get("/", authenticate, authorize("super_admin"), (req, res, next) => {
  req.app.locals.controllers.platformTicket.listAll(req, res, next);
});

// View a specific ticket with full message thread
platformTicketRouter.get("/:id", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.platformTicket.getById(req, res, next);
});

// Reply to a ticket thread (Manager or Super Admin)
platformTicketRouter.post("/:id/reply", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.platformTicket.reply(req, res, next);
});

// Update ticket status (e.g. resolve, close, in_progress)
platformTicketRouter.patch("/:id/status", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.platformTicket.updateStatus(req, res, next);
});
