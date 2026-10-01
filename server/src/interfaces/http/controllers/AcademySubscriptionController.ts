// src/interfaces/http/controllers/AcademySubscriptionController.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AcademySubscriptionUseCases } from "../../../application/use-cases/subscription/AcademySubscriptionUseCases";
import { stripeService } from "../../../infrastructure/services/StripeService";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError, ForbiddenError } from "../../../shared/errors/AppError";

const CheckoutSchema = z.object({
  capacity: z.number().int().min(1),
  staffCapacity: z.number().int().min(0).default(0),
  billingInterval: z.enum(["month", "quarter", "half_year", "year"]),
});

const UpgradeSchema = z.object({
  capacity: z.number().int().min(1),
  staffCapacity: z.number().int().min(0),
});

const RateSchema = z.object({
  rate: z.number().min(0),
});

// A manager may only ever act on their own academy's subscription —
// super_admin can view/manage any academy's. Every handler below that
// takes an :academyId param goes through this first.
function assertAcademyAccess(req: Request, academyId: string): void {
  if (req.user!.role === "super_admin") return;
  if (req.user!.role === "manager" && req.user!.academyId === academyId) return;
  throw new ForbiddenError("You can only manage your own academy's subscription");
}

export class AcademySubscriptionController {
  constructor(private useCases: AcademySubscriptionUseCases) {}

  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const status = await this.useCases.getStatus(academyId);
      ResponseHandler.success(res, status, "Subscription status retrieved");
    } catch (err) {
      next(err);
    }
  };

  getBillingDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const details = await this.useCases.getBillingDetails(academyId);
      ResponseHandler.success(res, details, "Subscription billing details retrieved");
    } catch (err) {
      next(err);
    }
  };


  createRazorpayOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const dto = CheckoutSchema.parse(req.body);
      const isRenewal = Boolean(req.body.isRenewal);
      const result = await this.useCases.createRazorpayOrder(
        academyId,
        { ...dto, isRenewal },
        req.user!.sub,
      );
      ResponseHandler.success(res, result, "Razorpay subscription order created");
    } catch (err) {
      next(err);
    }
  };

  verifyRazorpayPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const { orderId, paymentId, signature } = req.body;
      if (!orderId || !paymentId || !signature) {
        throw new BadRequestError("orderId, paymentId, and signature are required");
      }
      const result = await this.useCases.verifyRazorpayPayment({
        academyId,
        orderId,
        paymentId,
        signature,
      });
      ResponseHandler.success(res, result, "Subscription payment verified");
    } catch (err) {
      next(err);
    }
  };

  checkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const dto = CheckoutSchema.parse(req.body);
      const result = await this.useCases.createCheckoutSession(academyId, dto, req.user!.sub);
      ResponseHandler.success(res, result, "Checkout session created");
    } catch (err) {
      next(err);
    }
  };

  upgrade = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academyId = req.params.academyId;
      assertAcademyAccess(req, academyId);
      const dto = UpgradeSchema.parse(req.body);
      const result = await this.useCases.upgradeCapacity(academyId, dto);
      ResponseHandler.success(res, result, "Capacity upgraded");
    } catch (err) {
      next(err);
    }
  };

  getPlatformRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rate = await this.useCases.getPlatformDefaultRate();
      ResponseHandler.success(res, { rate }, "Platform default rate retrieved");
    } catch (err) {
      next(err);
    }
  };

  setPlatformRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = RateSchema.parse(req.body);
      const rate = await this.useCases.setPlatformDefaultRate(dto.rate, req.user!.sub);
      ResponseHandler.success(res, { rate }, "Platform default rate updated");
    } catch (err) {
      next(err);
    }
  };

  getPlatformStaffRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rate = await this.useCases.getPlatformDefaultStaffRate();
      ResponseHandler.success(res, { rate }, "Platform default staff rate retrieved");
    } catch (err) {
      next(err);
    }
  };

  setPlatformStaffRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = RateSchema.parse(req.body);
      const rate = await this.useCases.setPlatformDefaultStaffRate(dto.rate, req.user!.sub);
      ResponseHandler.success(res, { rate }, "Platform default staff rate updated");
    } catch (err) {
      next(err);
    }
  };

  getPlatformTransferWall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = await this.useCases.getPlatformTransferWall();
      ResponseHandler.success(res, { enabled }, "Platform transfer wall status retrieved");
    } catch (err) {
      next(err);
    }
  };

  setPlatformTransferWall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = Boolean(req.body.enabled);
      const updated = await this.useCases.setPlatformTransferWall(enabled, req.user!.sub);
      ResponseHandler.success(res, { enabled: updated }, "Platform transfer wall status updated");
    } catch (err) {
      next(err);
    }
  };

  verifySession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, academyId } = req.body;
      const targetAcademyId = academyId || req.user?.academyId;
      const result = await this.useCases.verifyCheckoutSession(sessionId, targetAcademyId);
      ResponseHandler.success(res, result, "Subscription checkout verified");
    } catch (err) {
      next(err);
    }
  };

  // Mounted with express.raw() (see index.ts) — req.body here is the raw
  // Buffer Stripe's SDK needs to verify the signature, not parsed JSON.
  webhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        throw new BadRequestError("Missing Stripe signature header");
      }
      const event = stripeService.constructWebhookEvent(req.body, signature);
      await this.useCases.handleWebhookEvent(event);
      res.status(200).json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}