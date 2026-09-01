// src/interfaces/http/routes/consent.routes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";

export const consentRouter = Router();

consentRouter.get("/notice", authenticate, (req, res, next) => {
  req.app.locals.controllers.consent.getNotice(req, res, next);
});
consentRouter.get("/me", authenticate, (req, res, next) => {
  req.app.locals.controllers.consent.getMyStatus(req, res, next);
});
consentRouter.post("/:studentId/grant", authenticate, (req, res, next) => {
  req.app.locals.controllers.consent.grant(req, res, next);
});
consentRouter.post("/:studentId/withdraw", authenticate, (req, res, next) => {
  req.app.locals.controllers.consent.withdraw(req, res, next);
});
consentRouter.get("/franchise-status", authenticate, (req, res, next) => {
  req.app.locals.controllers.consent.getFranchiseStatus(req, res, next);
});