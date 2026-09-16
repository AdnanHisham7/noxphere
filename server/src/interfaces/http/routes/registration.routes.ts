// src/interfaces/http/routes/registration.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";

export const registrationRouter = Router();

// Public routes for registration link
registrationRouter.get("/academy/:academyId", (req, res, next) => {
  req.app.locals.controllers.registration.getAcademyPublicInfo(req, res, next);
});
registrationRouter.get("/academy/:academyId/public-info", (req, res, next) => {
  req.app.locals.controllers.registration.getAcademyPublicInfo(req, res, next);
});

registrationRouter.post("/send-otp", (req, res, next) => {
  req.app.locals.controllers.registration.sendOtp(req, res, next);
});
registrationRouter.post("/otp/send", (req, res, next) => {
  req.app.locals.controllers.registration.sendOtp(req, res, next);
});

registrationRouter.post("/verify-otp", (req, res, next) => {
  req.app.locals.controllers.registration.verifyOtp(req, res, next);
});
registrationRouter.post("/otp/verify", (req, res, next) => {
  req.app.locals.controllers.registration.verifyOtp(req, res, next);
});

registrationRouter.post("/submit", (req, res, next) => {
  req.app.locals.controllers.registration.submitRequest(req, res, next);
});
registrationRouter.post("/apply", (req, res, next) => {
  req.app.locals.controllers.registration.submitRequest(req, res, next);
});

// Manager review routes
registrationRouter.get("/requests", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.registration.listRequests(req, res, next);
});

registrationRouter.post("/requests/:id/reject", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.registration.rejectRequest(req, res, next);
});

registrationRouter.post("/requests/:id/approve", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.registration.approveRequest(req, res, next);
});
