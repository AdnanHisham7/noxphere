// src/interfaces/http/routes/guardian.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";

export const guardianRouter = Router();

// Every route here is guardian-only, and every use-case call is further
// scoped to req.user.sub so a guardian can only ever see their own children.
guardianRouter.use(authenticate, authorize("guardian"));

guardianRouter.get("/dashboard", (req, res, next) => {
  req.app.locals.controllers.guardian.getDashboard(req, res, next);
});

guardianRouter.get("/children", (req, res, next) => {
  req.app.locals.controllers.guardian.getMyChildren(req, res, next);
});

guardianRouter.get("/children/:studentId", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildProfile(req, res, next);
});

guardianRouter.get("/children/:studentId/attendance", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildAttendance(req, res, next);
});

guardianRouter.get("/children/:studentId/fees", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildFees(req, res, next);
});

guardianRouter.get("/children/:studentId/payment-config", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildPaymentConfig(req, res, next);
});

guardianRouter.post("/fees/:feeId/installments/:installmentNumber/pay", (req, res, next) => {
  req.app.locals.controllers.guardian.payChildFee(req, res, next);
});

guardianRouter.post("/children/:studentId/fees/:feeId/installments/:installmentNumber/pay", (req, res, next) => {
  req.app.locals.controllers.guardian.payChildFee(req, res, next);
});

guardianRouter.get("/children/:studentId/performance", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildPerformance(req, res, next);
});

guardianRouter.get("/children/:studentId/remarks", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildRemarks(req, res, next);
});

guardianRouter.get("/children/:studentId/sessions", (req, res, next) => {
  req.app.locals.controllers.guardian.getChildSessions(req, res, next);
});
