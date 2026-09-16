// src/interfaces/http/routes/nfcCard.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";

export const nfcCardRouter = Router();

// ─── Pricing Endpoints ────────────────────────────────────────────────────────
nfcCardRouter.get("/pricing", (req, res, next) => {
  req.app.locals.controllers.nfcCard.getPricing(req, res, next);
});

nfcCardRouter.put("/pricing", authenticate, authorize("super_admin"), (req, res, next) => {
  req.app.locals.controllers.nfcCard.updatePricing(req, res, next);
});

// ─── Request Creation ─────────────────────────────────────────────────────────
nfcCardRouter.post("/requests/player", authenticate, authorize("student"), (req, res, next) => {
  req.app.locals.controllers.nfcCard.createPlayerRequest(req, res, next);
});

nfcCardRouter.post("/requests/academy", authenticate, authorize("manager", "super_admin"), (req, res, next) => {
  req.app.locals.controllers.nfcCard.createAcademyRequest(req, res, next);
});

// ─── Listing & Details ────────────────────────────────────────────────────────
nfcCardRouter.get("/requests", authenticate, (req, res, next) => {
  req.app.locals.controllers.nfcCard.listRequests(req, res, next);
});

nfcCardRouter.get("/requests/:id", authenticate, (req, res, next) => {
  req.app.locals.controllers.nfcCard.getRequestById(req, res, next);
});

// ─── Super Admin Actions ──────────────────────────────────────────────────────
nfcCardRouter.post("/requests/:id/approve", authenticate, authorize("super_admin"), (req, res, next) => {
  req.app.locals.controllers.nfcCard.approveRequest(req, res, next);
});

nfcCardRouter.post("/requests/:id/reject", authenticate, authorize("super_admin"), (req, res, next) => {
  req.app.locals.controllers.nfcCard.rejectRequest(req, res, next);
});

nfcCardRouter.post("/requests/:id/fulfillment", authenticate, authorize("super_admin"), (req, res, next) => {
  req.app.locals.controllers.nfcCard.updateFulfillment(req, res, next);
});

// ─── Stripe Payments ──────────────────────────────────────────────────────────
nfcCardRouter.post("/requests/:id/checkout-session", authenticate, (req, res, next) => {
  req.app.locals.controllers.nfcCard.createCheckoutSession(req, res, next);
});

nfcCardRouter.post("/verify-session", authenticate, (req, res, next) => {
  req.app.locals.controllers.nfcCard.verifyCheckoutSession(req, res, next);
});

nfcCardRouter.get("/verify-session", authenticate, (req, res, next) => {
  req.app.locals.controllers.nfcCard.verifyCheckoutSession(req, res, next);
});
