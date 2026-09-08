// src/interfaces/http/routes/academySubscription.routes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";

export const academySubscriptionRouter = Router();

academySubscriptionRouter.get("/:academyId/status", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.getStatus(req, res, next);
});
academySubscriptionRouter.get("/:academyId/billing-details", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.getBillingDetails(req, res, next);
});

academySubscriptionRouter.post("/verify-session", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.verifySession(req, res, next);
});

academySubscriptionRouter.post("/:academyId/checkout", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.checkout(req, res, next);
});
academySubscriptionRouter.post("/:academyId/upgrade", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.upgrade(req, res, next);
});

// Platform-wide default rate — super_admin only, enforced inside the
// controller via requirePermission on the mount below.
academySubscriptionRouter.get("/platform-rate", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.getPlatformRate(req, res, next);
});
academySubscriptionRouter.put("/platform-rate", authenticate, (req, res, next) => {
  if (req.user!.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Only super_admin can set the platform rate", code: "FORBIDDEN" });
    return;
  }
  req.app.locals.controllers.academySubscription.setPlatformRate(req, res, next);
});

academySubscriptionRouter.get("/platform-staff-rate", authenticate, (req, res, next) => {
  req.app.locals.controllers.academySubscription.getPlatformStaffRate(req, res, next);
});
academySubscriptionRouter.put("/platform-staff-rate", authenticate, (req, res, next) => {
  if (req.user!.role !== "super_admin") {
    res.status(403).json({ success: false, message: "Only super_admin can set the platform staff rate", code: "FORBIDDEN" });
    return;
  }
  req.app.locals.controllers.academySubscription.setPlatformStaffRate(req, res, next);
});

// NOTE: the webhook route itself is mounted separately in index.ts, with
// express.raw() instead of express.json(), because Stripe's signature
// verification needs the exact raw request bytes — parsing it as JSON
// first (as every other route in this app does) would make the
// signature check fail on every event.