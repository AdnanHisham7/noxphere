// src/interfaces/http/routes/complaint.routes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";

export const complaintRouter = Router();

// Any authenticated academy member can file a complaint.
complaintRouter.post("/", authenticate, (req, res, next) => {
  req.app.locals.controllers.complaint.create(req, res, next);
});

// What the filer sees of their own.
complaintRouter.get("/mine", authenticate, (req, res, next) => {
  req.app.locals.controllers.complaint.listMine(req, res, next);
});

// The manager's inbox for their academy.
complaintRouter.get("/:academyId", authenticate, (req, res, next) => {
  req.app.locals.controllers.complaint.listForAcademy(req, res, next);
});
complaintRouter.post("/:academyId/:complaintId/respond", authenticate, (req, res, next) => {
  req.app.locals.controllers.complaint.respond(req, res, next);
});