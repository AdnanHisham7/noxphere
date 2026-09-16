// src/interfaces/http/controllers/NfcCardController.ts
import { Request, Response, NextFunction } from "express";
import { NfcCardUseCases } from "../../../application/use-cases/nfc/NfcCardUseCases";
import {
  CreatePlayerNfcRequestSchema,
  CreateAcademyNfcRequestSchema,
  ApproveNfcRequestSchema,
  RejectNfcRequestSchema,
  UpdateNfcFulfillmentSchema,
  UpdateNfcPricingSchema,
  ListNfcRequestsQuerySchema,
} from "../../../application/dtos/nfcCard.dto";
import { ResponseHandler } from "../../../shared/utils/ResponseHandler";
import { BadRequestError } from "../../../shared/errors/AppError";

export class NfcCardController {
  constructor(private useCases: NfcCardUseCases) {}

  getPricing = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pricing = await this.useCases.getPricing();
      ResponseHandler.success(res, pricing, "NFC pricing retrieved successfully");
    } catch (err) {
      next(err);
    }
  };

  updatePricing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateNfcPricingSchema.parse(req.body);
      const pricing = await this.useCases.updatePricing(dto, req.user!.sub);
      ResponseHandler.success(res, pricing, "NFC pricing updated successfully");
    } catch (err) {
      next(err);
    }
  };

  createPlayerRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreatePlayerNfcRequestSchema.parse(req.body);
      const request = await this.useCases.createPlayerRequest(req.user!.sub, dto);
      ResponseHandler.created(res, request, "NFC Card request submitted successfully");
    } catch (err) {
      next(err);
    }
  };

  createAcademyRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const academyId = req.user?.academyId || (req.body.academyId as string);
      if (!academyId) {
        throw new BadRequestError("Academy reference is required");
      }
      const dto = CreateAcademyNfcRequestSchema.parse(req.body);
      const request = await this.useCases.createAcademyRequest(req.user!.sub, academyId, dto);
      ResponseHandler.created(res, request, "Bulk NFC Card request submitted successfully");
    } catch (err) {
      next(err);
    }
  };

  listRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ListNfcRequestsQuerySchema.parse(req.query);
      const result = await this.useCases.listRequests(query, {
        sub: req.user!.sub,
        role: req.user!.role,
        academyId: req.user?.academyId,
      });
      ResponseHandler.success(res, result, "NFC requests retrieved successfully");
    } catch (err) {
      next(err);
    }
  };

  getRequestById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await this.useCases.getRequestById(req.params.id, {
        sub: req.user!.sub,
        role: req.user!.role,
        academyId: req.user?.academyId,
      });
      ResponseHandler.success(res, request, "NFC request details retrieved");
    } catch (err) {
      next(err);
    }
  };

  approveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = ApproveNfcRequestSchema.parse(req.body || {});
      const request = await this.useCases.approveRequest(req.params.id, req.user!.sub, dto);
      ResponseHandler.success(res, request, "NFC Card request approved");
    } catch (err) {
      next(err);
    }
  };

  rejectRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = RejectNfcRequestSchema.parse(req.body);
      const request = await this.useCases.rejectRequest(req.params.id, req.user!.sub, reason);
      ResponseHandler.success(res, request, "NFC Card request rejected");
    } catch (err) {
      next(err);
    }
  };

  createCheckoutSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.useCases.createCheckoutSession(req.params.id, {
        sub: req.user!.sub,
        role: req.user!.role,
        academyId: req.user?.academyId,
      });
      ResponseHandler.success(res, result, "Stripe checkout session created");
    } catch (err) {
      next(err);
    }
  };

  verifyCheckoutSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = (req.body?.sessionId || req.query?.session_id || req.query?.sessionId) as string;
      if (!sessionId || typeof sessionId !== "string") {
        throw new BadRequestError("sessionId is required");
      }
      const userContext = req.user
        ? { sub: req.user.sub, role: req.user.role }
        : undefined;
      const result = await this.useCases.verifyCheckoutSession(sessionId, userContext);
      ResponseHandler.success(res, result, "Stripe checkout session verified");
    } catch (err) {
      next(err);
    }
  };

  updateFulfillment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateNfcFulfillmentSchema.parse(req.body);
      const request = await this.useCases.updateFulfillmentStatus(req.params.id, req.user!.sub, dto);
      ResponseHandler.success(res, request, `NFC fulfillment status updated to ${dto.status}`);
    } catch (err) {
      next(err);
    }
  };
}
